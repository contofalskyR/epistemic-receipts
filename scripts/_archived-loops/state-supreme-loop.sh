#!/usr/bin/env bash
# Runs CourtListener state supreme court ingester on a continuous loop.
# Progressively lowers citation floor: starts at 20, drops to 10, then 5, then 0.
# --slow mode: 90s timeout, 10s between requests, 10 retries.
# Skips already-ingested records automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes to respect rate limits.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/state-supreme-loop.log"
SLEEP_HOURS=12
LIMIT=200

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== state-supreme-loop started (limit=$LIMIT, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

MIN_CITATIONS=20
PASS=0

while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS (min-citations=$MIN_CITATIONS, limit=$LIMIT) ---"

  OUTPUT=$(npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-state-supreme.ts \
    --slow \
    --limit "$LIMIT" \
    --min-citations "$MIN_CITATIONS" \
    2>&1 | tee -a "$LOG_FILE") || log "Pass $PASS exited with error — continuing loop"

  INGESTED=$(echo "$OUTPUT" | grep -oE 'Ingested\s*:\s*[0-9]+' | grep -oE '[0-9]+' | tail -1 || echo "0")
  log "Pass $PASS complete — ingested=$INGESTED"

  if [ "${INGESTED:-0}" -lt 10 ] && [ "$MIN_CITATIONS" -gt 0 ]; then
    if [ "$MIN_CITATIONS" -ge 20 ]; then
      MIN_CITATIONS=10
    elif [ "$MIN_CITATIONS" -ge 10 ]; then
      MIN_CITATIONS=5
    elif [ "$MIN_CITATIONS" -ge 5 ]; then
      MIN_CITATIONS=0
    fi
    log "Low ingestion — dropping citation floor to min-citations=$MIN_CITATIONS"
  fi

  log "--- Sleeping ${SLEEP_HOURS}h before next pass ---"
  sleep "${SLEEP_HOURS}h"
done
