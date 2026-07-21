#!/usr/bin/env bash
# B18 — remote branch hygiene. Run AFTER loop/cleanup-b18-2026-07-21 merges to main.
# Section 1 deletes branches whose commits are fully on main (merged or salvaged).
# Section 2 only PRINTS review-first candidates — delete those by hand if agreed.
set -euo pipefail

echo "Verifying cleanup branch is merged before deleting salvaged branches..."
git fetch origin
if ! git merge-base --is-ancestor origin/loop/cleanup-b18-2026-07-21 origin/main 2>/dev/null; then
  echo "ABORT: loop/cleanup-b18-2026-07-21 is not merged into origin/main yet."
  exit 1
fi

MERGED_OR_SALVAGED=(
  # merged via PRs
  loop/site-b3-2026-07-13
  loop/site-b4-2026-07-14
  loop/site-b5-2026-07-14
  loop/site-b7-2026-07-14
  loop/site-b9-2026-07-14
  loop/search-b10-2026-07-14
  loop/votes-b11c-2026-07-15
  loop/votes-b11d-2026-07-16
  loop/site-b12-2026-07-16
  loop/site-b13-2026-07-16
  loop/audit-b15-2026-07-16
  loop/aa3-hpylori-2026-07-11
  loop/aa4-reversals-2026-07-11
  fable/ctgov-follow-axis
  pr-1-ssr-claim-page
  pr-2-trajectory-ssr
  security/p0-sweep
  # tails salvaged by B18
  loop/site-b6-2026-07-14
  loop/site-b14-2026-07-16
  loop/site-b16-2026-07-16
  loop/votes-b11-2026-07-15
  loop/votes-b11b-2026-07-15
  # superseded by the merged cleanup branch itself
  fix/ci-green
)

for b in "${MERGED_OR_SALVAGED[@]}"; do
  if git ls-remote --exit-code --heads origin "$b" >/dev/null 2>&1; then
    echo "deleting origin/$b"
    git push origin --delete "$b"
  else
    echo "already gone: origin/$b"
  fi
done

echo ""
echo "REVIEW-FIRST candidates (NOT deleted — likely superseded, decide by hand):"
for b in \
  loop/findings-rct-2026-07-10 \
  loop/findings-fdaaa-2026-07-11 \
  loop/findings-aa1-2026-07-11 \
  loop/corpus-aa2-2026-07-11 \
  loop/aa5-dietaryfat-2026-07-11 \
  feat/alerts-mvp \
  build/pipeline-19-riksdag \
  build/pipeline-20-tweedekamer \
  build/2026-05-16-sec-edgar-pipeline \
  build/2026-05-17-federal-register-rules \
  ; do
  if git ls-remote --exit-code --heads origin "$b" >/dev/null 2>&1; then
    n=$(git rev-list --count origin/main..origin/"$b" 2>/dev/null || echo "?")
    echo "  origin/$b  (commits not on main: $n)   # git push origin --delete $b"
  fi
done
echo ""
echo "Notes: feat/alerts-mvp superseded by B12 /following; riksdag + tweedekamer"
echo "data already ingested per the pipeline registry; findings-*/corpus-aa*"
echo "were content-loop experiments — skim each diff before deleting."
