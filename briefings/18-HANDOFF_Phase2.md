# Briefing 18 — Work-queue handoff (2026-07-10)

Written by the Fable 5 session of 2026-07-10, at Robert's request: "do all of
those." This is the execution queue for the next session(s). Read 17 (+ its
addendum) for how we got here; verify state against the repo, don't rebuild.
Robert's 2026-07-10 decision: the whole queue below is approved in principle —
the per-pipeline STOP checkpoints still apply (approval to *work the queue* is
not approval to skip gates).

## 0. State at handoff (verify)

- `main` @ **8afdc96** (`82c36ef` handoff addendum, `8afdc96` the three
  formerly-untracked files). Robert pushed through `8afdc96`'s predecessors;
  **verify `git status` + `git log origin/main..main` — if 82c36ef/8afdc96 are
  unpushed, that's Robert's one-liner `git push`.** Working tree was clean.
- **Security P0: CLOSED.** Merged, deployed, verified live 2026-07-10 (403 on
  metadata-IP, reader JSON on Wikipedia — see 17's addendum). Repo PRIVATE.
- **Rotations (human-only, may still be open): Telegram bot token + NARA API
  key.** Ask Robert; don't block on them.
- OFAC probe DONE, verdict **DATABLE** — memo `logs/ofac-feed-probe-2026-07-10.md`
  (gitignored, local to the Mac). Caveats C1 (re-check fetch with a real UA
  from the Mac) and C2 (active-snapshot corpus → only post-June-2026
  delistings matchable; ~tens of arcs initially, accruing forward).

## 1. The queue (in order)

### Q1 — OFAC delistings pipeline (briefing 16; probe already passed)
Robert's call 2026-07-10 = build it (small initial yield accepted; it accrues).
1. Mac pre-checks (read-only): direct curl of a removal notice with normal
   UA/Accept (C1) · `min(createdAt)` on `ofac_sdn_v1` claims to pin the
   snapshot date (C2).
2. Build `scripts/event-pipelines/ofac-delistings.ts` on the scotus-overrulings
   template; parse the **body heading** "The following deletions have been made
   to OFAC's SDN List" (not titles — fulltext enumerator over-matches);
   enumerator: `/recent-actions/sanctions-list-updates?search_api_fulltext=removals&page=N`
   (414 results, 42 pages, but only post-snapshot notices can match — start
   from the newest and stop at the snapshot date; earlier notices → residue).
3. Match name→DB (uid recovered from our metadata; exact-first, conservative
   fuzzy skip+count). Checkpoint 2 if match rate <70%.
4. Emit RECORDED→REVERSED, INSTITUTIONAL, occurredAt=notice date (DAY),
   marker=notice URL. CHECKPOINT 1 memo before first `--execute` → pilot
   `--limit 25` → Robert eyeballs 5 curves → full → audit
   `--pipeline ofac_sdn_v1`. Residue → `logs/ofac-delistings-residue.jsonl`.
5. **Then shape the forward accrual**: a weekly cron (or scheduled task) that
   re-runs the pipeline over notices newer than the last run. Design it
   idempotent (deterministic ids already are) so re-runs are safe. Cron must be
   **fail-closed** like the P0 crons.
6. Done = briefing 16's definition of done (counts pasted, 5-line addendum to
   briefing 16, one commit `curves ofac: ...`).

### Q2 — FDA withdrawals of approval (briefing 13 Phase B; SETTLED→REVERSED)
No spec beyond briefing 13 §Phase B yet. **Probe-first, NZ/OFAC-style**: find
the feed (Federal Register withdrawal notices / Drugs@FDA action dates), verify
dated withdrawal events + what they can match against in the corpus, memo at
the STOP checkpoint before building. Same contract, same guards, same audit.

### Q3 — WHO Essential Medicines List deletions (briefing 13 Phase C)
Same shape: probe (dated EML deletions per edition — precision likely YEAR or
edition-date), memo, then build only on a datable verdict.

### Q4 — Fable patches 1, 2, 4 (patch 3 stays DROPPED)
**Blocked on Robert re-uploading `epistemic-receipts-patches.zip`** (not in the
repo or uploads). Then: patch 1 ctgov adapter (apply, verify 7/7) → patch 2
claim-follow (ClaimSubscription + subscribe route + Mon cron + wire the
"Follow this claim" UI) → patch 4 RCT cohort report (apply + first bounded
cohort; needs clinicaltrials.gov network = Mac). Guardrail: no patch touches
`dropped_story_classifier.ts` — verify again after apply.

