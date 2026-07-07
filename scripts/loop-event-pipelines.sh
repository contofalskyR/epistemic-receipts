#!/usr/bin/env bash
# Loop 7: Event-pipeline runner — auto-creates settling curves from structured feeds.
#
# The deterministic sibling of the curated research loops: no LLM, no judgment
# calls. Each pass re-runs the event pipelines (briefing 08) with --execute;
# they are idempotent (deterministic ids + unique constraint), so an unchanged
# feed no-ops and a feed update (new overruling, new refuted planet, new repeal)
# lands as new curves automatically. Every pass ends with a chain-integrity
# audit of the touched pipelines — a red audit pings Telegram loudly.
#
# Feeds move slowly (SCOTUS ~per term, exoplanet page ~monthly, NZ repeals
# ~weekly), so the default cadence is weekly. launchd keeps it alive.
#
# FIRST RUN IS STILL YOURS: pilot each pipeline once per the briefing-08 runbook
# before enabling this loop. NZ phase-apply mutates baseline rows, so it stays
# behind EVENT_LOOP_INCLUDE_NZ=1 until you've done its pilot.
#
# Env knobs:
#   SLEEP_HOURS             pass interval (default 168 = weekly)
#   EVENT_LOOP_INCLUDE_NZ   1 → also run nz-repealed-prepend fetch+apply
set -uo pipefail

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/event-pipelines-loop.log"
DECISIONS_LOG="$PROJECT_DIR/logs/event-pipelines-decisions.jsonl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
SLEEP_HOURS="${SLEEP_HOURS:-168}"
INCLUDE_NZ="${EVENT_LOOP_INCLUDE_NZ:-0}"
PASS=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
run() { (cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- npx tsx "$@") 2>&1; }

# Extract "inserted: N" style counts from a pipeline's summary block.
count_of() { echo "$1" | grep -oE "$2: *[0-9]+" | tail -1 | grep -oE '[0-9]+' || echo 0; }

mkdir -p "$PROJECT_DIR/logs"
log "=== event-pipelines loop started (sleep=${SLEEP_HOURS}h, nz=${INCLUDE_NZ}) ==="

while true; do
  PASS=$((PASS + 1))
  PASS_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  TOTAL_INSERTED=0
  AUDIT_RED=""
  SUMMARY=""

  log "=== pass #${PASS} start ==="

  # ── SCOTUS overrulings ──────────────────────────────────────────────────────
  OUT=$(run scripts/event-pipelines/scotus-overrulings.ts --execute) || true
  echo "$OUT" >> "$LOG"
  N=$(count_of "$OUT" "inserted")
  TOTAL_INSERTED=$((TOTAL_INSERTED + N))
  SUMMARY="${SUMMARY}scotus:+${N} "
  log "  scotus-overrulings: +${N} inserted"

  # ── Exoplanet retractions ───────────────────────────────────────────────────
  OUT=$(run scripts/event-pipelines/exoplanet-retractions.ts --execute) || true
  echo "$OUT" >> "$LOG"
  N=$(count_of "$OUT" "inserted")
  C=$(count_of "$OUT" "created")
  TOTAL_INSERTED=$((TOTAL_INSERTED + N))
  SUMMARY="${SUMMARY}exoplanets:+${N}(new claims ${C}) "
  log "  exoplanet-retractions: +${N} inserted, ${C} claims created"

  # ── NZ repeals (opt-in — pilot phase-apply once by hand first) ─────────────
  if [ "$INCLUDE_NZ" = "1" ]; then
    OUT=$(run scripts/event-pipelines/nz-repealed-prepend.ts --execute) || true
    echo "$OUT" >> "$LOG"
    OUT=$(run scripts/event-pipelines/nz-repealed-prepend.ts --phase apply --execute --allow-entry-amend) || true
    echo "$OUT" >> "$LOG"
    N=$(count_of "$OUT" "applied")
    TOTAL_INSERTED=$((TOTAL_INSERTED + N))
    SUMMARY="${SUMMARY}nz:+${N} "
    log "  nz-repealed-prepend: +${N} applied"
  fi

  # ── Post-pass verification (AGENTS.md: verify against the DB, not the logs) ─
  for P in courtlistener_scotus_v1 "event:exoplanet_retractions_v1" nz_repealed_acts_v1; do
    [ "$P" = "nz_repealed_acts_v1" ] && [ "$INCLUDE_NZ" != "1" ] && continue
    if ! run scripts/audit-chain-integrity.ts --direct --pipeline "$P" >> "$LOG" 2>&1; then
      AUDIT_RED="${AUDIT_RED}${P} "
      log "  ✗ AUDIT RED: ${P}"
    fi
  done

  # ── Decision log + notify ───────────────────────────────────────────────────
  printf '{"pass":%d,"ts":"%s","inserted":%d,"summary":"%s","auditRed":"%s"}\n' \
    "$PASS" "$PASS_TS" "$TOTAL_INSERTED" "${SUMMARY% }" "${AUDIT_RED% }" >> "$DECISIONS_LOG"

  if [ -n "$AUDIT_RED" ]; then
    bash "$NOTIFY" "🔴 Event pipelines pass #${PASS}: AUDIT RED on ${AUDIT_RED}— check ${LOG}"
  elif [ "$TOTAL_INSERTED" -gt 0 ]; then
    bash "$NOTIFY" "📈 Event pipelines pass #${PASS}: +${TOTAL_INSERTED} new curve transitions
${SUMMARY}
(residue files updated for the research loops)"
    (cd "$PROJECT_DIR" && git add logs/ && git commit -m "event-pipelines: pass #${PASS} logs (+${TOTAL_INSERTED})" && git push origin main) >> "$LOG" 2>&1 \
      || log "  (log commit skipped — nothing to commit or push failed)"
  fi

  log "=== pass #${PASS} done: +${TOTAL_INSERTED}, red: ${AUDIT_RED:-none}. Sleeping ${SLEEP_HOURS}h ==="
  sleep "${SLEEP_HOURS}h"
done
