# Briefing 17 — Session handoff → Fable 5 (2026-07-09, EOD)

Written by the Opus advisor session that ran today. You are a fresh Fable 5
agent picking this up cold; you know the codebase but were not in the
conversation. Everything below is committed + pushed EXCEPT a small uncommitted
set named in §1 — verify via the named docs/commits, don't rebuild or
relitigate. Dense on purpose.

## 0. First moves (do these before anything else)

1. **Commit the uncommitted set** (§1) — it's tsc-clean and low-risk.
2. **Confirm the security deploy** — the P0 fix is merged to `main` but may not
   be deployed yet. Verify (§3 SHIP): the two `/api/proxy/reader` curls.
3. The two **key rotations are Robert's** (§3 URGENT) — surface them, don't wait
   on them; they don't block the deploy.
4. Then it's Robert's **OFAC-vs-FDA** call (§4) or reviewing **Fable patches
   1/2/4** (§4) — your pick of productive next work.

## 1. Repo state (verify, don't rebuild)

- `main` @ **4d3f900**, pushed. The GitHub repo is now **PRIVATE** (Robert
  confirmed).
- **Uncommitted on `main` right now (commit these):**
  - `briefings/16-ofac-delistings-spec.md` (new — the OFAC spec)
  - `briefings/00-INDEX.md` (edit — added the 09–16 index)
  - `app/api/org/[orgId]/members/route.ts` + `lib/billing/email.ts` (Resend
    lazy-init, tsc-clean — fixes a build that throws when `RESEND_API_KEY` is unset)
  - (this file, `briefings/17-HANDOFF.md`)
- **Security P0 is MERGED but not verified-deployed** — see §3 SHIP.

## 2. What happened this session — four threads, all landed or cleanly staged

**Thread 1 — Whitepaper claims: CLOSED.** Both cited claims (Surgeon General
1964 `cmqwoxe6l07dy8o0y6xrs8xnv`, Müller 1939 `cmqoappnu03yxsadpa90nu942`) were
already fully built (real primary sources, dates, receipt-grade reasons) — only
the review stamp was missing. Stamped `humanReviewed=true / HIGH / robert`.
Scripts `review-stamp-whitepaper-claims.ts` + `inspect-claim-curves.ts` (committed
19ea8a5). The `currentStatus=DISPUTED` on those claims is a deprecated column at
its default — benign, ignore.

**Thread 2 — Phase A (OpenAlex↔CrossRef retraction DOI join): DONE.** 11,319
matched pairs → **5,525 RECORDED→REVERSED arcs inserted** (commit **70ac83b**).
Partition reconciles EXACTLY: 5,525 inserted + 3,190 alreadyReversed
(OpenAlex-native) + 2,522 conflicting-date + 74 persistent-403 skips + 8
before-emergence = 11,319. Residue in `logs/openalex-retraction-conflicts.jsonl`.
Audit green (E1/C1/C2/S1/A1/V1=0, one pre-existing D2). Counts recorded in
briefing 13's addendum. The 74 skips are the SAME DOIs each run (persistent
`doi.org` 403s — a plain re-run re-hits the wall; needs a gentler fetch/UA).

**Thread 3 — Axis leak: FIXED (read-time).** `Claim.epistemicAxis` is a 5-value
column that structurally can't hold `REVERSED`/`ABANDONED` (those live on
`ClaimStatusHistory.toAxis`), so the 5,525 retractions displayed/filtered as
`CONTESTED`. Fixed at READ time — `resolveDisplayAxis()` + `lib/effective-axis.ts`
(per-claim LATERAL, terminal `toAxis` in canonical seq order) across the topic
badge, `/v1/claims`, `/search`, `/api/topics/[slug]` (commit **e8886b0**). A
Fable patch series proposed a WRITE-time stamp instead (patch 3); **Robert chose
read-time and DROPPED patch 3** (less churn, avoids widening the column to 7
values corpus-wide). A **4th leak site** (`lib/search.ts`, 3 filters + display,
powers `/v1/search` + `/v1/verify`) was found and fixed in the security branch.