### Q5 — Tails (fit in when blocked on Robert/Mac)
- Phase A: 74-DOI retry with a gentler fetch/UA (same DOIs every run,
  persistent doi.org 403s) · the 2,530-row conflict curation queue (design a
  curation pass, don't hand-resolve 2,530 rows).
- Security backlog P1: `npm audit fix` (babel HIGH) · Stripe billing F4
  (session-gate + org-membership, IDOR-aware) · enforce `verifyApiKey`
  `expiresAt`. P2 list in briefing 17 §3.
- Launch backlog: headline-count 1.62M vs 1.76M, duplicates KEEP/DROP, 3
  self-contradicting seed claims, custom domain, launch sequence
  (`marketing/launch-research-report.md`).

## 2. Decisions in force (do NOT relitigate)

Everything in 17 §4 (read-time axis via `resolveDisplayAxis` — any new
`epistemicAxis` read uses it; sanitize-html not DOMPurify; STOP-gate protocol)
plus: **OFAC = build + forward cron** (Robert, 2026-07-10) · patch 3 stays
dropped · `logs/` stays gitignored (receipts live on the Mac).

Added 2026-07-10 (Robert, after the Q2 + additions probes — memos in logs/):
- **Patch 3 is UN-DROPPED (supersedes 17 §4 / 18 Q4 "stays dropped").** Robert,
  2026-07-10, on delivery of the er-kit execution packet: all 4 patches apply;
  the write-time stamp COEXISTS with the read-time layer (stamp is
  self-enforcing forward, read-time stays as safety net). Trigger: leak sites
  #4 and #5 within two days — exactly briefing 17's own escalation clause.
  Backfill remains behind its dry-run STOP gate (by-axis breakdown must be
  REVERSED/ABANDONED-dominated).
- **FDA withdrawals (Q2): §314.150(c) "no longer marketed" emits NO
  transition** — the approval judgment stands; only safety/efficacy grounds
  ((a)/(d)/accelerated-approval failures) emit SETTLED→REVERSED. occurredAt =
  the notice's legal EFFECTIVE date; never emit a future-dated transition
  (hold until effective).
- **OFAC additions date-backfill: BUILD NEXT** (before the FDA build).
  Writes claimEmergedAt on dateless ofac_sdn_v1 claims only; exact/alias
  matching only (no normalized tier); one-notice-per-claim rule; gated
  preflight → census → sample review → execute.
- **Axis-backfill gate AMENDED after breach + census (2026-07-10 evening).**
  Dry run found 825,803 mismatches, RECORDED-dominated (779k) — breaching the
  packet's "REVERSED+ABANDONED dominate" expectation. Census
  (`scripts/_census-axis-mismatch.ts`) split it: 110k = stored-NULL first
  classifications; 669k = SETTLED→RECORDED corrections of an earlier blanket
  backfill that had stamped observational/archival/literature pipelines
  SETTLED against Layer-1 canon (openalex 307k, nara 107k, worldbank 55k,
  ofac 17.7k, …); 38k = the original CONTESTED→REVERSED leak. Every ≥1k
  overwrite group verified against the template canon — trajectory wins on
  all. CLEARED to execute, preconditioned on backfill-transition-seq stamping
  the 8,748 NULL-seq rows (today's Layer-1 OFAC baselines, all single-row).
  Product consequence, deliberate: ~700k pages relabel Settled→Recorded.

## 3. Execution reality (unchanged from 17 §5, one addition)

Sandbox: docs/specs/edits/tsc/git-commit + **web_fetch works for feed probes**
(that's how the OFAC probe ran; JSON bodies and status codes are invisible
through it — route those checks to the Mac or ask Robert to curl). Sandbox
cannot: push (no creds), run tsx/Prisma/vitest/next, reach the network via
curl. **If `git commit` leaves stale `.git/*.lock` files ("Operation not
permitted" on unlink), call the file-delete permission tool and `rm` them —
happened 2026-07-10, fix took one approval.** Mac (Claude Code/Dispatch) runs
everything real, behind STOP gates. Do what the sandbox can before routing;
Robert dislikes over-deferral. One command at a time when handing Robert
terminal steps — and **no trailing `# comments`** on commands (zsh paste broke
on them 2026-07-10).

## 4. Non-negotiables (inherited verbatim from 17 §6)

Dates never invented (undatable → residue). Preflight-by-default; writes only
behind `--execute`. Verify counts against the DB, never the logs. No writes
outside `lib/transition-contract`; `seq` auto-assigned, never hand-written.
Thread statuses NEVER become `ClaimStatusHistory` rows. The classifier
`SYSTEM_PROMPT` + `computeStatus` survive verbatim. Newsletter human-gated
forever. Bind-parameterized SQL only. No loose fuzzy matches (skip+count).
Audit after every write.

## 5. Robert (unchanged — 17 §7)

<5 hrs/week; one command at a time; believe his screenshots; be honest and
concise; own mistakes without collapsing; sequence hard, no busywork.
