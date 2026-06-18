#!/usr/bin/env bash
# Loop 5 v2: Settling curve auto-expander — era × geographic region cycling
# Drop-in replacement for loop-settling-curve.sh when Robert says "launch it"
# launchd keeps it alive (KeepAlive=true); the script itself loops forever.

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/settling-curve-loop.log"
DECISIONS_LOG="$PROJECT_DIR/logs/settling-curve-decisions.jsonl"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
RUN=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

while true; do
  RUN=$((RUN + 1))

  # ERA cycling — 7 time windows
  case $((RUN % 7)) in
    0) ERA="Ancient and Classical world (pre-500 CE)" ;;
    1) ERA="Medieval period (500–1400 CE)" ;;
    2) ERA="Early Modern (1400–1750)" ;;
    3) ERA="Industrial and Colonial era (1750–1900)" ;;
    4) ERA="WWI / WWII and interwar period (1900–1950)" ;;
    5) ERA="Cold War and postwar (1950–1990)" ;;
    6) ERA="Modern era (1990–present)" ;;
  esac

  # GEOGRAPHIC cycling — 10 regional lenses (independent of era, mod 10)
  # Together: 7 × 10 = 70 unique combinations before any full repeat
  case $((RUN % 10)) in
    0) GEO="Western Europe and the Mediterranean (Greece, Rome, France, Britain, Italy, Spain, Portugal)" ;;
    1) GEO="East Asia (Chinese dynasties, Japan, Korea, Vietnam)" ;;
    2) GEO="South Asia (Indus Valley, Maurya, Gupta, Mughal, British India, Ceylon)" ;;
    3) GEO="Islamic world and Middle East (Abbasid Caliphate, Ottoman Empire, Safavid Persia, Arabia)" ;;
    4) GEO="Sub-Saharan Africa (Mali Empire, Songhai, Great Zimbabwe, Kongo, Ethiopia/Axum, Swahili Coast)" ;;
    5) GEO="Pre-Columbian and colonial Americas (Maya, Aztec/Mexica, Inca, Mississippian, Caribbean, colonial Latin America)" ;;
    6) GEO="Southeast Asia (Khmer Empire, Majapahit, Srivijaya, Ayutthaya, Burma, Philippines)" ;;
    7) GEO="Central and Inner Asia (Mongol Empire, Silk Road cities, Timurid, Scythians, Steppe cultures)" ;;
    8) GEO="Eastern Europe and Russia (Byzantine Empire, Kievan Rus, Muscovy, Ottoman Balkans, Poland-Lithuania)" ;;
    9) GEO="Pacific, Oceania, and North America (Polynesia, Maori, Aboriginal Australia, Pacific Islander navigation, Indigenous North America)" ;;
  esac

  FOCUS="${ERA} — geographic focus: ${GEO}"
  RUN_TS=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
  log "=== run #${RUN} start | Era: ${ERA%(*} | Region: ${GEO%(*} ==="

  CURRENT_COUNT=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.claimStatusHistory.groupBy({by:['claimId'],_count:true}).then(r=>console.log(r.length)).finally(()=>p.\$disconnect());
" 2>/dev/null || echo "unknown")

  PROMPT="You are an autonomous agent expanding the Epistemic Receipts settling curve with new historical trajectories.

PROJECT: /Users/robclaw/Projects/epistemic-receipts
Focus area for this run: ${FOCUS}

You MUST prioritize events from the specified geographic region. If the region had little recorded epistemic activity in this era (e.g., Pacific cultures in the Classical period), find the most relevant dateable event you can from that region or an immediately adjacent one — do not silently fall back to Western European defaults.

Your job:
1. Think of 3-5 specific historical epistemic events in this focus area that meet ALL these strict criteria:
   - Dateable to a specific day or month (not just a decade or year range)
   - Has contemporaneous primary sources or contemporaneous accounts
   - Represents a clear epistemic transition (OPEN→RECORDED, RECORDED→SETTLED, SETTLED→REVERSED, etc.)
   - Non-interpretive (concrete facts, not historical analyses)
   - NOT already in the DB: read scripts/seed-human-history-trajectories.ts and check EVERY candidate against the existing list by event description AND year, not just externalId. Ask yourself: \"Is there any entry in the seed file that describes the same event on the same date, even if the externalId is phrased differently?\" If yes, SKIP that candidate — it is a duplicate regardless of what the externalId says.

