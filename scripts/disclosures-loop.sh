#!/usr/bin/env bash
# Runs CourtListener financial disclosures ingester on a continuous loop.
# --slow mode: 90s timeout, 1500ms between requests, 10 retries.
# Skips already-ingested records automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes to pick up newly published forms.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/disclosures-loop.log"
SLEEP_HOURS=12
LIMIT=200

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== disclosures-loop started (limit=$LIMIT, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

while true; do
  log "--- Starting pass ---"
  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-disclosures.ts \
    --slow \
    --limit "$LIMIT" \
    2>&1 | tee -a "$LOG_FILE" || log "Pass exited with error — continuing loop"

  log "--- Pass complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
