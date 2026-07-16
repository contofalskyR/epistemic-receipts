#!/usr/bin/env bash
# ab-test-promoter.sh — model comparison for the OpenAlex corpus promoter.
#
# Purpose: decide whether claude-fable-5 outperforms claude-opus-4-8 on the
# promoter task before the next >=4,000-citation tier (~980 claims).
#
# Design:
#   * Test set = first 20 claims (file order) with "result":"skipped" in
#     logs/corpus-promoter-attempted.jsonl — the hardest cases.
#   * Each claim runs twice: once per model. Outputs saved, nothing applied.
#   * OBSERVATION ONLY — hard constraint: no apply-enrichment.ts, no
#     emitTransition, no DB writes. The model is invoked with only
#     WebSearch/WebFetch tools (same as the production loop), so it cannot
#     write anything either. The only DB access in this harness is one
#     read-only SELECT in scripts/ab-test-fetch-claims.ts.
#   * Resumable: a non-empty output file skips its run — safe to re-run after
#     interruption without re-spending.
#
# The prompt body mirrors build_prompt() (openalex_v1 case) in
# scripts/loop-corpus-promoter.sh as of 2026-07-16 — if that changes, re-sync.
#
# Usage:  ./scripts/ab-test-promoter.sh
# Env:    MODEL_A (default claude-opus-4-8)
#         MODEL_B (default anthropic/claude-fable-5)
#         N_CLAIMS (default 20)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ATTEMPTED_LOG="$PROJECT_DIR/logs/corpus-promoter-attempted.jsonl"
OUT_DIR="$PROJECT_DIR/logs/ab-test"
MODEL_A="${MODEL_A:-claude-opus-4-8}"
MODEL_B="${MODEL_B:-anthropic/claude-fable-5}"
TAG_A="opus"
TAG_B="fable"
N_CLAIMS="${N_CLAIMS:-20}"

mkdir -p "$OUT_DIR"
cd "$PROJECT_DIR"

command -v jq >/dev/null || { echo "jq required"; exit 1; }
command -v claude >/dev/null || { echo "claude CLI required"; exit 1; }
[ -f "$ATTEMPTED_LOG" ] || { echo "missing $ATTEMPTED_LOG"; exit 1; }

log() { echo "[$(date '+%H:%M:%S')] $*"; }

# ── 1. Test set: first N skipped claim IDs by file order ─────────────────────
node -e '
const fs = require("fs");
const n = parseInt(process.argv[1], 10);
const ids = [];
for (const line of fs.readFileSync(process.argv[2], "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { const r = JSON.parse(line); if (r.result === "skipped" && r.claimId) ids.push(r.claimId); } catch {}
  if (ids.length >= n) break;
}
if (ids.length < n) console.error(`warning: only ${ids.length} skipped claims found`);
console.log(ids.join("\n"));
' "$N_CLAIMS" "$ATTEMPTED_LOG" > "$OUT_DIR/claim-ids.txt"
log "test set: $(wc -l < "$OUT_DIR/claim-ids.txt" | tr -d ' ') claim ids -> $OUT_DIR/claim-ids.txt"

# ── 2. Fetch claim rows (read-only SELECT) ────────────────────────────────────
# shellcheck disable=SC2046
npx dotenv-cli -e .env.local -- npx tsx scripts/ab-test-fetch-claims.ts \
  $(tr '\n' ' ' < "$OUT_DIR/claim-ids.txt") > "$OUT_DIR/claims.ndjson"
log "fetched $(wc -l < "$OUT_DIR/claims.ndjson" | tr -d ' ') claims -> $OUT_DIR/claims.ndjson"

# ── 3. Prompt builder — mirrors loop-corpus-promoter.sh build_prompt (openalex_v1) ──
build_prompt() {
  local claim_id="$1" claim_text="$2" emerged_at="$3" cited_by="$4" doi="$5" openalex_id="$6"
  cat <<PROMPT
You are expanding an epistemic receipt for an academic paper. The claim already has its baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the publication date) — do NOT duplicate it. Your job is to find what happened to this finding AFTER publication.

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
- Print the TypeScript file inline in your reply; do NOT attempt to create or write files with tools.

OUTPUT FORMAT — emit exactly this, nothing else after:

FILE:scripts/enrichments/enrich-corpus-openalex_v1-<slug>.ts
<TypeScript content>
END_FILE
PROMOTED:<N>
SKIPPED:<reason, only if skipping>
VERIFICATION_LOG:<url1 -> 200 | url2 -> 404/discarded>
PROMPT
}

# ── 4. One run: claim x model -> raw json + result text ──────────────────────
run_one() {
  local claim_json="$1" model="$2" tag="$3"
  local cid text emerged cited doi oaid pipeline txt_out json_out prompt out result

  cid=$(echo "$claim_json"     | jq -r '.id')
  pipeline=$(echo "$claim_json" | jq -r '.ingestedBy')
  txt_out="$OUT_DIR/${cid}-${tag}.txt"
  json_out="$OUT_DIR/${cid}-${tag}.json"

  if [ -s "$txt_out" ]; then log "  [$tag] $cid — exists, skipping"; return 0; fi
  if [ "$pipeline" != "openalex_v1" ]; then
    log "  [$tag] $cid — pipeline $pipeline not openalex_v1; excluded"
    echo "EXCLUDED: pipeline $pipeline" > "$txt_out"; return 0
  fi

  text=$(echo "$claim_json"   | jq -r '.text')
  emerged=$(echo "$claim_json" | jq -r '.claimEmergedAt // "unknown"')
  cited=$(echo "$claim_json"  | jq -r '.citedByCount // 0')
  doi=$(echo "$claim_json"    | jq -r '.doi // "not available"')
  oaid=$(echo "$claim_json"   | jq -r '.openalexId // ""')

  prompt=$(build_prompt "$cid" "$text" "$emerged" "$cited" "$doi" "$oaid")

  log "  [$tag] $cid — calling $model"
  local attempt
  for attempt in 1 2; do
    out=$(claude --allowedTools "WebSearch,WebFetch" --print \
      --model "$model" --output-format json "$prompt" 2>>"$OUT_DIR/errors.log") || true
    result=$(echo "$out" | jq -r '.result // empty' 2>/dev/null)
    if [ -n "$result" ]; then
      echo "$out" > "$json_out"
      echo "$result" > "$txt_out"
      log "  [$tag] $cid — done ($(echo "$out" | jq -r '.total_cost_usd // "?"') USD)"
      return 0
    fi
    log "  [$tag] $cid — invalid/empty (attempt $attempt/2), backing off 30s"
    sleep 30
  done
  echo "[$(date -u '+%FT%TZ')] FAILED after 2 attempts: $cid $model" >> "$OUT_DIR/errors.log"
  log "  [$tag] $cid — FAILED (left absent for resume)"
  return 0
}

# ── 5. Main loop ──────────────────────────────────────────────────────────────
TOTAL=$(wc -l < "$OUT_DIR/claims.ndjson" | tr -d ' ')
I=0
while IFS= read -r claim_json; do
  I=$((I + 1))
  log "claim $I/$TOTAL"
  run_one "$claim_json" "$MODEL_A" "$TAG_A"; sleep 5
  run_one "$claim_json" "$MODEL_B" "$TAG_B"; sleep 5
done < "$OUT_DIR/claims.ndjson"

log "all runs complete."
log "outputs: $OUT_DIR/<claimId>-{$TAG_A,$TAG_B}.txt (+ .json with usage/cost)"
log "next: summary/verdict is a separate analysis step (logs/ab-test/summary.md)."
log "reminder: nothing was applied — no apply-enrichment.ts, no DB writes."
