# AA-1 decision brief — for Robert (estimated review time: ~20-30 min)

## What this is

`scripts/seed-smoking-cancer.ts` has a new "Step 7 (AA-1)" block (end of
`main()`) that proposes real `ClaimStatusHistory` transitions for the two
whitepaper-cited claims that currently show "Dormant · no revisions" and
"Score 50/100" (`AUDIT-WHITEPAPER-GAP-2026-07-03.md` §2). Nothing has been
written to the DB — I have no DB credentials in this worktree and never run
`--execute` per the AA-1 constraints.

## Why "Dormant · no revisions" specifically (not just the score)

Two independent defects, confirmed by reading the render path
(`app/claims/[id]/AdaptiveClaimTimeline.tsx`, `lib/transition-contract.ts`) —
not a DB query:
1. Zero `ClaimStatusHistory` rows → the timeline's dormant/no-activity label.
   Fixed by real transitions via `emitTransition()`.
2. `EdgeRevision.newScore` stuck at the pipeline default (50) → the
   unexplained score. **Not addressed in this pass** — I deliberately scoped
   this drop to the transitions, since that's the load-bearing fix for the
   audit's primary complaint (paper footnotes landing on UNREVIEWED receipts).
   Bumping Edge scores is a smaller, separable follow-up.

Full reasoning: `findings/2026-07-11-tobacco-whitepaper/diagnosis.md`.
Source verification: `findings/2026-07-11-tobacco-whitepaper/checks.md` — one
correction there: the brief's guessed Müller DOI/URL
(`.../10.1007/BF01623984`) was wrong; the real one is `10.1007/BF01633114`
(re-verified, see checks.md #1).

## Steps to review and approve-and-run

1. **Confirm the claim IDs are still current.**
   ```
   npx dotenv-cli -e .env.local -- npx tsx scripts/inspect-whitepaper-claims.ts
   ```
   Confirm `cmqwoxe6l07dy8o0y6xrs8xnv` is still the Surgeon General 1964 claim
   and `cmqoappnu03yxsadpa90nu942` is still Müller 1939, and that both still
   show 0 `statusHistory` rows (if either already has history, STOP — someone
   else already curated it, and this script would need to be reconciled first,
   not blindly run).

2. **Read the diff.** `git diff main -- scripts/seed-smoking-cancer.ts` — the
   new block is additive, at the end of `main()`, gated by `EXECUTE_TRANSITIONS
   = process.argv.includes('--execute')`. It touches only the two claim IDs
   above; it does not modify anything else in the file.

3. **Dry-run it, with `--aa1-only`** (default — no `--execute`):
   ```
   npx dotenv-cli -e .env.local -- npx tsx scripts/seed-smoking-cancer.ts --aa1-only
   ```
   ⚠️ **Always pass `--aa1-only`.** The pre-existing Steps 1-6 (parent claim, 6
   children, 18 sources, 19 edges, 3 threshold events, 3 meta-edges) use bare
   `prisma.create()` with no externalId dedup and already ran once in
   production — re-running the file *without* `--aa1-only` duplicates the
   whole flagship case study (the class of bug `DUPLICATE-TRAJECTORIES-2026-07-06.md`
   describes). I added the `--aa1-only` flag (skips straight to the new Step 7
   block) specifically so this can't happen by accident; it's covered by the
   `if (AA1_ONLY) { ... } else { ...Steps 1-6... }` branch near the top of
   `main()`.
   - The dry-run output will print `planned` (or `skipped` with violations)
     for each of the 5 transition rows — read every `violations` line before
     proceeding. A `skipped` from the live URL check (e.g. Springer rate-
     limiting `link.springer.com`) is expected/benign and just needs a retry.

4. **If the plan looks right, get a genuine yes to yourself**, then:
   ```
   npx dotenv-cli -e .env.local -- npx tsx scripts/seed-smoking-cancer.ts --aa1-only --execute
   ```

5. **Verify against DB state**, not the script's own counters (AGENTS.md
   rule): re-run `inspect-whitepaper-claims.ts` and confirm both claims now
   show 3 and 2 `statusHistory` rows respectively, `epistemicAxis: SETTLED`
   on both, and check the live claim pages
   (`/claims/cmqwoxe6l07dy8o0y6xrs8xnv`, `/claims/cmqoappnu03yxsadpa90nu942`)
   no longer say "Dormant."

6. **Follow-up (not in this drop):** the 50/100 Edge scores. If still present
   after step 5, that's the separate, smaller task noted above.

## What I explicitly did NOT do

- No DB writes, no `--execute`, no `.env.local` created or requested.
- No new Claim rows — both IDs are pre-existing and referenced by literal ID.
- No fabricated CONTESTED/industry-pushback transition after either claim's
  SETTLED resolution (see diagnosis.md's rationale — would misrepresent that
  the scientific consensus never reversed).
- No touch to `MATERIAL-QUEUE.md` / `MATERIAL-LOG.md` or any other worktree.
