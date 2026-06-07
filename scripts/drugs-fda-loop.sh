#!/usr/bin/env bash
set -euo pipefail
LOG=/tmp/drugs-fda-loop.log
cd ~/Projects/epistemic-receipts
while true; do
  echo "[$(date)] --- drugs-fda refresh ---" | tee -a "$LOG"
  npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-drugs-fda.ts --full 2>&1 | tee -a "$LOG"
  echo "[$(date)] Done. Sleeping 24h." | tee -a "$LOG"
  sleep 86400
done
