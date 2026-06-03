#!/usr/bin/env bash
# Runs CourtListener SCOTUS ingester on a continuous loop.
# Progressively lowers citation floor: starts at 5, drops to 2, then 0.
# --slow mode: 90s timeout, 10s between requests, 10 retries.
# Skips already-ingested records automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes to respect rate limits.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/scotus-loop.log"
SLEEP_HOURS=8
LIMIT=150

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== scotus-loop started (limit=$LIMIT, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

# Descending citation floors — once we've mostly exhausted a tier, lower the bar.
# Each pass uses --min-citations 5 until new records thin out, then 2, then 0.
MIN_CITATIONS=5
PASS=0

while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS (min-citations=$MIN_CITATIONS, limit=$LIMIT) ---"

  OUTPUT=$(npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-scotus.ts \
    --slow \
    --limit "$LIMIT" \
    --min-citations "$MIN_CITATIONS" \
    2>&1 | tee -a "$LOG_FILE") || log "Pass $PASS exited with error — continuing loop"

  # Extract ingested count from output to decide whether to drop citation floor
  INGESTED=$(echo "$OUTPUT" | grep -oE 'Ingested\s*:\s*[0-9]+' | grep -oE '[0-9]+' | tail -1 || echo "0")
  log "Pass $PASS complete — ingested=$INGESTED"

  # If we ingested fewer than 10 new records, lower the citation floor
  if [ "${INGESTED:-0}" -lt 10 ] && [ "$MIN_CITATIONS" -gt 0 ]; then
    if [ "$MIN_CITATIONS" -ge 5 ]; then
      MIN_CITATIONS=2
    elif [ "$MIN_CITATIONS" -ge 2 ]; then
      MIN_CITATIONS=0
    fi
    log "Low ingestion — dropping citation floor to min-citations=$MIN_CITATIONS"
  fi

  log "--- Sleeping ${SLEEP_HOURS}h before next pass ---"
  sleep "${SLEEP_HOURS}h"
done
