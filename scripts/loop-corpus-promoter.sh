#!/usr/bin/env bash
# Corpus promoter — perpetual launchd loop.
#
# Promotes single-step corpus claims (statusHistory has only a first entry with
# fromAxis=null) into multi-step epistemic trajectories. Each run:
#   1. Picks 3 not-yet-attempted claims via pick-promotable-claim.ts (tier alternates by run)
#   2. Builds a pipeline-specific prompt for Claude Opus using corpus-promoter-prompt.md
#   3. Claude researches the arc, verifies source URLs, emits a TypeScript enrich script
#   4. The script is validated by apply-enrichment.ts, written + run (tsx), then committed + pushed
#   5. Telegram ping with results
#
# launchd keeps it alive (KeepAlive=true); the script itself loops forever.
# NOTE: repo uses `tsx` (ts-node is not installed), so TS files run via `npx tsx`.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/corpus-promoter.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
DECISIONS_LOG="$PROJECT_DIR/logs/corpus-promoter-decisions.jsonl"
ATTEMPTED_LOG="$PROJECT_DIR/logs/corpus-promoter-attempted.jsonl"
ENRICHMENTS_DIR="$PROJECT_DIR/scripts/enrichments"
RUN=0

mkdir -p "$PROJECT_DIR/logs" "$ENRICHMENTS_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# ── Claim selection ─────────────────────────────────────────────────────────
# Uses pick-promotable-claim.ts for modular, testable claim selection.
# Prints newline-delimited JSON (one claim per line): {id,text,ingestedBy,claimEmergedAt}
select_claims() {
  local run_num="$1"
  cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- npx tsx scripts/pick-promotable-claim.ts \
    --run "$run_num" \
    --count 3 \
    --attempted "$ATTEMPTED_LOG" \
    2>>"$LOG"
}

# ── Per-pipeline prompt templates ───────────────────────────────────────────
build_prompt() {
  local claim_id="$1" claim_text="$2" ingested_by="$3" emerged_at="$4"
  local body

  case "$ingested_by" in
    drugsatfda_v1|openfda_labels_v1)
      body="You are expanding an epistemic receipt for an FDA drug approval claim.

Claim ID: ${claim_id}
Claim text: ${claim_text}
FDA approval date: ${emerged_at}

Research and add ClaimStatusHistory rows for this claim's epistemic arc:
1. OPEN->RECORDED: First published clinical evidence (Phase II or III trial) — cite primary publication with date
2. RECORDED->SETTLED: Broad clinical adoption, standard-of-care status, or major guideline inclusion — cite guideline
3. SETTLED->CONTESTED or SETTLED->REVERSED: Post-market safety signal, black box warning, or withdrawal — cite FDA safety communication

For each event: exact date (DAY precision preferred), ratifying community (EXPERT_LITERATURE|INSTITUTIONAL|JUDICIAL|PUBLIC|MARKET), reason prose (2-3 sentences), one verifiable URL. Only include URLs you are confident exist (official DOIs, Congress.gov, FDA.gov, WHO, PubMed). Prefer DOI links (doi.org/10.xxxx) and .gov sources."
      ;;
    crossref_retractions_v1)
      body="You are expanding an epistemic receipt for a retracted academic paper.

Claim ID: ${claim_id}
Claim text: ${claim_text}
Retraction date: ${emerged_at}

The claim entered the DB as RECORDED (the retraction event). Research the full arc backwards then forwards:
1. OPEN->RECORDED (pre-retraction): When was the original paper published? Cite primary publication URL with exact publication date. This PRECEDES the retraction date.
2. RECORDED->CONTESTED: The retraction notice — fetch the publisher retraction URL or Retraction Watch entry (retractionwatch.com). Confirm URL accessible.
3. REVERSED->OPEN or REVERSED->SETTLED: Was the core finding independently replicated post-retraction, or did the field move on? Check for citing papers.

For each event: exact date, ratifying community (EXPERT_LITERATURE|INSTITUTIONAL|JUDICIAL|PUBLIC|MARKET), reason prose, one verifiable URL. Only include URLs you are confident exist (official DOIs, Congress.gov, FDA.gov, WHO, PubMed). Prefer DOI links (doi.org/10.xxxx) and .gov sources."
      ;;
    voteview_v1|congress_bills_tracker_v1)
      body="You are expanding an epistemic receipt for a congressional vote or bill.

Claim ID: ${claim_id}
Claim text: ${claim_text}
Vote date: ${emerged_at}

Research the legislative arc:
1. OPEN->RECORDED: Bill introduction or committee hearing — cite Congress.gov
2. RECORDED->SETTLED or RECORDED->ABANDONED: Final passage + presidential signature, or failure — cite Congress.gov vote record
3. SETTLED->CONTESTED or SETTLED->REVERSED (if applicable): Later repeal, amendment, or court injunction — cite relevant source

Community: INSTITUTIONAL for congressional action, JUDICIAL for court challenges. ABANDONED is a valid terminal state.
For each event: exact date, reason prose, one verifiable URL. Only include URLs you are confident exist (official DOIs, Congress.gov, FDA.gov, WHO, PubMed). Prefer DOI links (doi.org/10.xxxx) and .gov sources."
      ;;
    openalex_v1)
      body="You are expanding an epistemic receipt for a high-impact academic paper.