**Thread 4 — Security sweep + P0 ship.** Reconciled **four** audits (in-repo
`SECURITY-ASSESSMENT-2026-07-09.md` + OPUS1 + OPUS2 + `security-patches.diff`).
Executed the P0 packet via Dispatch on the Mac with STOP gates:
- **f432448** — fail-closed crons, snapshot-id allowlist, protobufjs RCE dropped
  (deleted dead `/api/search/semantic` + `@xenova` from the server bundle),
  DNS-resolving SSRF guard (`lib/ssrfGuard.ts`).
- **b6e7384** — reader proxy: **sanitize-html** + `redirect:"manual"` per-hop
  re-validation + a rate-limit rule.
- **4d3f900** — axis leak-site #4 (`lib/search.ts`) + 9 regression tests.
Merged to `main`, pushed, repo made private. 244/244 tests, build green.

## 3. The board (open, prioritized)

**URGENT — human only:** rotate the **Telegram bot token** (BotFather `/revoke`
— hardcoded in `scripts/notify-telegram.sh`, public ~3 weeks, in git history,
treat as compromised) + rotate the **NARA API key**. Repo-private is DONE.

**SHIP — verify the deploy:** the P0 fix is merged, not confirmed live. Once
Vercel shows `4d3f900` Ready (site = `epistemic-receipts.vercel.app` /
`www.robertcontofalsky.com`), run:
`/api/proxy/reader?url=http://169.254.169.254/` → expect **403**; and
`?url=https://en.wikipedia.org/wiki/Retraction` → expect **reader JSON, not a
500**. The reader path is the one regression risk (sanitize-html's first live
deploy; it avoids jsdom, which crashed this exact function on 2026-07-06).

**COMMIT:** the §1 uncommitted set.

**Security backlog** (from the reconciled sweep): *P1* — `npm audit fix` (babel
HIGH), Stripe billing F4 (users can't subscribe today + IDOR-risk on the naive
fix — session-gate + org-membership), `verifyApiKey` `expiresAt` unenforced.
*P2* — reader sandboxed-iframe (mXSS backstop), `OWNER_CHAT_ID`→env, `git rm`
the `.bak` + `.pipeline-*.log`, trim CONSULTANT.md, Sentry v10 bump (20
moderates), pin GH actions to SHAs, CI script-injection, branch protection +
pre-commit gitleaks.

**Feature work — Fable patch series** (`epistemic-receipts-patches.zip`,
uploaded): patch 3 DROPPED. Remaining: **patch 1** (ctgov adapter — apply,
verify 7/7), **patch 2** (claim-follow: ClaimSubscription + subscribe route +
Mon cron — apply + wire the "Follow this claim" UI), **patch 4** (RCT cohort
report — apply + run the first bounded cohort; the strategic shakedown; needs
clinicaltrials.gov network). Guardrail: no patch touches
`dropped_story_classifier.ts` (verified).

**Decision (Robert's):** next pipeline — **OFAC** (spec ready = briefing 16,
feed-probe-first) vs **FDA withdrawals** (briefing 13 Phase B).

**Tails:** Phase A residue (74-DOI gentle-fetch retry; the 2,530-row conflict
curation queue). Pre-existing launch backlog (headline-count 1.62M vs 1.76M,
duplicates KEEP/DROP, the 3 self-contradicting seed claims, custom domain, the
launch sequence in `marketing/launch-research-report.md`).

## 4. Decisions — do NOT relitigate

