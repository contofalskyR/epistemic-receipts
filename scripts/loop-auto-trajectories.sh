#!/usr/bin/env bash
# Perpetual Layer-1 trajectory loop — deterministic, no LLM.
# After each exhaustion cycle, runs an inline audit:
#   - finds pipelines with uncovered dated claims
#   - auto-generates missing templates via claude --print
#   - resets stuck cursors
#   - loops immediately if new pipelines were added
#   - sleeps 6h only when audit confirms nothing left to do

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/auto-trajectories-loop.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"
INGEST_SCRIPT="$SCRIPT_DIR/ingest-auto-trajectories.ts"
CURSOR_FILE="$SCRIPT_DIR/../logs/auto-trajectories-cursor.json"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }

log "=== auto-trajectories loop starting ==="

TOTAL_RUN=0

run_audit() {
  log "--- running inline audit ---"

  # Find pipelines with 5+ uncovered dated claims not in manual/seed categories
  UNCOVERED=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.\$queryRawUnsafe(\`
  SELECT c.\"ingestedBy\" as pipeline, COUNT(*) as count
  FROM \"Claim\" c
  WHERE c.deleted=false
    AND c.\"claimEmergedAt\" IS NOT NULL
    AND c.\"ingestedBy\" IS NOT NULL
    AND c.\"ingestedBy\" NOT IN ('manual','seed:human-history-trajectories')
    AND NOT EXISTS (
      SELECT 1 FROM \"ClaimStatusHistory\" h WHERE h.\"claimId\"=c.id
    )
  GROUP BY c.\"ingestedBy\"
  HAVING COUNT(*) > 5
  ORDER BY count DESC
\`).then(r=>{
  r.forEach(x=>console.log(x.pipeline+'\t'+Number(x.count)));
  return p.\$disconnect();
}).catch(e=>{console.error(e.message);process.exit(1);});
" 2>/dev/null)

  if [ -z "$UNCOVERED" ]; then
    log "audit: all pipelines covered"
    return 1  # nothing to do → caller will sleep
  fi

  log "audit: found uncovered pipelines:"
  echo "$UNCOVERED" | while IFS=$'\t' read -r pipeline count; do
    log "  $pipeline → $count"
  done

  NEW_ADDED=0
  CURSORS_TO_RESET=""

  while IFS=$'\t' read -r pipeline count; do
    [ -z "$pipeline" ] && continue
    if grep -q "\"$pipeline\"" "$INGEST_SCRIPT" 2>/dev/null; then
      # Has template but still uncovered — stuck cursor
      CURSORS_TO_RESET="$CURSORS_TO_RESET $pipeline"
    else
      # Missing template — generate via Claude Haiku
      log "audit: generating template for $pipeline ($count claims)..."
      TEMPLATE=$(claude --print --model claude-haiku-4-5-20251001 \
        "Pipeline: $pipeline ($count claims). Output ONLY a TypeScript object literal: { toAxis: \"SETTLED\"|\"RECORDED\"|\"REVERSED\"|\"CONTESTED\", community: \"INSTITUTIONAL\"|\"EXPERT_LITERATURE\"|\"JUDICIAL\"|\"PUBLIC\"|\"MARKET\", reason: \"One sentence.\" } — no markdown, no explanation." \
        2>/dev/null | tr -d '\n' | sed 's/^[[:space:]]*//')

      if echo "$TEMPLATE" | grep -q "toAxis"; then
        log "audit: appended template for $pipeline"
        python3 -c "
content = open('$INGEST_SCRIPT').read()
insert = '\n  $pipeline: $TEMPLATE,'
idx = content.rfind('};')
open('$INGEST_SCRIPT', 'w').write(content[:idx] + insert + '\n' + content[idx:])
"
        NEW_ADDED=$((NEW_ADDED + 1))
      else
        log "audit: claude failed for $pipeline — skipping"
      fi
    fi
  done <<< "$UNCOVERED"

  # Reset stuck cursors
  if [ -n "$CURSORS_TO_RESET" ]; then
    log "audit: resetting stuck cursors:$CURSORS_TO_RESET"
    python3 -c "
import json
try:
    c = json.load(open('$CURSOR_FILE'))
except:
    c = {}
for p in '$CURSORS_TO_RESET'.split():
    if p and p in c:
        del c[p]
        print(f'  reset: {p}')
json.dump(c, open('$CURSOR_FILE', 'w'), indent=2)
" 2>&1 | tee -a "$LOG"
    NEW_ADDED=$((NEW_ADDED + 1))
  fi

  if [ "$NEW_ADDED" -gt 0 ]; then
    log "audit: added $NEW_ADDED fixes — looping immediately"
    return 0  # caller will loop without sleeping
  else
    log "audit: no fixes possible this pass"
    return 1
  fi
}

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
    # Get coverage stats for the notification
    STATS=$(cd "$PROJECT_DIR" && npx dotenv-cli -e .env.local -- node -e "
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
Promise.all([
  p.claimStatusHistory.count(),
  p.claim.count({where:{deleted:false,claimEmergedAt:{not:null}}}),
  p.\$queryRawUnsafe('SELECT COUNT(DISTINCT c.\"ingestedBy\") as n FROM \"Claim\" c WHERE c.deleted=false AND c.\"claimEmergedAt\" IS NOT NULL AND c.\"ingestedBy\" NOT IN (\'manual\',\'seed:human-history-trajectories\') AND NOT EXISTS (SELECT 1 FROM \"ClaimStatusHistory\" h WHERE h.\"claimId\"=c.id) HAVING COUNT(*)>5')
]).then(([covered,total,uncov])=>{
  const pct=((covered/total)*100).toFixed(1);
  const gaps=uncov.length;
  console.log(covered+'|'+total+'|'+pct+'|'+gaps);
  return p.\$disconnect();
}).catch(()=>{console.log('?|?|?|?');});
" 2>/dev/null)
    COVERED=$(echo "$STATS" | cut -d'|' -f1)
    TOTAL=$(echo "$STATS" | cut -d'|' -f2)
    PCT=$(echo "$STATS" | cut -d'|' -f3)
    GAPS=$(echo "$STATS" | cut -d'|' -f4)
    GAPS_MSG=""
    [ "$GAPS" != "0" ] && [ "$GAPS" != "" ] && GAPS_MSG=" | ⚠️ ${GAPS} pipeline(s) still uncovered"
    bash "$NOTIFY" "🌊 Internal settling curve: +${ADDED} new entries
📊 Coverage: ${COVERED}/${TOTAL} (${PCT}%)${GAPS_MSG}"
    sleep 5
  else
    # Exhausted — run audit before deciding to sleep
    if run_audit; then
      # Audit found and fixed something — loop immediately
      sleep 5
    else
      log "All pipelines covered. Sleeping 6h..."
      sleep 21600
    fi
  fi
done
