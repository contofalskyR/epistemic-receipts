#!/usr/bin/env bash
# backfill-claim-dates-nara.sh — targeted backfill for NARA catalog records (126k claims)
# Runs in parallel with main + targeted scripts — zero cursor overlap (NARA-only filter)

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/backfill-dates-nara.log"
CURSOR_FILE="$PROJECT_DIR/logs/backfill-dates-nara-cursor.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
BATCH_SIZE=300
TOTAL_UPDATED=0
ROUND=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

mkdir -p "$PROJECT_DIR/logs"

log "=== NARA date backfill loop starting (batch=${BATCH_SIZE}) ==="

while true; do
  ROUND=$((ROUND + 1))

  BATCH_FILE=$(mktemp /tmp/backfill-nara-batch.XXXXXX)
  cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
const fs = require('fs');
let cursor = null;
try { cursor = JSON.parse(fs.readFileSync('$CURSOR_FILE','utf8')).cursor; } catch(e) {}
p.claim.findMany({
  where: { deleted: false, claimEmergedAt: null, ingestedBy: 'nara_catalog_v1' },
  select: { id: true, text: true, ingestedBy: true },
  take: $BATCH_SIZE,
  ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  orderBy: { id: 'asc' }
}).then(rows => {
  if (rows.length > 0) fs.writeFileSync('$CURSOR_FILE', JSON.stringify({cursor: rows[rows.length-1].id}));
  fs.writeFileSync('$BATCH_FILE', JSON.stringify(rows));
  console.log(rows.length);
}).catch(e => { fs.writeFileSync('$BATCH_FILE', '[]'); console.log(0); })
.finally(() => p.\$disconnect());
" 2>/dev/null
  COUNT=$(cat "$BATCH_FILE" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")

  if [ "$COUNT" = "0" ]; then
    log "NARA backfill complete. Total updated: ${TOTAL_UPDATED}."
    if [ "$TOTAL_UPDATED" -gt "0" ]; then
      bash "$NOTIFY" "✅ NARA date backfill complete! Updated ${TOTAL_UPDATED} claims."
    fi
    rm -f "$BATCH_FILE" "$CURSOR_FILE"
    exit 0
  fi

  FORMATTED=$(cat "$BATCH_FILE" | python3 -c "
import json, sys
rows = json.loads(sys.stdin.read())
for r in rows:
    text = r['text'][:200].replace('\n',' ')
    print(f\"ID:{r['id']} | TEXT:{text}\")
")

  RESPONSE=$(claude --print --model claude-haiku-4-5-20251001 --permission-mode bypassPermissions --max-turns 1 "Extract the year each NARA (National Archives) record was created or describes. Return ONLY a JSON array, no markdown.

Format: [{\"id\": \"<id>\", \"year\": <4-digit-integer>}, ...]

Rules:
- year = the year the document was created or the event occurred
- Look for 4-digit years in the title or description text
- Common NARA record groups: State Dept (RG59) → diplomatic cables 1940s-1990s; War Dept (RG107) → WWII era 1940-1945; NSA (RG457) → Cold War 1950s-1970s; Nuremberg (RG238) → 1945-1946; AEC/Manhattan (RG326) → 1942-1960s; Presidential Commissions (RG220) → 1950s-1990s; OSS (RG226) → 1942-1945; FBI (RG65) → varies widely
- If a year range is visible (e.g. 1943-1945), use the start year
- If only a decade is inferrable, use the middle year (e.g. 1960s → 1965)
- NARA records rarely predate 1900 or postdate 2000
- Omit items with no year signal at all

Items:
${FORMATTED}" 2>/dev/null)

  rm -f "$BATCH_FILE"

  UPDATES_FILE=$(mktemp /tmp/backfill-nara-updates.XXXXXX)
  echo "$RESPONSE" | python3 -c "
import json, sys, re
text = sys.stdin.read()
m = re.search(r'\[.*?\]', text, re.DOTALL)
if not m:
    print('[]')
    sys.exit()
try:
    data = json.loads(m.group())
    valid = [x for x in data if isinstance(x.get('id'), str) and isinstance(x.get('year'), int) and 1900 <= x['year'] <= 2010]
    print(json.dumps(valid))
except:
    print('[]')
" > "$UPDATES_FILE" 2>/dev/null

  UPDATE_COUNT=$(cat "$UPDATES_FILE" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")

  if [ "$UPDATE_COUNT" -gt "0" ]; then
    cd "$PROJECT_DIR" && UPDATES_FILE="$UPDATES_FILE" npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient} = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
const updates = JSON.parse(fs.readFileSync(process.env.UPDATES_FILE, 'utf8'));
const valuesList = updates.map(u => {
  const safeId = u.id.replace(/'/g, \"''\");
  const date = new Date(u.year, 0, 1).toISOString();
  return \"('\" + safeId + \"', '\" + date + \"'::timestamptz)\";
}).join(', ');
p.\$executeRawUnsafe(
  \"UPDATE \\\"Claim\\\" AS c SET \\\"claimEmergedAt\\\" = v.dt FROM (VALUES \" + valuesList + \") AS v(id, dt) WHERE c.id = v.id AND c.\\\"claimEmergedAt\\\" IS NULL\"
).finally(() => p.\$disconnect());
" 2>/dev/null

    TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATE_COUNT))
    log "Round #${ROUND}: updated ${UPDATE_COUNT}/${COUNT}. Running total: ${TOTAL_UPDATED}"
  else
    log "Round #${ROUND}: no confident dates in batch of ${COUNT}"
  fi

  rm -f "$UPDATES_FILE"

  if [ "$((TOTAL_UPDATED % 10000))" -lt "$UPDATE_COUNT" ] && [ "$TOTAL_UPDATED" -ge "10000" ]; then
    bash "$NOTIFY" "📅 NARA backfill: ${TOTAL_UPDATED}/126k claims dated"
  fi

  sleep 1
done
