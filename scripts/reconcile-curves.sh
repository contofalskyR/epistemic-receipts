#!/usr/bin/env bash
# reconcile-curves.sh — settling curves BY DEFAULT.
#
# One idempotent pass that brings every claim's curve up to date with what the
# corpus deterministically knows. Safe to run nightly (launchd/cron) or after
# any ingest: every step is idempotent, preflight-guarded, and DB-verified by
# the scripts it calls. It creates baselines and deterministic transitions —
# it NEVER fabricates motion (born-settled facts stay honestly single-step).
#
# Steps:
#   1. Layer-1 baselines   — ingest-auto-trajectories.ts (new/newly-dated claims)
#   2. Wave 1              — vote/label certification completions
#   3. Wave 2              — retraction publication prepends (only if
#                            metadata.originalPublished coverage exists)
#   4. Wave 3              — bill lifecycles (enacted/failed/died-with-congress;
#                            automatically harvests each congress when it ends)
#   5. Completeness report — logged; UNCLASSIFIED pipelines raise a loud warning
#
# Usage:
#   ./scripts/reconcile-curves.sh            # full pass
#   DRY_RUN=1 ./scripts/reconcile-curves.sh  # preflights only, no writes
#
# Schedule (macOS launchd or cron), e.g. nightly at 04:15:
#   15 4 * * * cd $HOME/Projects/epistemic-receipts && ./scripts/reconcile-curves.sh >> logs/reconcile-curves.log 2>&1

set -uo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_DIR"
mkdir -p logs
LOG="logs/reconcile-curves.log"
NOTIFY="$PROJECT_DIR/scripts/notify-telegram.sh"
DRY_RUN="${DRY_RUN:-}"

RUN() { # RUN <label> <cmd...>
  local label="$1"; shift
  echo "── [$(date '+%Y-%m-%d %H:%M:%S')] $label"
  if "$@"; then
    echo "── $label: OK"
  else
    local rc=$?
    echo "── $label: FAILED (exit $rc)" >&2
    [ -x "$NOTIFY" ] && bash "$NOTIFY" "reconcile-curves: '$label' failed (exit $rc)" || true
    FAILURES=$((FAILURES + 1))
  fi
}

FAILURES=0
TSX="npx dotenv-cli -e .env.local -- npx tsx"

echo "════ reconcile-curves start $(date -u '+%Y-%m-%dT%H:%M:%SZ') ${DRY_RUN:+(DRY RUN)}"

# 1. Layer-1 baselines: give every claim its honest entry receipt.
if [ -n "$DRY_RUN" ]; then
  RUN "layer-1 baselines (dry)" $TSX scripts/ingest-auto-trajectories.ts --dry-run
else
  RUN "layer-1 baselines" $TSX scripts/ingest-auto-trajectories.ts
fi

# 2–4. Deterministic waves (each preflights internally; execute is idempotent).
# Wave 2 depends on metadata.originalPublished — refresh it first so newly
# ingested retractions get their publication dates (sweep skips claims that
# already carry the key; ~minutes when there's nothing new).
if [ -n "$DRY_RUN" ]; then
  RUN "retraction pub-dates (dry)" $TSX scripts/backfill-retraction-pub-dates.ts
  RUN "wave 1 preflight" $TSX scripts/bulk-promote-corpus.ts --wave 1
  RUN "wave 2 preflight" $TSX scripts/bulk-promote-corpus.ts --wave 2 --pub-date-key originalPublished
  RUN "wave 3 preflight" $TSX scripts/bulk-promote-corpus.ts --wave 3
else
  RUN "retraction pub-dates" $TSX scripts/backfill-retraction-pub-dates.ts --execute
  RUN "wave 1" $TSX scripts/bulk-promote-corpus.ts --execute --direct --wave 1
  RUN "wave 2" $TSX scripts/bulk-promote-corpus.ts --execute --direct --wave 2 --allow-entry-amend --pub-date-key originalPublished
  RUN "wave 3" $TSX scripts/bulk-promote-corpus.ts --execute --direct --wave 3
fi

# 5. Completeness report — the monitor. UNCLASSIFIED pipelines mean a new
# ingester shipped without a Layer-1 template + classification entry.
REPORT=$($TSX scripts/corpus-completeness-report.ts 2>&1) || FAILURES=$((FAILURES + 1))
echo "$REPORT" | tail -20
if echo "$REPORT" | grep -q "UNCLASSIFIED"; then
  if echo "$REPORT" | grep -q "⚠ UNCLASSIFIED"; then
    MSG="reconcile-curves: UNCLASSIFIED pipelines detected — a new ingester needs a Layer-1 template + lib/corpus-completeness.ts entry. See $LOG."
    echo "⚠️  $MSG" >&2
    [ -x "$NOTIFY" ] && bash "$NOTIFY" "$MSG" || true
  fi
fi

echo "════ reconcile-curves done $(date -u '+%Y-%m-%dT%H:%M:%SZ') — failures: $FAILURES"
exit $((FAILURES > 0 ? 1 : 0))