Claim ID: ${claim_id}
Claim text: ${claim_text}
Published: ${emerged_at}

Research the epistemic trajectory:
1. OPEN->RECORDED: Confirm the paper's publication date and journal
2. RECORDED->CONTESTED: Prominent challenge, failed replication, or methodological critique — cite the specific critique paper with date
3. CONTESTED->SETTLED or CONTESTED->REVERSED: Was the controversy resolved? By meta-analysis, systematic review, or retraction?
4. RECORDED->SETTLED (if no controversy): Did subsequent systematic reviews endorse the finding?

Only add arcs where you find SPECIFIC dated evidence. If no notable follow-up exists, output SKIP.
For each event: exact date, ratifying community (EXPERT_LITERATURE|INSTITUTIONAL|JUDICIAL|PUBLIC|MARKET), reason prose, one verifiable URL. Only include URLs you are confident exist (official DOIs, Congress.gov, FDA.gov, WHO, PubMed). Prefer DOI links (doi.org/10.xxxx) and .gov sources."
      ;;
    who_essential_medicines_v1)
      body="You are expanding an epistemic receipt for a WHO Essential Medicines List entry.

Claim ID: ${claim_id}
Claim text: ${claim_text}
Listing date: ${emerged_at}

Research the epistemic arc:
1. OPEN->RECORDED: First published clinical evidence establishing efficacy — cite primary publication with date
2. RECORDED->SETTLED: WHO EML inclusion or major guideline adoption — cite the WHO EML or guideline
3. SETTLED->CONTESTED or SETTLED->REVERSED (if applicable): Later safety signal, delisting, or superseding therapy

For each event: exact date, ratifying community (EXPERT_LITERATURE|INSTITUTIONAL|JUDICIAL|PUBLIC|MARKET), reason prose, one verifiable URL. Only include URLs you are confident exist (official DOIs, Congress.gov, FDA.gov, WHO, PubMed). Prefer DOI links (doi.org/10.xxxx) and .gov sources."
      ;;
    *)
      body="SKIP — pipeline ${ingested_by} not in promotable tier for this run."
      ;;
  esac

  # Common output-format appendix (TS enrich-script contract).
  printf '%s\n\n%s' "$body" "OUTPUT FORMAT — emit exactly this, nothing else after:

FILE:scripts/enrichments/enrich-corpus-${ingested_by}-<slug>.ts
<TypeScript content>
END_FILE
PROMOTED:<N>
SKIPPED:<reason, only if skipping>
VERIFICATION_LOG:<url1 -> 200 | url2 -> 404/discarded>

If there is no verifiable multi-step arc to add, emit no FILE block and instead:
PROMOTED:0
SKIPPED:<reason>

