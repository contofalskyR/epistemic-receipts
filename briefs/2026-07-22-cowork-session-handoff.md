# Handoff — Cowork session 2026-07-20 → 07-22 (Claude → successor model)

**To:** the next model working this repo with Robert (Cowork cloud session or otherwise)
**From:** Claude (Cowork), session `claude.ai/code/session_01RzCyaSqovxR4LGryVc2Sh3`
**Read first:** `AGENTS.md` (it is law here), then this file, then
`briefs/b18-cleanup-report.md` and `PUBLICATION-RUNBOOK-2026-07-22.md` (repo root).

---

## 1. Where the project stands (verified, not assumed)

- **CI is GREEN on main** (run #166+, first green since Jul 14). The six-day red
  streak was ONE line: B11-2's hand-written MemberIdeology migration declared
  `DEFAULT CURRENT_TIMESTAMP` on `updatedAt`; the model uses `@updatedAt` (no
  default) → NEW drift not in `.github/known-migration-drift.txt`. Fixed by
  allowlisting (house precedent: Claim/Collection/Org carry the identical line).
- **All 54 prod migrations applied** (owner's `migrate deploy` output). Follow
  table exists; the er_scoped_writes ROLE has NOT been created yet (deferred to
  the public-edition flip — the SQL file's password placeholder must be
  replaced in a temp copy first; never let the owner run it verbatim).
- **Nightly Integrity Check: cron KILLED** per owner (workflow_dispatch kept).
  Its post-tsx failure (~55s) is unexplained: either a stale `DATABASE_URL`
  secret or a real data-integrity finding. A manual dispatch will say which.
  Nobody has looked yet.
- **The site is live and current** (epistemic-receipts.vercel.app, lab edition).
  /canon shipped (658 papers ≥5k citations, 270 curved, 8 reversed), homepage
  has the Fig. 1 ball animation + carousel gradient minis, ideology scatter
  click-through works, histogram rows link to member pages.
- **Publication gates:** 1 (CI) done, 2 (prod DB) done. Remaining: 3 (B8
  go/no-go — owner runs it, tooling ready: `scripts/b8-route-sweep.ts`) and
  4 (B15 error rate — owner-only verdicts, tooling ready:
  `scripts/b15-review.ts` + `scripts/b15-compute-rate.ts`).

## 2. This session's commits (all on main unless noted)

- `12c21f7` fix: CI tsc error (recharts Scatter onClick → `.payload`), 22 eslint
  errors (18 settling-curve `<a>`→`<Link>`, quote escapes), nightly ts-node→tsx
- `5dc12d1` = merge of `loop/cleanup-b18-2026-07-21` (PR #21): B14/B16 stranded
  commits salvaged, B6 oEmbed/badge/report salvaged, promoter ledgers merged,
  briefs B8/B15/B16/B17 committed, B15 compute + /methodology conditional
  section, B8 sweep script, B17 /canon + census + owner-gated import scripts,
  b18-cleanup-report, `scripts/cleanup-stale-branches.sh`
- `66fc16d` canon first-load timeout fix (unstable_cache + single-pass steps
  aggregation — the /patterns B14 lesson; searchParams pages are dynamic, ISR
  alone does NOT cache their queries)
- `772454d` homepage animations (Fig. 1 SMIL ball + exemplar cards from
  `app/homeSlides.ts`; carousel gradient minis)
- `5dfd5a8` drift allowlist line + drift-lines-into-annotation + nightly kill
- `18baee1` animation polish (one-way carousel dot via CSS offset-path;
  Fig. 1 cards fade out at SETTLE_AT, hover-reveal via `.figcard` CSS,
  clickable to trajectories)
- `a186155` B15 keystroke review CLI ← may still be unpushed
- `1156ba8` curve-first hrefs (cards land on /settling-curve?t=<slug>) ← ditto

**Check first:** `git fetch origin && git log origin/main -3`. If `1156ba8` is
not on origin/main, the owner hasn't pushed the last bundle — his local repo
has it as branch `curve-links`; the command he was given is
`git push origin curve-links:main`.

## 3. How to work in this environment (hard-won, do not rediscover)

- **The Cowork sandbox cannot push to GitHub** (proxy is read-only for this
  repo; API calls return "add_repo" errors). Delivery pattern that works:
  commit on local main → `git bundle create x.bundle origin/main..main` →
  `SendUserFile` → `device_commit_files` to
  `/Users/robertrutgers/Projects/epistemic-receipts/x.bundle` →
  `device_bash: git fetch x.bundle main:<branch>` → owner runs
  `git push origin <branch>:main`. The stop-hook will nag about "unpushed
  commits" — that's expected; the bundle IS the delivery.
- **Prisma engines are unreachable from the sandbox** (binaries.prisma.sh 403
  via proxy). To get a REAL generated client for typechecking:
  stub the engine paths —
  `printf '#!/bin/sh\necho "schema-engine-cli <enginesVersion>"' > node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x && chmod +x` it,
  `touch node_modules/@prisma/engines/libquery_engine-debian-openssl-3.0.x.so.node`,
  move `prisma.config.ts` aside, then
  `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 PRISMA_QUERY_ENGINE_LIBRARY=<stub .so> PRISMA_SCHEMA_ENGINE_BINARY=<stub sh> npx prisma generate --schema prisma/schema.prisma`.
  Without this, tsc drowns in ~490 stub-client errors and you will chase ghosts.
- **No DB access from anywhere you control**: the sandbox can't reach Neon, and
  `device_bash` (owner's Mac VM) has NO network. DB-dependent scripts are
  written here, run by the owner in his real terminal.
- **GitHub Actions logs**: API blocked, but the PUBLIC HTML run pages work via
  WebFetch — `github.com/<repo>/actions/runs/<id>` shows jobs, durations, and
  error ANNOTATIONS (which now include drift lines, thanks to `5dfd5a8`).
  Run IDs come from fetching the workflow page. The badge.svg trick fails
  (image not supported).
- **The live site**: robots disallows `/api/*` — never curl around it (AGENTS
  rule). Crawlable pages via WebFetch are fine and cached 15 min per URL
  (cache-bust with `?v=N` when re-checking).
- **The owner's Mac checkout** should be on `main` now — the openalex-promoter
  commits to whatever branch is checked out (that's how runs #74–78 got
  stranded on a b11 branch). If promoter commits appear on a side branch
  again, that's why. Several `*.bundle` files may still sit in the repo root —
  remind him to delete them after pushing.

## 4. Owner-gated — NEVER do these autonomously (AGENTS.md + brief contracts)

- Prod DB writes of any kind (OPENCLAW data doctrine; read
  `specs/OPENCLAW-DATA-DOCTRINE.md` before ANY Neon mutation).
- B15 verdicts: owner-only, circularity STOP condition. The CLI records his
  keystrokes; it must never suggest a verdict. A post-hoc agent CROSS-CHECK
  (flag disagreements for his second look) was offered and is legitimate.
- B17 C-3 import: dry-run → checkpoint memo → recorded owner yes → --execute.
- er_scoped_writes.sql: temp copy + real password, owner's terminal only.
- Editorial copy (nuance layers, honesty text) ships only with owner sign-off.

## 5. Open items, ranked

1. **Support gates 3–4** when the owner runs them (fix B8 sweep failures
   same-day; after B15 verdicts land, offer the agent cross-check pass).
2. **Nightly integrity manual dispatch** — one truthful log tells whether it's
   the secret or a real finding. If real: that's a data incident, treat per
   AGENTS incident conventions.
3. **Sourcemaps job** fails intentionally-tolerated (`continue-on-error`) for
   missing Sentry secrets — either add secrets or delete the job; it confuses
   run pages.
4. **Workflow deprecation warnings**: pinned actions run on Node 20 (deprecated,
   forced to 24) — bump `actions/checkout` / `setup-node` pins when convenient.
5. **247 eslint warnings** (unused vars) — mechanical cleanup, zero risk.
6. **b16-report / b17-report** unwritten (loop convention: every brief reports).
7. **Curate saccharin + leaded-gasoline trajectories** — their homepage cards
   currently fall back to search links (`app/homeSlides.ts` hrefs note which).
8. **Stale branches**: `scripts/cleanup-stale-branches.sh` after everything's
   pushed; review-first list printed, don't force it.
9. **Branch protection** on main requiring the `quality` check — PRs #16–20
   merged red, which is how the whole mess started. Recommend it again.

## 6. Working relationship notes

Robert moves fast, merges optimistically, screenshots instead of pasting logs,
and appreciates momentum — ship first, explain briefly, keep receipts (hashes,
run numbers, live-URL checks). He asked for design changes twice this session
and both times his instinct was right; when his ask collides with a house rule
(e.g. "can't B15 be automated?"), quote the rule back from HIS OWN briefs — he
wrote them and respects them. Verify everything you claim against the live
site or the run pages; this project's entire premise is receipts.
