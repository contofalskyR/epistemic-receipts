#!/usr/bin/env bash
# Loop 5: Settling curve auto-expander — perpetual, no artificial interval
# launchd keeps it alive (KeepAlive=true); the script itself loops forever.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/settling-curve-loop.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
RUN=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

while true; do
  RUN=$((RUN + 1))

  # Rotate focus area based on run number mod 7 so consecutive runs hit different eras
  case $((RUN % 7)) in
    0) FOCUS="Ancient and Classical world (pre-500 CE): Greek, Roman, Persian, Chinese Han dynasty, Indian Maurya. Focus on medical, astronomical, philosophical discoveries." ;;
    1) FOCUS="Medieval and Islamic Golden Age (500–1400 CE): Arab scholars, Byzantine, Song dynasty China, medieval European science and religion." ;;
    2) FOCUS="Early Modern (1400–1750): Scientific Revolution, Reformation, Renaissance, New World contact, Ottoman Empire, Mughal India." ;;
    3) FOCUS="Industrial and Colonial era (1750–1900): Western science advances, germ theory, evolution, electricity, imperialism, abolition." ;;
    4) FOCUS="WWI / WWII and interwar period (1900–1950): Physics revolution, totalitarianism, Holocaust, atomic bomb, decolonization beginnings." ;;
    5) FOCUS="Cold War and postwar (1950–1990): Space race, civil rights, Vietnam, environmental movement, molecular biology, computing." ;;
    6) FOCUS="Modern era (1990–present): Internet, genomics, climate science, 9/11 aftermath, COVID-19, AI. Non-Western perspectives prioritized." ;;
  esac

  log "=== run #${RUN} start. Focus: ${FOCUS%:*} ==="

  CURRENT_COUNT=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.claimStatusHistory.groupBy({by:['claimId'],_count:true}).then(r=>console.log(r.length)).finally(()=>p.\$disconnect());
" 2>/dev/null || echo "unknown")

  PROMPT="You are an autonomous agent expanding the Epistemic Receipts settling curve with new historical trajectories.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
Focus area for this run: ${FOCUS}

Your job:
1. Think of 3-5 specific historical epistemic events in this focus area that meet ALL these strict criteria:
   - Dateable to a specific day or month (not just a decade or year range)
   - Has contemporaneous primary sources or contemporaneous accounts
   - Represents a clear epistemic transition (OPEN→RECORDED, RECORDED→SETTLED, SETTLED→REVERSED, etc.)
   - Non-interpretive (concrete facts, not historical analyses)
   - NOT already in the DB (read scripts/seed-human-history-trajectories.ts to see what's there)

2. For each valid candidate, read the existing trajectory seeder script at scripts/seed-human-history-trajectories.ts to understand the format

3. Add your new trajectories to that script following EXACTLY the same structure as existing ones, then run:
   cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- npx tsx scripts/seed-human-history-trajectories.ts

4. Commit and push: git add -A && git commit -m 'trajectories: add [N] new curves — [era/region]' && git push origin main

5. Output exactly this at the end:
ADDED:[N]
TITLES:[title1] | [title2] | ...

If you can't find any valid candidates for this focus area that aren't already in the DB, output:
ADDED:0
TITLES:none"

  OUTPUT=$(claude --print --permission-mode bypassPermissions --max-turns 30 "$PROMPT" 2>&1) || true
  echo "$OUTPUT" >> "$LOG"

  ADDED=$(echo "$OUTPUT" | grep "^ADDED:" | tail -1 | sed 's/^ADDED://' | tr -d ' ')
  TITLES=$(echo "$OUTPUT" | grep "^TITLES:" | tail -1 | sed 's/^TITLES://')

  log "Run #${RUN} done. Added: ${ADDED:-0}"

  if [ "${ADDED:-0}" != "0" ] && [ "${ADDED:-0}" != "" ]; then
    bash "$NOTIFY" "🌊 Settling curve +${ADDED} new trajectories (run #${RUN})
📚 ${TITLES}
Total was ${CURRENT_COUNT} claimIds"
  fi

  # Minimal error-recovery buffer; each claude call takes 5-20 min so this is noise
  sleep 5
done
