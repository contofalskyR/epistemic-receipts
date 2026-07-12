#!/usr/bin/env bash
# Openalex promoter — perpetual launchd loop.
#
# Retargeted 2026-07-03 (CORPUS-PROMOTER-BULK-PLAN.md §5). Wave 1 bulk-promoted
# 205,679 vote/FDA claims, wave 2 curved 18,280 retractions, and the
# completeness reclassification (lib/corpus-completeness.ts) removed born-
# settled/born-recorded pipelines from the queue. What remains for the LLM is
# openalex_v1: ~217k academic papers whose settling curve depends on whether
# the finding was replicated, contested, meta-analyzed, or retracted.
#
# Each run:
#   1. Picks $BATCH_SIZE not-yet-attempted openalex_v1 claims via
#      pick-promotable-claim.ts (highest metadata.cited_by_count first)
#   2. Builds the research prompt (one claim per Claude Opus call)
#   3. Claude researches the arc, verifies source URLs, emits a TypeScript
#      enrich script — or SKIP (expected for most papers; that is fine)
#   4. The script is validated by apply-enrichment.ts, written + run (tsx),
#      then committed + pushed
#   5. Telegram ping with results
#
# launchd keeps it alive (KeepAlive=true); the script itself loops forever.
# NOTE: repo uses `tsx` (ts-node is not installed), so TS files run via `npx tsx`.
# NOTE: log paths keep their historical names so the attempted-claims ledger
# carries over — do not rename ATTEMPTED_LOG.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/corpus-promoter.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
DECISIONS_LOG="$PROJECT_DIR/logs/corpus-promoter-decisions.jsonl"
ATTEMPTED_LOG="$PROJECT_DIR/logs/corpus-promoter-attempted.jsonl"
ERRORS_LOG="$PROJECT_DIR/logs/corpus-promoter-errors.jsonl"
ENRICHMENTS_DIR="$PROJECT_DIR/scripts/enrichments"
BATCH_SIZE="${BATCH_SIZE:-8}"   # claims per run; each gets its own LLM call
PROMOTER_MODEL="${PROMOTER_MODEL:-claude-opus-4-8}"
RUN=0

mkdir -p "$PROJECT_DIR/logs" "$ENRICHMENTS_DIR"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# ── Claude API call with retry ───────────────────────────────────────────────
# Calls claude with --output-format json; echoes the CLI JSON object on stdout.
# Returns non-zero (and prints nothing) if no valid PROMOTED:/SKIPPED:/FILE:
# output after 3 attempts. Caller must NOT write to ATTEMPTED_LOG on failure —
# the claim stays pickable for the next run.
call_claude() {
  local attempt out text
  for attempt in 1 2 3; do
    out=$(cd "$PROJECT_DIR" && claude --allowedTools "WebSearch,WebFetch" --print \
      --model "$PROMOTER_MODEL" --output-format json "$1" 2>>"$LOG") || true
    text=$(echo "$out" | jq -r '.result // empty' 2>/dev/null)
    if [ -n "$text" ] && echo "$text" | grep -qE '(^PROMOTED:|^SKIPPED:|^FILE:)'; then
      echo "$out"; return 0
    fi
    log "  claude call invalid/errored (attempt ${attempt}/3); backing off ${attempt}m"
    sleep $((attempt * 60))
  done
  return 1
}

# ── Claim selection ─────────────────────────────────────────────────────────
# pick-promotable-claim.ts returns openalex_v1 single-step claims, highest
# cited_by_count first. Newline-delimited JSON:
#   {id,text,ingestedBy,claimEmergedAt,citedByCount,doi,isRetracted,openalexId}
select_claims() {
  cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- npx tsx scripts/pick-promotable-claim.ts \
    --count "$BATCH_SIZE" \
    --attempted "$ATTEMPTED_LOG" \
    2>>"$LOG"
}

# ── Prompt templates ────────────────────────────────────────────────────────
build_prompt() {
  local claim_id="$1" claim_text="$2" ingested_by="$3" emerged_at="$4" cited_by="$5" doi="$6" openalex_id="$7"
  local body

  case "$ingested_by" in
    openalex_v1)
      body="You are expanding an epistemic receipt for an academic paper. The claim already has its baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the publication date) — do NOT duplicate it. Your job is to find what happened to this finding AFTER publication.

Claim ID: ${claim_id}
Claim text: ${claim_text}
Published: ${emerged_at}
DOI: ${doi}
OpenAlex ID: ${openalex_id:-not available}
Citations (OpenAlex): ${cited_by}

Resolve the DOI first before any title search when researching this claim. Use the DOI and OpenAlex ID to confirm you are researching the correct paper — misidentification is the worst failure mode at this scale.

