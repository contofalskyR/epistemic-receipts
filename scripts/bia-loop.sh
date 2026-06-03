#!/usr/bin/env bash
# Runs CourtListener BIA precedent decision ingester on a continuous loop.
# --slow mode: 90s timeout, 10s between requests, 10 retries.
# Skips already-ingested records automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes to pick up newly published decisions.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/bia-loop.log"
SLEEP_HOURS=12
LIMIT=200
MIN_CITATIONS=5

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== bia-loop started (limit=$LIMIT, min-citations=$MIN_CITATIONS, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

while true; do
  log "--- Starting pass ---"
  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-bia.ts \
    --slow \
    --limit "$LIMIT" \
    --min-citations "$MIN_CITATIONS" \
    2>&1 | tee -a "$LOG_FILE" || log "Pass exited with error — continuing loop"

  log "--- Pass complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
