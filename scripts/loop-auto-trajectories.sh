#!/usr/bin/env bash
# Internal settling curve loop — deterministic, no LLM.
# Processes existing DB claims into ClaimStatusHistory rows via pipeline templates.
# Pings Telegram every PING_EVERY trajectories inserted.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/auto-trajectories-loop.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
LOCKFILE="/tmp/auto-trajectories-loop.lock"
RUN=0
BATCH=500
CUMULATIVE=0
PING_EVERY=500
SINCE_LAST_PING=0
IDLE_PING_SENT=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

# Single-instance guard
if [ -f "$LOCKFILE" ] && kill -0 "$(cat "$LOCKFILE")" 2>/dev/null; then
  echo "Another instance already running (PID $(cat "$LOCKFILE")). Exiting."
  exit 1
fi
echo $$ > "$LOCKFILE"
trap 'rm -f "$LOCKFILE"' EXIT

log "=== Internal settling curve loop started (PID $$) ==="

while true; do
  RUN=$((RUN + 1))
  log "--- Run #${RUN} ---"

  OUTPUT=$(cd "$PROJECT_DIR" && BATCH_SIZE="$BATCH" npx dotenv-cli -e .env.local -- npx ts-node \
    --project tsconfig.scripts.json \
    scripts/ingest-auto-trajectories.ts 2>&1)
  STATUS=$?
  echo "$OUTPUT" >> "$LOG"

  if [ "$STATUS" -ne 0 ]; then
    log "Run #${RUN} FAILED (exit ${STATUS}) — sleeping 10m before retry"
    if [ -f "$NOTIFY" ]; then
      bash "$NOTIFY" "❌ Trajectory loop run #${RUN} failed (exit ${STATUS}). Sleeping 10m." 2>/dev/null
    fi
    sleep 600
    continue
  fi

  INSERTED=$(echo "$OUTPUT" | grep -oE 'Added [0-9]+ history' | grep -oE '[0-9]+' | awk '{s+=$1} END{print s+0}')
  GRAND=$(echo "$OUTPUT" | grep -oE 'Grand total: [0-9]+' | grep -oE '[0-9]+' | tail -1)
  [ -n "$GRAND" ] && INSERTED="$GRAND"

  log "Run #${RUN} done. Inserted: ${INSERTED}"

  if [ "$INSERTED" -eq 0 ] 2>/dev/null; then
    log "Nothing new — sleeping 1h before retry"
    if [ "$IDLE_PING_SENT" -eq 0 ] && [ -f "$NOTIFY" ]; then
      bash "$NOTIFY" "✅ Trajectory loop: all caught up. Total built: ${CUMULATIVE}. Checking hourly." 2>/dev/null
      IDLE_PING_SENT=1
    fi
    SINCE_LAST_PING=0
    sleep 3600
  else
    IDLE_PING_SENT=0
    CUMULATIVE=$((CUMULATIVE + INSERTED))
    SINCE_LAST_PING=$((SINCE_LAST_PING + INSERTED))

    if [ "$SINCE_LAST_PING" -ge "$PING_EVERY" ] && [ -f "$NOTIFY" ]; then
      bash "$NOTIFY" "⚡ Trajectories: +${INSERTED} this run | ${CUMULATIVE} total built this session" 2>/dev/null
      SINCE_LAST_PING=0
    fi

    sleep 5
  fi
done
