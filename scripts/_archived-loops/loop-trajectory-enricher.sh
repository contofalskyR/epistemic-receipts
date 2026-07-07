#!/usr/bin/env bash
# ARCHIVED 2026-07-07 — DO NOT RUN. Predates the transition contract and is broken:
#   - insert template uses fromStatus/toStatus (schema fields are fromAxis/toAxis)
#   - community 'SCIENTIFIC' is not in the RatifyingCommunity enum
#   - no URL verification, no SKIP discipline, no apply-enrichment validation,
#     writes sourceId:null rows (below the receipt bar)
# Its job (adding missing intermediate transitions) is covered properly by
# loop-corpus-promoter.sh + scripts/apply-enrichment.ts, with row writes going
# through lib/transition-contract.ts. If a launchd plist still points here on
# the loop machine, unload it: launchctl bootout gui/$UID/<label>.
# Loop 6: Trajectory enricher — adds missing intermediate transitions to existing curves
# Runs every 12 hours via launchd.

set -euo pipefail

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG="/tmp/trajectory-enricher-loop.log"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NOTIFY="$SCRIPT_DIR/notify-telegram.sh"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"; }
log "=== trajectory-enricher-loop start ==="

PROMPT="You are an autonomous agent enriching existing Epistemic Receipts settling curves with missing intermediate transitions.

PROJECT: /Users/robclaw/Projects/epistemic-receipts

Your job:
1. Query the DB for trajectories (ClaimStatusHistory records) that have fewer than 3 transitions:
   Run: cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- node -e \"
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.claimStatusHistory.groupBy({by:['claimId'],_count:{id:true},having:{id:{_count:{lt:3}}}}).then(r=>r.slice(0,10).forEach(x=>console.log(x.claimId))).finally(()=>p.\$disconnect());
\" 2>/dev/null

2. For each claimId found, look up the claim text and existing transitions. Identify whether there is a well-documented intermediate epistemic step that is MISSING. For example:
   - If a trajectory goes OPEN → SETTLED, was there a RECORDED or CONTESTED phase with real dateable sources?
   - Only add transitions with verifiable sources and specific dates

3. For each legitimate intermediate transition you find, insert it via:
   cd /Users/robclaw/Projects/epistemic-receipts && npx dotenv-cli -e .env.local -- node -e \"
const {PrismaClient}=require('@prisma/client');
const p=new PrismaClient();
p.claimStatusHistory.create({data:{claimId:'ID',fromStatus:'OPEN',toStatus:'RECORDED',occurredAt:new Date('YYYY-MM-DD'),community:'SCIENTIFIC',reason:'...',sourceId:null}}).then(r=>console.log('inserted',r.id)).finally(()=>p.\$disconnect());
\"

4. Commit and push any changes.

5. Output:
ENRICHED:[N]
DETAILS:[claimId: added X→Y transition] | ..."

OUTPUT=$(claude --print --permission-mode bypassPermissions --max-turns 20 "$PROMPT" 2>&1) || true
echo "$OUTPUT" >> "$LOG"

ENRICHED=$(echo "$OUTPUT" | grep "^ENRICHED:" | tail -1 | sed 's/^ENRICHED://' | tr -d ' ')
DETAILS=$(echo "$OUTPUT" | grep "^DETAILS:" | tail -1 | sed 's/^DETAILS://')

log "Enriched: ${ENRICHED:-0} trajectories"

if [ "${ENRICHED:-0}" != "0" ] && [ "${ENRICHED:-0}" != "" ]; then
  bash "$NOTIFY" "🔗 Trajectory enricher: +${ENRICHED} intermediate transitions added
${DETAILS}"
fi

log "=== done ==="
