# Briefing 19 — Session handoff → next Fable agent (2026-07-10, late evening)

Written by the Fable session that ran 2026-07-10 (the briefing-18 executor), at
Robert's request — the conversation hit token limits mid-closing-sequence.
Verify state against the repo and the terminal; don't rebuild; don't relitigate
briefing 18 §2/§4 or 17 §4. Dense on purpose. Read 18 (and 16's addenda) if
you need the how-we-got-here.

## 0. LIVE RIGHT NOW — pick this up first

**The corpus-wide axis backfill --execute is RUNNING in Robert's Terminal**
(`caffeinate -i npx dotenv-cli -e .env.local -- npx tsx
scripts/backfill-terminal-axis.ts --execute`), started ~evening, ETA 1.5–3 h.
Idempotent + resumable (skips fixed rows; if interrupted or Neon drops —
Neon cold-starts regularly, first attempt often fails, retry succeeds —
re-run the same command). Finish line = an `EXECUTED` block: scanned
1,579,951 / mismatches 825,803 / `updated:` ≈ high-700ks-to-825k (a Dispatch
partial run already fixed an early chunk; see §3).

When it finishes, resume the closing sequence at step 4 (§2).

## 1. Working mode (Robert-ratified — inherit ALL of this)

- **Clipboard-drive + screen-read.** computer-use access is granted this
  session (Terminal, click-tier; clipboardWrite). Pattern: put each command in
  his clipboard via write_clipboard → he Cmd-V + Enters → you READ results
  yourself (screenshot when Terminal visible, or the mounted repo's logs/ and
  file mtimes). He explicitly rejected paste-me-the-output ping-pong. Re-run
  request_access in a fresh session (retry immediately in the SAME turn when
  the terminal-tier warning comes back).
- **SINGLE-EXECUTOR RULE (briefing 18 §2, recorded):** Dispatch/Claude Code is
  RETIRED as a DB executor — it ran gated writes uninstructed while presenting
  as a relay. All DB commands go through Robert's terminal only.
- **Parallelize builds via subagents**, orchestrator line-reviews + commits.
  Constraints that bit us: agents share one working tree (disjoint file sets,
  no git commands in agents), and parallel `tsc` runs thrash the sandbox —
  tell agents to typecheck ONCE at the end. Never `pkill -f` a pattern that
  appears in your own command line.
- **Plain language.** He flags jargon ("I just don't understand this
  message"). Say what a command does in one sentence, then the command.
- Sandbox: no DB, no node-network, no push (git commit yes; `rm -f
  .git/index.lock` when locks go stale). Mac runs everything real.

## 2. The closing sequence — position: mid-step-3

1. ✅ Block B (runbook): prisma generate + `claim_subscriptions` migration
   APPLIED TO PROD + vitest 268/268 (ctgov 7/7) + tsc exit 0.
2. ✅ Axis dry run: 825,803 mismatches; RECORDED 779k.
   **STOP #1 ✅ resolved the long way:** gate breached → HOLD → census
   (`scripts/_census-axis-mismatch.ts`) → diagnosis: 110k stored-NULL first
   classifications + 669k corrections of an old blanket-SETTLED backfill
   (openalex 307k, nara 107k, worldbank 55k, ofac 17.7k… all observational
   pipelines whose Layer-1 canon is RECORDED) + 38k original
   CONTESTED→REVERSED leak → CLEARED wholesale, precondition = seq stamps
   (done; Pass A/B = 0, Pass C = 3 documented orphan-break claims, accepted
   residue). Gate amendment recorded in briefing 18 §2.
3. 🔶 Axis execute — RUNNING (§0).
4. ⬜ Merge + deploy (ONLY after the EXECUTED block):
   `git checkout main && git merge fable/ctgov-follow-axis && git push`
5. ⬜ **STOP #2** — Robert eyeballs the new homepage + adaptive timeline on
   prod (or early on the Vercel branch preview: vercel.com → project →
   Deployments → the fable/ctgov-follow-axis entry → Visit). Agent
   spot-checks: `/api/v1/claims?epistemicAxis=REVERSED` returns rows; a few
   known-reversed claim pages show Reversed badges; `/search?axis=REVERSED`
   filter works; ~10 OpenAlex retractions end-to-end (packet Phase 3 protocol).
6. ⬜ RCT cohort report first run (packet Phase 6, timeboxed ~2 operator
   weekends): `npx tsx scripts/rct-cohort-report.ts --query 'AREA[ConditionSearch]
   "heart failure" AND AREA[OverallStatus] COMPLETED' --max-pages 5`
   — first execution doubles as its test; hand-check 5 ORPHANED rows on
   clinicaltrials.gov per the report-footer protocol before believing numbers.
7. ⬜ Human-only, STILL OPEN after 4+ nudges: **Telegram BotFather `/revoke`**
   (token was hardcoded in-tree until scrubbed today — commit 62f0457 — and
   lives in git history forever) + **NARA key** re-issue.

## 3. Today's shipped state (verify via git log, don't re-do)

- **OFAC: CLOSED end-to-end** (briefing 16 + its two addenda): delistings
  pipeline + 27 arcs, additions date-backfill (8,750 designation dates,
  DAY-precision, notice provenance), Layer-1 baselines (8,750), audit
  17,723/17,750 green, weekly launchd cron LIVE and verified
  (com.epistemic-receipts.ofac-delistings, Mon 08:00, fail-closed wrapper).
- **er-kit patches 1–4 applied** on branch `fable/ctgov-follow-axis` (patch 3
  un-dropped by Robert — briefing 18 §2 records the reversal + rationale;
  stampClaimAxis now runs in-contract). Phase 4 7-value sweep done
  (SearchClient + MCP enum fixed). Phase 5 follow-claim UI wired. Phase 5½
  adaptive timeline built (subagent, fixture-verified).
- **FDA withdrawals pipeline BUILT + gated, never executed**
  (scripts/event-pipelines/fda-withdrawals.ts; decisions locked: §314.150(c)
  → NO transition; safety/efficacy → SETTLED→REVERSED @ effective date; no
  future-dated emissions). Next: preflight → CHECKPOINT 1 → pilot 25.
- **WHO EML script BUILT, parked on a Robert decision**: all 147 claims carry
  generic 2023-07 ingest dates; the null-guard means the backfill writes 0
  until he approves overwriting them with true first-added years (probe memo
  logs/who-eml-deletions-probe-2026-07-10.md; commit cc8a3b4).
- **Security**: billing F4 IDOR fix + apiKey expiresAt (6d0ee75, tests green
  in Block B), workflow SHA-pinning + CI injection + telegram env (62f0457),
  OWNER_CHAT_ID sweep (Robert's 3a9524e "new stuff").
- **V1 homepage** (3db40d7) — flags for Robert's eyeball: /?q= deep links now
  inert (optional middleware redirect), DOI CTA ghosted to /methodology (no
  Zenodo deposit exists), orphaned-trials pillar substituted with
  retracted-still-cited until the tracker ships.
- Axis-leak #5 fixed on main (resolveDisplayAxis on claim page + JSON-LD).
- Diagnostic/census scripts: _census-ofac-baselines, _census-axis-mismatch,
  ofac-additions-planned/residue JSONLs + notice cache in logs/ (gitignored,
  Mac-local receipts).

## 4. Backlog after the closing sequence (rough order)

FDA pilot → WHO decision+run → briefing-16-style addenda for both → Q5 tails
(74-DOI gentle retry, 2,530-row conflict curation design, npm audit babel
HIGH, reader sandboxed-iframe, CONSULTANT.md trim, Sentry bump, branch
protection + gitleaks, headline 1.62M-vs-1.76M, duplicates KEEP/DROP, 3
self-contradicting seeds, custom domain, launch sequence per
marketing/launch-research-report.md). Gated: book-foundation diagram (behind
V1 homepage ship), tracker UI/landing (behind RCT report looking good).
Next-session cron note: Monday 08:00 the delistings cron runs whatever's
checked out — post-merge that's main; if merge slips past Sunday, ensure main
is checked out anyway.

## 5. Non-negotiables — unchanged, briefing 18 §4 verbatim applies

Dates never invented · preflight-by-default, writes behind --execute ·
counts verified against the DB, never logs · no writes outside
lib/transition-contract (seq auto-assigned) · thread statuses never become
ClaimStatusHistory · classifier SYSTEM_PROMPT + computeStatus survive
verbatim · newsletter human-gated · bind-parameterized SQL only · no loose
fuzzy (skip+count) · audit after every write · gates are real — the census
saved a bad assumption today; keep stopping at them.

## 6. Robert (unchanged + today's additions)

<5 hrs/week; believe his screenshots; be honest, concise, plain; own mistakes
without collapsing. Additions: he wants maximum background building
(subagents) and minimum terminal ping-pong (clipboard mode); when he asks
"what's the status," answer from the screen/disk yourself before asking him
anything; when a gate breaches, show him the evidence and the ruling, not a
lecture.
