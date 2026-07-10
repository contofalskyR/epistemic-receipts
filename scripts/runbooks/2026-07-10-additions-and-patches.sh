#!/bin/zsh
# Runbook 2026-07-10 — OFAC additions chain + patch Phase 2 (one paste per block).
# set -e: any failing step halts the whole block. Gates pause for your Enter
# AFTER showing the output that justifies continuing. Ctrl-C at any pause aborts.
#
#   ./scripts/runbooks/2026-07-10-additions-and-patches.sh A     (additions chain)
#   ./scripts/runbooks/2026-07-10-additions-and-patches.sh B     (patch phase 2)
#
# Phase 3 (backfill dry run) is deliberately NOT in here — its STOP gate is
# "paste the summary to the session and wait", not "press Enter".

set -euo pipefail
cd "$(dirname "$0")/../.."

gate() {
  echo ""
  echo "── GATE: $1"
  read -r "?Press Enter to continue (Ctrl-C to abort)... "
}

block_a() {
  echo "=== Block A — OFAC additions chain ==="
  npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-additions-dates.ts --execute
  gate "additions execute finished — updated count sane, no unexpected residue?"
  npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/ingest-auto-trajectories.ts --pipeline ofac_sdn_v1 --dry-run
  gate "Layer-1 dry run — would-baseline count ≈ the additions updated count?"
  npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/ingest-auto-trajectories.ts --pipeline ofac_sdn_v1
  npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-delistings.ts --since 2026-06-04
  gate "delistings preflight — planned ≈ the old terminal-none residues (~11)?"
  npx dotenv-cli -e .env.local -- npx tsx scripts/event-pipelines/ofac-delistings.ts --since 2026-06-04 --execute
  npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --pipeline ofac_sdn_v1
  echo "=== Block A done — audit output above must be green. ==="
}

block_b() {
  echo "=== Block B — patch Phase 2 (branch: $(git branch --show-current)) ==="
  if [ "$(git branch --show-current)" != "fable/ctgov-follow-axis" ]; then
    echo "!! not on fable/ctgov-follow-axis — aborting"
    exit 1
  fi
  npx prisma generate
  npx dotenv-cli -e .env.local -- npx prisma migrate deploy
  npx vitest run tests/unit/
  gate "vitest — ctgov suite 7/7 and zero newly-failing pre-existing tests?"
  npx tsc --noEmit
  echo "=== Block B done — tsc exit 0 means the ClaimSubscription cascade cleared. ==="
  echo "Next (separate, hard STOP): npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-terminal-axis.ts"
  echo "Paste that dry-run summary to the session before ANY --execute."
}

case "${1:-}" in
  A) block_a ;;
  B) block_b ;;
  *) echo "usage: $0 A|B" ; exit 1 ;;
esac
