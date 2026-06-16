#!/usr/bin/env bash
# Loop 7: Dead link replacement — finds dead source URLs, replaces via Wayback/CrossRef
# Runs every 24 hours via launchd.

set -euo pipefail

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/dead-links-loop.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
log "=== dead-links-loop start ==="

PROMPT="You are an autonomous agent fixing dead source URLs in Epistemic Receipts.

PROJECT: /Users/robclaw/Projects/epistemic-receipts

Your job:
1. Sample 500 source URLs from the DB:
   cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- node -e \"
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.\\\$queryRaw\\\`SELECT id, url FROM \\\"Source\\\" WHERE deleted=false AND url IS NOT NULL AND url NOT LIKE '%web.archive.org%' ORDER BY RANDOM() LIMIT 500\\\`.then(r=>r.forEach(x=>console.log(x.id+'|'+x.url))).finally(()=>p.\\\$disconnect());
\" 2>/dev/null

2. Check each URL with a 5s timeout HEAD request. Collect all that return 4xx/5xx or connection error.

3. For each dead URL:
   a. Try Wayback Machine: curl 'https://archive.org/wayback/available?url=URL' — use closest snapshot if available
   b. If the URL looks like a DOI path, try CrossRef API

4. For any URL where you found a replacement, update it:
   cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- node -e \"
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.source.update({where:{id:'ID'},data:{url:'NEW_URL'}}).then(()=>console.log('updated')).finally(()=>p.\\\$disconnect());
\"

5. Commit and push any changes.

6. Output:
DEAD:[N]
FIXED:[N]
SAMPLE_FIXED:[url1 → new_url1] | ..."

OUTPUT=$(claude --print --permission-mode bypassPermissions --max-turns 25 "$PROMPT" 2>&1) || true
echo "$OUTPUT" >> "$LOG"

DEAD=$(echo "$OUTPUT" | grep "^DEAD:" | tail -1 | sed 's/^DEAD://' | tr -d ' ')
FIXED=$(echo "$OUTPUT" | grep "^FIXED:" | tail -1 | sed 's/^FIXED://' | tr -d ' ')

log "Dead: ${DEAD:-?}, Fixed: ${FIXED:-0}"

if [ "${FIXED:-0}" != "0" ] && [ "${FIXED:-0}" != "" ]; then
  bash "$NOTIFY" "🔗 Dead link repair: ${DEAD:-?} dead found, ${FIXED} replaced via Wayback/CrossRef"
fi

log "=== done ==="
