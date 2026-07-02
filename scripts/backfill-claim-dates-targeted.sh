#!/usr/bin/env bash
# backfill-claim-dates-targeted.sh — high-yield targeted backfill for pipelines with
# predictable date patterns (JACAR, OFAC, Taiwan, Europeana WWI, UK National Archives, etc.)
# Runs in parallel with the main backfill-claim-dates.sh — zero cursor overlap (partitioned by pipeline)

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/backfill-dates-targeted.log"
CURSOR_FILE="$PROJECT_DIR/logs/backfill-dates-targeted-cursor.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
BATCH_SIZE=500
TOTAL_UPDATED=0
ROUND=0

# Pipelines with high date-extractability — do NOT overlap with main script's skip list
TARGET_PIPELINES="['jacar_v1','ofac_sdn_v1','taiwan_archives_v1','europeana_wwi_v1','uk_national_archives_v1','africanlii_v1','paclii_legislation_v1','loc_collections_v1','korea_legislation_v1','romania_cnsas_v1','impact_craters_v1']"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

mkdir -p "$PROJECT_DIR/logs"

log "=== Targeted date backfill loop starting (batch=${BATCH_SIZE}) ==="
log "=== Targeting: ${TARGET_PIPELINES} ==="

while true; do
  ROUND=$((ROUND + 1))

  # Fetch batch from targeted pipelines only
  BATCH_FILE=$(mktemp /tmp/backfill-targeted-batch.XXXXXX)
  cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