- **Axis = read-time, stamp dropped.** Fragile by nature (each new
  `epistemicAxis` read can re-leak — that's how #4 happened). Mitigation:
  `lib/effective-axis.ts` / `resolveDisplayAxis` is THE enforced pattern; any new
  axis read must use it. If leaks keep appearing, patch-3's write-time stamp is
  the escalation, not a redo.
- **Sanitizer = sanitize-html, NOT DOMPurify.** jsdom crashes this Vercel
  function at module load (documented in the reader route header, 07-06);
  DOMPurify no-ops on a linkedom window (verified — the acceptance test caught
  it). sanitize-html is DOM-free and serverless-safe.
- **The advisor/executor STOP-gate protocol works.** It caught a wrong advisor
  prescription (dompurify+linkedom) mid-flight. Keep the gates.

## 5. Execution reality (this determines what you can DO vs route)

A Cowork/Fable session's shell is a **Linux sandbox** that **cannot run this
repo's tsx / Prisma / vitest / next** (its `node_modules` ships only macOS +
linux-x64 binaries; no DB, no external network). It **can**: write docs/specs,
edit files, read git, and run `tsc --noEmit` (typecheck works). The **Mac**
(Claude Code / Dispatch) runs everything real — DB, build, deploy, `git am`,
network. So: DO the docs/specs/reviews/tsc-verified edits yourself; hand
DB/build/deploy to the Mac behind STOP gates. **Robert dislikes over-deferral —
do what the sandbox can before routing.**

## 6. Non-negotiables (inherited)

Dates never invented (undatable → residue). Preflight-by-default; writes only
behind `--execute`. Verify counts against the DB, never the logs. Audit after
every write. No writes outside `lib/transition-contract`; `seq` is auto-assigned,
never hand-written. Thread statuses NEVER become `ClaimStatusHistory` rows
(tracker is phase 2, behind the T3 guard + T7 shadow gate). The
classifier `SYSTEM_PROMPT` + `computeStatus` survive verbatim. Newsletter
human-gated forever. Bind-parameterized SQL only.

## 7. Robert (working relationship)

Cognitive-psychology PhD student (Rutgers), **<5 hrs/week**, building toward an
education-consulting company; the site is his **research instrument** (1.8M dated
epistemic-status transitions — an operationalization his field lacks). Earlier
launch anxiety was steadied by the "launch = a 90-day probe with kill signals,
near-zero cost basis" framing. Work style: **one command at a time**; **believe
his screenshots** over your expectations; be honest and concise; own mistakes
without collapsing into deferral; protect his limited time (sequence hard, don't
create busywork).

## 8. Commits / artifacts of record

`70ac83b` Phase A · `19ea8a5` docs+tooling (briefings 14/15 + review scripts) ·
`e8886b0` axis-leak read-time · `f432448`/`b6e7384`/`4d3f900` security P0 ·
briefing 13 addendum (Phase A counts) · `briefings/16` OFAC spec · the three
`SECURITY-ASSESSMENT-2026-07-09*.md` + `security-patches.diff` ·
`logs/openalex-retraction-conflicts.jsonl` (Phase A residue).

## Addendum (2026-07-10, Fable 5 session)

- §1 uncommitted set committed as `2ceec0d`, pushed by Robert.
- **§3 SHIP: VERIFIED LIVE** — Robert ran both curls post-push:
  metadata-IP → `403`; Wikipedia → reader JSON (`{"embeddable":true,"title":
  "Retraction",...}` with sanitize-html content). SSRF guard + reader path
  confirmed on the deployed build.
- OFAC probe (briefing 16 checkpoint) done: verdict **DATABLE**, memo at
  `logs/ofac-feed-probe-2026-07-10.md`. Key caveat: active-snapshot corpus →
  only post-June-2026 delistings matchable (tens of arcs, accruing forward).
  STOPPED at the checkpoint pending Robert's build-vs-cron call.
- Still open: Telegram + NARA rotations (Robert); three untracked files
  (`SECURITY-ASSESSMENT-2026-07-09.md`, `fable-cover-prompt.md`,
  `tsconfig.checkonly.json`) awaiting a commit/discard call.