Search specifically for, in priority order:
1. RETRACTION or expression of concern — check Retraction Watch (retractionwatch.com), the publisher page, PubMed. If retracted: RECORDED->CONTESTED at the expression-of-concern or first public challenge date (if one exists), then CONTESTED->REVERSED (or RECORDED->REVERSED directly) at the retraction date. Community: EXPERT_LITERATURE.
2. FAILED REPLICATION or major methodological critique — a specific, dated, citable paper or registered replication report (e.g. Many Labs, RRR). RECORDED->CONTESTED at its publication date.
3. SYSTEMATIC REVIEW / META-ANALYSIS that adjudicates the finding — Cochrane, Campbell, or a well-cited meta-analysis. CONTESTED->SETTLED (vindicated) or CONTESTED->REVERSED (overturned); if there was never a contest, RECORDED->SETTLED at the review's publication date.
4. FIELD CONSENSUS SHIFT — inclusion in a major clinical guideline, textbook consensus, or a consensus statement naming this finding. RECORDED->SETTLED, community INSTITUTIONAL (guideline) or EXPERT_LITERATURE (review).

Hard rules:
- SKIP is the expected outcome for most papers. If you cannot find a SPECIFIC, DATED, citable follow-up event, emit PROMOTED:0 with SKIPPED:<reason>. A high citation count alone is NOT evidence of settling; do not add RECORDED->SETTLED without a specific adjudicating document.
- Never invent a transition to make the curve look richer. One verified transition beats three plausible ones.
- Every transition needs: a date at the precision the adjudicating document supports — never sharpen a month or issue date to a day, a ratifying community (EXPERT_LITERATURE|INSTITUTIONAL|JUDICIAL|PUBLIC|MARKET), 2-3 sentence reason, and one URL you have VERIFIED resolves (fetch it). Prefer doi.org links, PubMed, Cochrane, publisher pages, retractionwatch.com. Discard any transition whose URL you cannot verify.
- Print the TypeScript file inline in your reply; do NOT attempt to create or write files with tools."
      ;;
    crossref_retractions_v1)
      body="You are expanding an epistemic receipt for a retracted academic paper (wave-2 residue: CrossRef has no publication date on record for it — you must find one).

Claim ID: ${claim_id}
Claim text: ${claim_text}
Retraction date: ${emerged_at}

The claim's baseline row is fromAxis=null -> REVERSED at the retraction date. Research backwards:
1. When was the original paper published? Cite the primary publication URL with its date. This PRECEDES the retraction date. Then your enrich script must do BOTH: (a) upsert the new publication row fromAxis=null -> RECORDED at the publication date, and (b) re-point the baseline so the chain is coherent:
   await prisma.claimStatusHistory.updateMany({ where: { claimId: '${claim_id}', fromAxis: null, toAxis: 'REVERSED' }, data: { fromAxis: 'RECORDED' } })
   (run (b) AFTER (a); without it the claim would have two entry rows)
2. Optionally RECORDED->CONTESTED at the expression-of-concern date if one exists (check Retraction Watch).

Every transition needs an exact date, community EXPERT_LITERATURE, reason prose, and one VERIFIED URL. If the original publication cannot be dated from a verifiable source, emit PROMOTED:0 SKIPPED:<reason>."
      ;;
    *)
      body="SKIP — pipeline ${ingested_by} is no longer in the LLM promoter queue (see lib/corpus-completeness.ts). Emit PROMOTED:0 SKIPPED:pipeline retired from queue."
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
- All dates as new Date('YYYY-MM-DD'); set datePrecision ('DAY'|'MONTH'|'QUARTER'|'YEAR') to match what the adjudicating document actually supports
- Wrap writes in an async main(); end with await prisma.\$disconnect()
- Only include arcs with high-confidence URLs (DOIs, .gov, official publisher links)"
}

# ── Main loop ───────────────────────────────────────────────────────────────
log "=== openalex-promoter loop starting (pid $$, batch ${BATCH_SIZE}, model ${PROMOTER_MODEL}) ==="

