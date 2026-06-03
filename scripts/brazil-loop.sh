#!/usr/bin/env bash
# Perpetual loop for the brazil legislation ingester.
# Re-pulls bills/acts every SLEEP_HOURS hours. Idempotent: existing rows are skipped.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/brazil-loop.log"
SLEEP_HOURS=24

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== brazil-loop started (sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

PASS=0
while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS ---"

  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-brazil-legislation.ts \
    --full \
    2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"

  log "--- Pass $PASS complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
