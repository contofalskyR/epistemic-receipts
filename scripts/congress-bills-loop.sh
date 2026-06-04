#!/usr/bin/env bash
# Perpetual loop for the Congress bills status tracker.
# Polls api.congress.gov, upserts 119th-Congress bill state (sponsor, latest action,
# status tag), and re-runs every SLEEP_HOURS hours.
# Idempotent: skips bills whose latestAction date is unchanged since the previous pass.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/congress-bills-loop.log"
SLEEP_HOURS=12
# 0 = no limit: fetch all 16k+ bills each pass, skipping unchanged ones (fast after first full sweep)
LIMIT=0

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== congress-bills-loop started (limit=$LIMIT, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

PASS=0
while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS (limit=$LIMIT) ---"

  if [ "$LIMIT" -eq 0 ]; then
    npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-bills-tracker.ts \
      2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"
  else
    npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-bills-tracker.ts \
      --limit "$LIMIT" \
      2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"
  fi

  log "--- Pass $PASS complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