The TypeScript enrich script MUST follow the pattern in scripts/seed-human-history-trajectories.ts (read it first). Requirements:
- Begins with: import 'dotenv/config' and import { PrismaClient } from '@prisma/client'
- const prisma = new PrismaClient()
- For each transition: prisma.source.upsert({ where: { externalId: 'src:...' }, create: {...}, update: {...} }) FIRST
- Then prisma.claimStatusHistory.upsert({ where: { id: slug }, create: {...}, update: {...} }) where slug = \`\${claimId}-\${toAxis}-\${occurredAt.slice(0,10)}\` (e.g. '${claim_id}-SETTLED-2020-06-15')
- claimId is the existing claim id '${claim_id}' — do NOT create a new Claim
- fromAxis / toAxis are FactStatus strings: OPEN|RECORDED|SETTLED|CONTESTED|REVERSED|ABANDONED|UNRESOLVABLE (the existing first entry already has fromAxis=null -> toAxis=<first>; do not duplicate it)
- community is one of: EXPERT_LITERATURE|INSTITUTIONAL|JUDICIAL|PUBLIC|MARKET
- All dates as new Date('YYYY-MM-DD'); set datePrecision ('DAY'|'MONTH'|'QUARTER'|'YEAR')
- Wrap writes in an async main(); end with await prisma.\$disconnect()
- Only include arcs with high-confidence URLs (DOIs, .gov, official publisher links)"
}

# ── Main loop ───────────────────────────────────────────────────────────────
log "=== corpus-promoter loop starting (pid $$) ==="

while true; do
  RUN=$((RUN + 1))
  RUN_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  TIER_LABEL=$([ $((RUN % 3)) -eq 2 ] && echo "TIER2 (openalex)" || echo "TIER1 (FDA/retractions/Congress)")
  log "=== run #${RUN} start — ${TIER_LABEL} ==="

  # Pick 3 claims via pick-promotable-claim.ts (newline-delimited JSON).
  CLAIMS_JSON=$(select_claims "$RUN")
  if [ -z "$CLAIMS_JSON" ]; then
    log "run #${RUN}: no eligible claims returned. Sleeping 60s."
    sleep 60
    continue
  fi

  TOTAL_PROMOTED=0
  TOTAL_SKIPPED=0
  RUN_DETAILS=""

  # Process each claim.
  while IFS= read -r CLAIM_LINE; do
    [ -z "$CLAIM_LINE" ] && continue
    CLAIM_ID=$(echo "$CLAIM_LINE" | jq -r '.id')
    CLAIM_TEXT=$(echo "$CLAIM_LINE" | jq -r '.text')
    INGESTED_BY=$(echo "$CLAIM_LINE" | jq -r '.ingestedBy')
    EMERGED_AT=$(echo "$CLAIM_LINE" | jq -r '.claimEmergedAt // "unknown"' | cut -c1-10)

    log "  -> claim ${CLAIM_ID} (${INGESTED_BY})"

    PROMPT=$(build_prompt "$CLAIM_ID" "$CLAIM_TEXT" "$INGESTED_BY" "$EMERGED_AT")

    OUTPUT=$(cd "$PROJECT_DIR" && claude --print --model claude-opus-4-8 "$PROMPT" 2>&1) || true
    echo "$OUTPUT" >> "$LOG"

    # Parse output.
    FILE_PATH=$(echo "$OUTPUT" | grep '^FILE:' | head -1 | sed 's/^FILE://')
    FILE_CONTENT=$(echo "$OUTPUT" | sed -n '/^FILE:/,/^END_FILE/p' | grep -v '^FILE:\|^END_FILE' | grep -v '^```')
    PROMOTED=$(echo "$OUTPUT" | grep '^PROMOTED:' | head -1 | sed 's/^PROMOTED://' | tr -d ' ')
    SKIPPED=$(echo "$OUTPUT" | grep '^SKIPPED:' | head -1 | sed 's/^SKIPPED://')

    RESULT="failed"
    PROMOTED_COUNT="${PROMOTED:-0}"

    if [ -n "$FILE_CONTENT" ] && [ -n "$FILE_PATH" ]; then
      # Normalize path — enrichments go to scripts/enrichments/
      case "$FILE_PATH" in
        /*) TARGET="$FILE_PATH" ;;
        *)  TARGET="$PROJECT_DIR/$FILE_PATH" ;;
      esac
      # Ensure target is in enrichments dir
      mkdir -p "$(dirname "$TARGET")"
      echo "$FILE_CONTENT" > "$TARGET"
      log "    wrote ${TARGET}; validating + running via apply-enrichment..."

      # Validate and execute via apply-enrichment.ts
      if (cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- npx tsx scripts/apply-enrichment.ts "$TARGET" >> "$LOG" 2>&1); then
        RESULT="promoted"
        TOTAL_PROMOTED=$((TOTAL_PROMOTED + ${PROMOTED_COUNT:-0}))
        RUN_DETAILS="${RUN_DETAILS}${CLAIM_ID} (${INGESTED_BY}): +${PROMOTED_COUNT} | "
        log "    promoted ${PROMOTED_COUNT} transitions"
      else
        RESULT="failed"
        log "    apply-enrichment failed for ${TARGET}"
      fi
    else
      RESULT="skipped"
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      log "    skipped: ${SKIPPED:-no file emitted}"
    fi

    # Track this attempt.
    ATT_ESCAPED_SKIP=$(printf '%s' "${SKIPPED:-}" | python3 -c "import sys,json;print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
    printf '{"claimId":"%s","ts":"%s","result":"%s","pipeline":"%s","promotedCount":%s,"skipReason":%s}\n' \
      "$CLAIM_ID" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RESULT" "$INGESTED_BY" "${PROMOTED_COUNT:-0}" "$ATT_ESCAPED_SKIP" \
      >> "$ATTEMPTED_LOG"

    # Decision log (full raw output for auditing).
    RAW_ESCAPED=$(echo "$OUTPUT" | python3 -c "import sys,json;print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
    printf '{"run":%d,"ts":"%s","claimId":"%s","pipeline":"%s","result":"%s","promoted":%s,"raw":%s}\n' \
      "$RUN" "$RUN_TS" "$CLAIM_ID" "$INGESTED_BY" "$RESULT" "${PROMOTED_COUNT:-0}" "$RAW_ESCAPED" \
      >> "$DECISIONS_LOG"
  done <<< "$CLAIMS_JSON"

  log "run #${RUN} done — promoted:${TOTAL_PROMOTED} skipped:${TOTAL_SKIPPED}"

  # Commit + push if anything was promoted, then ping.
  if [ "$TOTAL_PROMOTED" -gt 0 ]; then
    (cd "$PROJECT_DIR" && git add -A && \
      git commit -m "corpus-promoter: promote ${TOTAL_PROMOTED} claims (run #${RUN})" && \
      git push origin main) >> "$LOG" 2>&1 || log "  git commit/push failed (nothing to commit or push error)"
    bash "$NOTIFY" "Corpus promoter run #${RUN}: +${TOTAL_PROMOTED} promoted, ${TOTAL_SKIPPED} skipped
${RUN_DETAILS}"
  fi

  sleep 10  # brief pause between runs
done
