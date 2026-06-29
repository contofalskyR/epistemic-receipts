#!/usr/bin/env bash
# Perpetual Layer-1 trajectory loop — deterministic, no LLM.
# Processes one pipeline at a time in a round-robin, then sleeps.
# launchd or screen keeps this running.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/auto-trajectories-loop.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== auto-trajectories loop starting ==="

TOTAL_RUN=0

while true; do
  log "--- batch run start ---"

  OUTPUT=$(cd "$PROJECT_DIR" && \
    npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts \
    --batch 500 2>&1) || true

  echo "$OUTPUT" >> "$LOG"

  ADDED=$(echo "$OUTPUT" | grep "Grand total:" | grep -oE '[0-9]+' | head -1)
  ADDED=${ADDED:-0}
  TOTAL_RUN=$((TOTAL_RUN + ADDED))

  log "batch done. added=$ADDED total_run=$TOTAL_RUN"

  if [ "$ADDED" -gt "0" ] 2>/dev/null; then
    bash "$NOTIFY" "🌊 Auto-trajectories: +${ADDED} new history entries (session total: ${TOTAL_RUN})"
  fi

  # If nothing was added, all pipelines are exhausted — wait longer before re-checking
  if [ "${ADDED}" = "0" ]; then
    log "All pipelines exhausted. Sleeping 6h before re-check (for new ingests)..."
    sleep 21600
  else
    # Short pause between batches
    sleep 5
  fi
done
