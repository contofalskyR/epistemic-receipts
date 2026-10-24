#!/usr/bin/env bash
# seed-commit-trailers.sh — how much of the curated seed content's git history
# records an AI co-author: commits touching scripts/seed-*.ts, and the
# Co-Authored-By trailers on them, by model name. For docs/paper/numbers.md §4.
#   scripts/paper/seed-commit-trailers.sh > docs/paper/sql/out/seed-commit-trailers.out
set -euo pipefail
cd "$(dirname "$0")/../.."
echo "-- script: scripts/paper/seed-commit-trailers.sh"
echo "-- run:    $(date -u +%Y-%m-%dT%H:%M:%SZ) · git $(git rev-parse --short HEAD)"
echo
echo "commits touching scripts/seed-*.ts: $(git log --format=%H -- 'scripts/seed-*.ts' | wc -l | tr -d ' ')"
echo "commits with a Co-Authored-By: Claude trailer: $(git log --format=%H -i --grep='^Co-Authored-By: Claude' -- 'scripts/seed-*.ts' | wc -l | tr -d ' ')"
echo "first / last commit: $(git log --reverse --format=%ad --date=short -- 'scripts/seed-*.ts' | head -1) / $(git log -1 --format=%ad --date=short -- 'scripts/seed-*.ts')"
echo
echo "trailers by model:"
git log --format=%B -- 'scripts/seed-*.ts' | grep -i '^Co-Authored-By: Claude' | sed 's/ *<.*//' | sort | uniq -c | sort -rn