while true; do
  RUN=$((RUN + 1))
  RUN_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  log "=== run #${RUN} start — openalex_v1, batch ${BATCH_SIZE} ==="

  # Pick claims via pick-promotable-claim.ts (newline-delimited JSON).
  CLAIMS_JSON=$(select_claims)
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
    CITED_BY=$(echo "$CLAIM_LINE" | jq -r '.citedByCount // 0')
    DOI=$(echo "$CLAIM_LINE" | jq -r '.doi // "not available"')
    OPENALEX_ID=$(echo "$CLAIM_LINE" | jq -r '.openalexId // ""')

    log "  -> claim ${CLAIM_ID} (${INGESTED_BY}, cited_by ${CITED_BY})"

    PROMPT=$(build_prompt "$CLAIM_ID" "$CLAIM_TEXT" "$INGESTED_BY" "$EMERGED_AT" "$CITED_BY" "$DOI" "$OPENALEX_ID")

    # Call claude with retry. On persistent API failure: log to ERRORS_LOG and
    # skip the ledger write so the claim stays pickable on the next run.
    if ! CLAUDE_JSON=$(call_claude "$PROMPT"); then
      log "    API error — no valid output after 3 attempts; claim stays in queue"
      printf '{"claimId":"%s","ts":"%s","pipeline":"%s","error":"api_failure"}\n' \
        "$CLAIM_ID" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$INGESTED_BY" >> "$ERRORS_LOG"
      continue
    fi

    OUTPUT=$(echo "$CLAUDE_JSON" | jq -r '.result // ""')
    COST=$(echo "$CLAUDE_JSON" | jq -r '.total_cost_usd // "null"')
    TURNS=$(echo "$CLAUDE_JSON" | jq -r '.num_turns // "null"')
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
      mkdir -p "$(dirname "$TARGET")"
      echo "$FILE_CONTENT" > "$TARGET"
      log "    wrote ${TARGET}; validating + running via apply-enrichment..."

      # Apply with one retry on transient failure.
      APPLY_OK=false
      if (cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- npx tsx scripts/apply-enrichment.ts "$TARGET" >> "$LOG" 2>&1); then
        APPLY_OK=true
      else
        log "    apply-enrichment failed; retrying in 30s"
        sleep 30
        if (cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- npx tsx scripts/apply-enrichment.ts "$TARGET" >> "$LOG" 2>&1); then
          APPLY_OK=true
        fi
      fi

      if $APPLY_OK; then
        RESULT="promoted"
        TOTAL_PROMOTED=$((TOTAL_PROMOTED + ${PROMOTED_COUNT:-0}))
        RUN_DETAILS="${RUN_DETAILS}${CLAIM_ID} (cited_by ${CITED_BY}): +${PROMOTED_COUNT} | "
        log "    promoted ${PROMOTED_COUNT} transitions"
      else
        RESULT="failed"
        log "    apply-enrichment failed for ${TARGET} (2 attempts)"
      fi
    else
      RESULT="skipped"
      TOTAL_SKIPPED=$((TOTAL_SKIPPED + 1))
      log "    skipped: ${SKIPPED:-no file emitted}"
    fi

    # Track this attempt.
    ATT_ESCAPED_SKIP=$(printf '%s' "${SKIPPED:-}" | python3 -c "import sys,json;print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
    printf '{"claimId":"%s","ts":"%s","result":"%s","pipeline":"%s","promotedCount":%s,"skipReason":%s,"model":"%s","costUsd":%s,"turns":%s}\n' \
      "$CLAIM_ID" "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$RESULT" "$INGESTED_BY" "${PROMOTED_COUNT:-0}" "$ATT_ESCAPED_SKIP" \
      "$PROMOTER_MODEL" "${COST:-null}" "${TURNS:-null}" \
      >> "$ATTEMPTED_LOG"

    # Decision log (full raw text output for auditing).
    RAW_ESCAPED=$(echo "$OUTPUT" | python3 -c "import sys,json;print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
    printf '{"run":%d,"ts":"%s","claimId":"%s","pipeline":"%s","result":"%s","promoted":%s,"model":"%s","costUsd":%s,"turns":%s,"raw":%s}\n' \
      "$RUN" "$RUN_TS" "$CLAIM_ID" "$INGESTED_BY" "$RESULT" "${PROMOTED_COUNT:-0}" \
      "$PROMOTER_MODEL" "${COST:-null}" "${TURNS:-null}" "$RAW_ESCAPED" \
      >> "$DECISIONS_LOG"
  done <<< "$CLAIMS_JSON"

  log "run #${RUN} done — promoted:${TOTAL_PROMOTED} skipped:${TOTAL_SKIPPED}"

  # Commit + push if anything was promoted, then ping.
  if [ "$TOTAL_PROMOTED" -gt 0 ]; then
    (cd "$PROJECT_DIR" && git add -A && \
      git commit -m "openalex-promoter: promote ${TOTAL_PROMOTED} transitions (run #${RUN})" && \
      git push origin main) >> "$LOG" 2>&1 || log "  git commit/push failed (nothing to commit or push error)"
    bash "$NOTIFY" "Openalex promoter run #${RUN}: +${TOTAL_PROMOTED} transitions, ${TOTAL_SKIPPED} skipped (batch ${BATCH_SIZE})
${RUN_DETAILS}"
  fi

  sleep 10  # brief pause between runs
done
