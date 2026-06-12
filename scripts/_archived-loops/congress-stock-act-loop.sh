#!/usr/bin/env bash
# Runs Congress STOCK Act disclosures ingester on a continuous loop.
# Currently uses curated seed list — see script header for API blockers.
# When Capitol Trades or Quiver Quantitative API is integrated, this loop
# will fetch new disclosures automatically.
# Sleeps SLEEP_HOURS between passes.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/congress-stock-act-loop.log"
SLEEP_HOURS=24

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== congress-stock-act-loop started (sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

PASS=0

while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS ---"

  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-stock-act.ts \
    --full \
    2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"

  log "--- Pass $PASS complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