2. VERIFY each candidate before adding it. For each source URL you plan to use:
   - Fetch the URL using the WebFetch tool or curl
   - Confirm the page exists (not 404/error) and actually contains information matching the claimed event and date
   - If the URL is paywalled, a DOI, or otherwise inaccessible, find an alternative open-access source (PubMed, PMC, archive.org, official government/institutional pages) that IS accessible and verify that one instead
   - DISCARD any trajectory where you cannot verify at least one source URL
   Only proceed to step 3 with trajectories that passed source verification.

3. For each verified trajectory, read scripts/seed-human-history-trajectories.ts to understand the format, then add it following EXACTLY the same structure as existing ones. Run:
   cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- npx tsx scripts/seed-human-history-trajectories.ts

4. Commit and push: git add -A && git commit -m 'trajectories: add [N] verified curves — [era] / [region]' && git push origin main

5. Output exactly this at the end (all four lines required):
ADDED:[N]
TITLES:[title1] | [title2] | ...
CONSIDERED:[all events you evaluated, comma-separated, including ones you rejected]
REASONING:[1-3 sentences: what you looked for in this era/region, what you discarded and why (bad URL / already in DB / not dateable / not epistemic), what made the added ones pass]

If you can't find any valid candidates that pass source verification, output:
ADDED:0
TITLES:none
CONSIDERED:[events you tried]
REASONING:[why all candidates failed — URL dead, already in DB, not precisely dateable, etc.]"

  OUTPUT=$(claude --model claude-opus-4-8 --print --permission-mode bypassPermissions --max-turns 30 "$PROMPT" 2>&1) || true
  echo "$OUTPUT" >> "$LOG"

  ADDED=$(echo "$OUTPUT" | grep "^ADDED:" | tail -1 | sed 's/^ADDED://' | tr -d ' ')
  TITLES=$(echo "$OUTPUT" | grep "^TITLES:" | tail -1 | sed 's/^TITLES://')
  CONSIDERED=$(echo "$OUTPUT" | grep "^CONSIDERED:" | tail -1 | sed 's/^CONSIDERED://')
  REASONING=$(echo "$OUTPUT" | grep "^REASONING:" | tail -1 | sed 's/^REASONING://')

  log "Run #${RUN} done. Added: ${ADDED:-0}"

  # Write structured decision log entry (one JSON object per line)
  mkdir -p "$PROJECT_DIR/logs"
  RAW_ESCAPED=$(echo "$OUTPUT" | python3 -c "import sys,json; print(json.dumps(sys.stdin.read()))" 2>/dev/null || echo '""')
  printf '{"run":%d,"ts":"%s","era":"%s","geo":"%s","added":%s,"titles":"%s","considered":"%s","reasoning":"%s","raw":%s}\n' \
    "$RUN" \
    "$RUN_TS" \
    "${ERA//\"/\\\"}" \
    "${GEO//\"/\\\"}" \
    "${ADDED:-0}" \
    "${TITLES//\"/\\\"}" \
    "${CONSIDERED//\"/\\\"}" \
    "${REASONING//\"/\\\"}" \
    "$RAW_ESCAPED" \
    >> "$DECISIONS_LOG"

  if [ "${ADDED:-0}" != "0" ] && [ "${ADDED:-0}" != "" ]; then
    bash "$NOTIFY" "🌊 Settling curve +${ADDED} new trajectories (run #${RUN})
🗺 ${ERA%(*} / ${GEO%(*}
📚 ${TITLES}
Total was ${CURRENT_COUNT} claimIds"
    # Archive log after every successful addition
    cp "$LOG" "$PROJECT_DIR/logs/settling-curve-$(date +%Y-%m-%d).log"
  fi

  # Minimal error-recovery buffer; each claude call takes 5-20 min so this is noise
  sleep 5
done
