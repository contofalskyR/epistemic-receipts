#!/bin/bash
# run-census.sh — read-only DB census driver (findings/2026-07-11-db-census).
# Runs the repo's existing read-only census scripts + census-aggregates.ts,
# teeing all output into findings/2026-07-11-db-census/raw/. No DB writes.
# Run from repo root:  bash findings/2026-07-11-db-census/run-census.sh
set -uo pipefail
cd "$(dirname "$0")/../.."   # repo root
OUT="findings/2026-07-11-db-census/raw"
mkdir -p "$OUT"
STATUS="$OUT/status.txt"
: > "$STATUS"

run() {  # run <name> <cmd...>
  local name="$1"; shift
  echo "[$(date +%H:%M:%S)] START $name" | tee -a "$STATUS"
  if "$@" > "$OUT/$name.out" 2> "$OUT/$name.err"; then
    echo "[$(date +%H:%M:%S)] OK    $name" | tee -a "$STATUS"
  else
    echo "[$(date +%H:%M:%S)] FAIL  $name (exit $?)" | tee -a "$STATUS"
  fi
}

DOTENV=(npx dotenv-cli -e .env.local --)

run corpus-stats        "${DOTENV[@]}" npx tsx scripts/corpus-stats.ts
run db-quick-check      "${DOTENV[@]}" npx tsx scripts/_db-quick-check.ts
run census-aggregates   "${DOTENV[@]}" npx tsx findings/2026-07-11-db-census/census-aggregates.ts --direct
run test-curve-stats    "${DOTENV[@]}" npx tsx scripts/test-curve-stats.ts
run corpus-analysis     "${DOTENV[@]}" npx tsx scripts/corpus-analysis.ts
run census-dateless     "${DOTENV[@]}" npx tsx scripts/census-dateless-claims.ts --direct --top 12
run chain-integrity     "${DOTENV[@]}" npx tsx scripts/audit-chain-integrity.ts --direct

echo "[$(date +%H:%M:%S)] ALL DONE" | tee -a "$STATUS"
touch "$OUT/DONE"
