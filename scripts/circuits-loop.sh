#!/usr/bin/env bash
# Runs CourtListener circuits ingester on a continuous loop.
# --slow mode: 90s timeout, 10s between requests, 30s between circuits, 10 retries.
# Skips already-ingested records automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes to pick up newly published opinions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/circuits-loop.log"
SLEEP_HOURS=12
LIMIT=100
MIN_CITATIONS=20

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== circuits-loop started (limit=$LIMIT, min-citations=$MIN_CITATIONS, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

while true; do
  log "--- Starting pass ---"
  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-circuits.ts \
    --slow \
    --limit "$LIMIT" \
    --min-citations "$MIN_CITATIONS" \
    2>&1 | tee -a "$LOG_FILE" || log "Pass exited with error — continuing loop"

  log "--- Pass complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
