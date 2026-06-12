#!/usr/bin/env bash
# Runs SEC Form 4 insider trading disclosures ingester on a continuous loop.
# Fetches recent Form 4 filings (purchases and sales only) from EDGAR.
# Rate-limited to 200ms between requests (10 req/sec max per SEC guidelines).
# Skips already-ingested transactions automatically (idempotent via externalId).
# Sleeps SLEEP_HOURS between full passes — new filings appear daily.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_FILE="/tmp/sec-form4-loop.log"
SLEEP_HOURS=12
DAYS=7
LIMIT=200

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== sec-form4-loop started (days=$DAYS, limit=$LIMIT, sleep=${SLEEP_HOURS}h) ==="

cd "$PROJECT_DIR"

PASS=0

while true; do
  PASS=$((PASS + 1))
  log "--- Pass $PASS (days=$DAYS, limit=$LIMIT) ---"

  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-sec-form4.ts \
    --full \
    --days "$DAYS" \
    --limit "$LIMIT" \
    2>&1 | tee -a "$LOG_FILE" || log "Pass $PASS exited with error — continuing loop"

  log "--- Pass $PASS complete. Sleeping ${SLEEP_HOURS}h before next run ---"
  sleep "${SLEEP_HOURS}h"
done
