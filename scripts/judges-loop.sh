#!/usr/bin/env bash
# Runs CourtListener federal judges ingester on a continuous loop.
# Article III appointments: SCOTUS + all 13 circuits.
# --slow mode: 90s timeout, 10s between requests, 10 retries.
# Skips already-ingested records automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes (new appointments are rare; this tops up over time).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/judges-loop.log"
SLEEP_HOURS=12
LIMIT=500

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== judges-loop started (limit=$LIMIT, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

PASS=0

while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS (limit=$LIMIT) ---"

  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-judges.ts \
    --slow \
    --limit "$LIMIT" \
    2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"

  log "--- Pass $PASS complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