const fs = require('fs');
const TARGET = $TARGET_PIPELINES;
let cursor = null;
try { cursor = JSON.parse(fs.readFileSync('$CURSOR_FILE','utf8')).cursor; } catch(e) {}
p.claim.findMany({
  where: { deleted: false, claimEmergedAt: null, ingestedBy: { in: TARGET } },
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
    log "All targeted pipelines complete. Total updated: ${TOTAL_UPDATED}. Done."
    if [ "$TOTAL_UPDATED" -gt "0" ]; then
      bash "$NOTIFY" "✅ Targeted date backfill complete! Updated ${TOTAL_UPDATED} claims across JACAR/OFAC/Taiwan/etc."
    fi
    rm -f "$BATCH_FILE" "$CURSOR_FILE"
    exit 0
  fi

  # Format batch for prompt
  FORMATTED=$(cat "$BATCH_FILE" | python3 -c "
import json, sys
rows = json.loads(sys.stdin.read())
for r in rows:
    text = r['text'][:200].replace('\n',' ')
    print(f\"ID:{r['id']} | PIPELINE:{r['ingestedBy']} | TEXT:{text}\")
")

  # Ask Haiku to extract years
  RESPONSE=$(claude --print --model claude-haiku-4-5-20251001 --permission-mode bypassPermissions --max-turns 1 "Extract the year each record describes or was created. Return ONLY a JSON array, no markdown.

Format: [{\"id\": \"<id>\", \"year\": <4-digit-integer>}, ...]

Rules:
- year = when the event/document OCCURRED or was first recorded (not today)
- JACAR (Japanese diplomatic/military archives): extract 4-digit year from title text; these are 1930s-1945 records
- OFAC sanctions by program: CUBA→1963, IRAN→1979, RUSSIA→2014, DPRK→2005, SYRIA→2004, VENEZUELA→2017, LIBYA→2011, UKRAINE→2014, BELARUS→2021, IRAN_TRA→2019, GLOMAG→2016, CAATSA→2017, SDGT→2001, SDNTK→1999
- Taiwan archives: extract 4-digit year from title; most are 1950s-1990s Republic of China era
- Europeana WWI: extract year from metadata if present, else 1915
- Romania CNSAS (communist-era secret police): extract year from document if visible, else 1970
- UK National Archives: extract year from title or description
- Africa/Pacific legislation (africanlii, paclii): extract year from act title (e.g. 'Land Act 1979' → 1979)
- Korea legislation: extract year from title
- LoC collections: extract year from description or title
- Impact craters: use year of discovery/confirmation if mentioned, else omit
- If genuinely no way to determine even a decade, omit the item
- Be aggressive with JACAR and OFAC — near-100% of these are datable

Items:
${FORMATTED}" 2>/dev/null)

  rm -f "$BATCH_FILE"

  # Parse response into valid updates
  UPDATES_FILE=$(mktemp /tmp/backfill-targeted-updates.XXXXXX)
  echo "$RESPONSE" | python3 -c "
import json, sys, re
text = sys.stdin.read()
m = re.search(r'\[.*?\]', text, re.DOTALL)
if not m:
    print('[]')
    sys.exit()
try:
    data = json.loads(m.group())
    valid = [x for x in data if isinstance(x.get('id'), str) and isinstance(x.get('year'), int) and 1000 <= x['year'] <= 2026]
    print(json.dumps(valid))
except Exception as e:
    print('[]')
" > "$UPDATES_FILE" 2>/dev/null

  UPDATE_COUNT=$(cat "$UPDATES_FILE" | python3 -c "import json,sys; print(len(json.loads(sys.stdin.read())))" 2>/dev/null || echo "0")

  if [ "$UPDATE_COUNT" -gt "0" ]; then
    # Batch update via single SQL VALUES statement
    PIPELINE_STATS=$(cd "$PROJECT_DIR" && UPDATES_FILE="$UPDATES_FILE" npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient} = require('@prisma/client');
const fs = require('fs');
const p = new PrismaClient();
const updates = JSON.parse(fs.readFileSync(process.env.UPDATES_FILE, 'utf8'));
const ids = updates.map(u => u.id);
p.claim.findMany({ where: { id: { in: ids } }, select: { id: true, ingestedBy: true } })
  .then(claims => {
    const map = {};
    claims.forEach(c => { map[c.id] = c.ingestedBy; });
    const counts = {};
    updates.forEach(u => {
      const pipe = (map[u.id] || 'unknown').replace(/_v[0-9]+$/, '');
      counts[pipe] = (counts[pipe] || 0) + 1;
    });
    const valuesList = updates.map(u => {
      const safeId = u.id.replace(/'/g, \"''\");
      const date = new Date(u.year, 0, 1).toISOString();
      return \"('\" + safeId + \"', '\" + date + \"'::timestamptz)\";
    }).join(', ');
    return p.\$executeRawUnsafe(
      \"UPDATE \\\"Claim\\\" AS c SET \\\"claimEmergedAt\\\" = v.dt FROM (VALUES \" + valuesList + \") AS v(id, dt) WHERE c.id = v.id AND c.\\\"claimEmergedAt\\\" IS NULL\"
    ).then(() => {
      console.log(JSON.stringify(counts));
    });
  }).finally(() => p.\$disconnect());
" 2>/dev/null || echo "{}")

    TOTAL_UPDATED=$((TOTAL_UPDATED + UPDATE_COUNT))

    BREAKDOWN=$(echo "$PIPELINE_STATS" | python3 -c "
import json, sys
try:
    d = json.loads(sys.stdin.read())
    parts = [f'{k}:{v}' for k,v in sorted(d.items(), key=lambda x: -x[1])]
    print(' | '.join(parts[:5]))
except: print('unknown')
" 2>/dev/null)

    log "Round #${ROUND}: updated ${UPDATE_COUNT}/${COUNT} [${BREAKDOWN}]. Running total: ${TOTAL_UPDATED}"
  else
    log "Round #${ROUND}: no confident dates in batch of ${COUNT}"
  fi

  rm -f "$UPDATES_FILE"

  # Milestone ping every 5000 updates
  if [ "$((TOTAL_UPDATED % 5000))" -lt "$UPDATE_COUNT" ] && [ "$TOTAL_UPDATED" -ge "5000" ]; then
    bash "$NOTIFY" "📅 Targeted backfill: ${TOTAL_UPDATED} claims dated [${BREAKDOWN}]"
  fi

  # No sleep — these pipelines are high-yield and we want to finish fast
done
