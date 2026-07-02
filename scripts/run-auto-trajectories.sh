#!/usr/bin/env bash
# Single run of the Layer-1 trajectory generator.
# Scheduling, single-instance guarantees, and retry cadence are launchd's job
# (see com.epistemicreceipts.auto-trajectories.plist). No while-loop, no sleep,
# no lockfile — this script runs once and exits.
set -u

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/auto-trajectories.log"
NOTIFY="$PROJECT_DIR/scripts/notify-telegram.sh"

# launchd provides a minimal environment — node/npx must be findable.
# Homebrew (Apple Silicon + Intel) covered below. If you use nvm, replace with
# the absolute path to your node bin dir, e.g. "$HOME/.nvm/versions/node/v20.x.x/bin".
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG"; }

log "=== run started (pid $$) ==="

OUTPUT=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- \
  npx ts-node --project tsconfig.scripts.json \
  scripts/ingest-auto-trajectories.ts 2>&1)
STATUS=$?

# Full output — stdout AND stderr — always lands in the log.
# (The old loop captured stderr into a variable and then discarded it,
# which is how compile errors went invisible.)
echo "$OUTPUT" >> "$LOG"

if [ "$STATUS" -ne 0 ]; then
  log "run FAILED (exit $STATUS)"
  [ -f "$NOTIFY" ] && bash "$NOTIFY" "❌ Trajectory run failed (exit $STATUS) — see $LOG" 2>/dev/null
  exit "$STATUS"
fi

INSERTED=$(echo "$OUTPUT" | grep -oE 'Grand total: [0-9]+' | grep -oE '[0-9]+' | tail -1)
INSERTED=${INSERTED:-0}
log "run ok — inserted $INSERTED"

# Ping only when there is something to say. Idle hourly runs stay silent.
if [ "$INSERTED" -gt 0 ] && [ -f "$NOTIFY" ]; then
  bash "$NOTIFY" "⚡ Trajectories: +$INSERTED this run" 2>/dev/null
fi

exit 0
