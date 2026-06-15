#!/usr/bin/env bash
# CourtListener babysitter — checks if CL loop processes are running, restarts dead ones.
# Run by OpenClaw cron every 30 min.

set -euo pipefail

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG_FILE="/tmp/cl-babysitter.log"
ARCHIVED="$PROJECT_DIR/scripts/_archived-loops"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Returns 1 if no process matching the pattern is running
is_dead() {
  local pattern="$1"
  ! pgrep -f "$pattern" > /dev/null 2>&1
}

# Restart a loop script in background if it's dead
maybe_restart() {
  local name="$1"
  local script="$2"

  if is_dead "$name"; then
    log "DEAD: $name — restarting..."
    bash "$ARCHIVED/$name" >> "/tmp/${name%.sh}.log" 2>&1 &
    log "STARTED: $name (PID $!)"
    echo "RESTARTED:$name"
  else
    log "OK: $name running (PID $(pgrep -f "$name" | head -1))"
  fi
}

log "=== CL babysitter check ==="

maybe_restart "circuits-loop.sh" "$ARCHIVED/circuits-loop.sh"
maybe_restart "scotus-loop.sh"   "$ARCHIVED/scotus-loop.sh"
maybe_restart "bia-loop.sh"      "$ARCHIVED/bia-loop.sh"
maybe_restart "state-supreme-loop.sh" "$ARCHIVED/state-supreme-loop.sh"
maybe_restart "tax-loop.sh"      "$ARCHIVED/tax-loop.sh"
maybe_restart "disclosures-loop.sh" "$ARCHIVED/disclosures-loop.sh"

log "=== done ==="
