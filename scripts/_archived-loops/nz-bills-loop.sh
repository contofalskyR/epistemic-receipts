#!/usr/bin/env bash
# Perpetual loop for the New Zealand bills ingester.
# Pulls NZ bills from the PCO Legislation API every SLEEP_HOURS hours.
# Idempotent: skips bills already in the DB.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/nz-bills-loop.log"
SLEEP_HOURS=12

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== nz-bills-loop started (sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

PASS=0
while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS ---"

  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-nz-legislation.ts \
    --mode bills \
    --full \
    2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"

  log "--- Pass $PASS complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
