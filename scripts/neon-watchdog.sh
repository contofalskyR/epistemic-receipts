#!/usr/bin/env bash
# Neon DB watchdog — runs a lightweight connectivity check and pings if it fails.
# Run by OpenClaw cron every 15 min.

set -euo pipefail

PROJECT_DIR="$HOME/Projects/epistemic-receipts"
LOG_FILE="/tmp/neon-watchdog.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

cd "$PROJECT_DIR"

# Simple count query — fast, hits pooler, confirms connectivity
RESULT=$(npx dotenv-cli -e .env.local -- node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.\$queryRaw\`SELECT 1 AS ok\`.then(r => { console.log('OK'); process.exit(0); }).catch(e => { console.error('FAIL:' + e.message); process.exit(1); });
" 2>&1) || true

if echo "$RESULT" | grep -q "^OK"; then
  log "DB OK"
  echo "DB_OK"
else
  ERROR=$(echo "$RESULT" | head -1)
  log "DB FAIL: $ERROR"
  echo "DB_FAIL:$ERROR"
fi
