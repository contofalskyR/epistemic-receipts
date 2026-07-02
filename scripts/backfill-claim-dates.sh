#!/usr/bin/env bash
# backfill-claim-dates.sh — perpetual loop to backfill claimEmergedAt for undated claims
# Uses Haiku (batches of 300) to extract/infer years from claim text
# Skips pure reference ontologies (chebi, rxnorm, mesh, pubchem, periodic_table, pdg_particles)

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/backfill-dates.log"
CURSOR_FILE="$PROJECT_DIR/logs/backfill-dates-cursor.json"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
BATCH_SIZE=300
TOTAL_UPDATED=0
ROUND=0

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

mkdir -p "$PROJECT_DIR/logs"

log "=== Date backfill loop starting (batch=${BATCH_SIZE}) ==="

while true; do
  ROUND=$((ROUND + 1))

  # Fetch batch of undated claims (skip reference ontologies)
  BATCH_FILE=$(mktemp /tmp/backfill-batch.XXXXXX)
  cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
const fs = require('fs');
const SKIP = ['chebi_v1','rxnorm_v1','mesh_v1','pubchem_v1','periodic_table_v1','pdg_particles_v1','wikidata_chips_v1','omim_v1',
  // handled by targeted script
  'jacar_v1','ofac_sdn_v1','taiwan_archives_v1','europeana_wwi_v1','uk_national_archives_v1','africanlii_v1','paclii_legislation_v1','loc_collections_v1','korea_legislation_v1','romania_cnsas_v1','impact_craters_v1',
  // handled by NARA script
  'nara_catalog_v1'];
let cursor = null;
try { cursor = JSON.parse(fs.readFileSync('$CURSOR_FILE','utf8')).cursor; } catch(e) {}
p.claim.findMany({
  where: { deleted: false, claimEmergedAt: null, ingestedBy: { notIn: SKIP } },
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
    log "All undated claims processed. Total updated: ${TOTAL_UPDATED}. Re-scanning immediately."
    if [ "$TOTAL_UPDATED" -gt "0" ]; then
      bash "$NOTIFY" "✅ Date backfill complete! Updated ${TOTAL_UPDATED} claims. Re-scanning."
    fi
    rm -f "$BATCH_FILE" "$CURSOR_FILE"
    TOTAL_UPDATED=0
    ROUND=0
    sleep 5
    continue
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
- OFAC sanctions by program: CUBA→1963, IRAN→1979, RUSSIA→2014, DPRK→2005, SYRIA→2004, VENEZUELA→2017, LIBYA→2011, UKRAINE→2014, BELARUS→2021
- NARA records: use decade inferable from subject (e.g. Vietnam War era→1965, WWII→1943, Cold War→1960)
- JACAR (Japanese diplomatic): extract year from title text
- Europeana WWI: default 1915 unless specific year visible
- Romania CNSAS (secret police files): default 1965-1989 era; use 1970 if no year in text
- Taiwan archives: extract year from title if present, else 1950
- Korea legislation: extract year from title if present
- UK National Archives: extract year from title/description
- If genuinely no way to estimate even a decade, omit the item
- Only return items with reasonable confidence

Items:
${FORMATTED}" 2>/dev/null)

  rm -f "$BATCH_FILE"

  # Parse response into valid updates
  UPDATES_FILE=$(mktemp /tmp/backfill-updates.XXXXXX)
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
    # Batch update via single SQL statement (avoids N round-trips)
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
    // Single batch UPDATE via VALUES list
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

  # Milestone ping every 2000 updates
  if [ "$((TOTAL_UPDATED % 2000))" -lt "$UPDATE_COUNT" ] && [ "$TOTAL_UPDATED" -ge "2000" ]; then
    MILESTONE_BREAKDOWN=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient} = require('@prisma/client');
const p = new PrismaClient();
p.claim.groupBy({
  by: ['ingestedBy'],
  where: { deleted: false, claimEmergedAt: { not: null }, ingestedBy: { notIn: ['chebi_v1','rxnorm_v1','mesh_v1','pubchem_v1','periodic_table_v1','pdg_particles_v1','wikidata_chips_v1','omim_v1'] } },
  _count: true,
  orderBy: { _count: { ingestedBy: 'desc' } },
  take: 5
}).then(r => {
  const lines = r.map(x => x.ingestedBy.replace(/_v[0-9]+$/,'') + ':' + x._count);
  console.log(lines.join(' | '));
}).finally(() => p.\$disconnect());
" 2>/dev/null)
    bash "$NOTIFY" "📅 Date backfill: ${TOTAL_UPDATED} claims dated
Top pipelines: ${MILESTONE_BREAKDOWN}"
  fi

  sleep 1
done
