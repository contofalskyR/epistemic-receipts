#!/bin/zsh
# ofac-delistings-weekly.sh — forward-accrual cron for the OFAC delistings
# pipeline (briefing 18 Q1 step 5). Runs on the Mac (needs DB + network + tsx).
#
# FAIL-CLOSED, in order:
#   1. set -euo pipefail — any step failing aborts the run with a non-zero exit.
#   2. The pipeline itself fails closed: 0 links parsed on page 0 -> throws
#      before any write; deletions-heading-but-zero-entries -> stops with exit 2
#      (page drift never silently under-emits); undatable/unmatched -> residue,
#      never writes. Its state file (logs/ofac-delistings-last-run.json) only
#      advances on a clean execute, so a failed week is retried from the same
#      cursor next week.
#   3. audit-chain-integrity runs after every write and exits 1 on hard
#      violations, failing the whole run.
#   4. Idempotent by construction (deterministic transition ids + the
#      (claimId, toAxis, occurredAt) unique constraint) — re-runs are safe.
#
# Enable ONLY after briefing 16's gate sequence has passed (CHECKPOINT 1 memo,
# pilot --limit 25, Robert eyeballs 5 curves, full run, green audit).
#
# Schedule (pick one):
#   launchd:  ~/Library/LaunchAgents/com.epistemic-receipts.ofac-delistings.plist
#             (StartCalendarInterval: Weekday 1, Hour 8) pointing at this script
#   cron:     0 8 * * 1 /path/to/repo/scripts/cron/ofac-delistings-weekly.sh
#
# Receipts land in logs/ofac-delistings-cron-<date>.log (logs/ is gitignored).

set -euo pipefail

cd "$(dirname "$0")/../.."

LOG="logs/ofac-delistings-cron-$(date +%Y%m%d).log"
mkdir -p logs

{
  echo "=== OFAC delistings weekly accrual — $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
  npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-delistings.ts --execute
  echo "--- audit ---"
  npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ofac_sdn_v1
  echo "=== done (clean) ==="
} >> "$LOG" 2>&1
