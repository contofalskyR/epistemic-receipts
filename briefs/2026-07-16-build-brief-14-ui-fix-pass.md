# Build Brief #14 — UI fix pass (executes the audit findings)

**To:** RobClaw / the worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-16)
**Lane:** site/quality. **Zero database writes.**

## Amendments from B13 actual results (supersede the phase list below where they conflict)

1. **Already shipped in B13 — do NOT redo:** chamber normalization, custom 404, carousel prefers-reduced-motion. Skip those items wherever they appear in the phases.
2. **`/patterns` is a BUILD task, not a deploy investigation.** The page never existed despite B6's completion report. Build per B6-3's original spec (classifier partition must sum, "other" published), add to PUBLIC_ROUTES if absent. Record root cause in CONSULTANT.md — this escaped three verification layers.
3. **New first item in B14-1 (before everything else):** five curve consumers still order by `occurredAt` instead of `seq` (B13 P1-correctness finding). One `orderBy` swap each, with a regression test per ORDERING-SEMANTICS-2026-07-08.
4. **a11y contrast fix list from B13 folds into B14-4.**

---

This brief executes the merged findings of the two-layer UI audit: `briefs/b13-ui-audit-findings.md` (mechanical layer) and `briefs/b13-visual-audit-findings.md` (visual layer). Both are on main.

**Gate:** Brief #12 (follow & return) merged first — confirmed done.

**The standing hard rule:** render-side fixes only for anything data-adjacent. Any fix that seems to require a DB write is misclassified: STOP and flag it.

**Bookkeeping rule:** every finding in both findings files gets a status appended — `FIXED (commit)` / `DEFERRED (why)` / `OWNER-CALL (question)`. An unmarked finding is an unfinished brief.

---

## 0. Orientation

Sync main; read the newest fable-handoff; read both findings files in full; standing rails as always (branch `loop/site-b14-<date>`, `B14-n:` commits, ~400 lines/phase, push + PR, owner merges, no middleware/auth/CSP/schema, blocked beats invented).

## Phases

### B14-1 — The P0s + seq ordering (NEW first item per amendment 3)

0. **seq ordering fix (amendment 3, goes first):** B13 found 5 curve-rendering consumers still sorting by `occurredAt` instead of `seq`. Locate each, swap the `orderBy`, add a regression test per ORDERING-SEMANTICS-2026-07-08. These are P1-correctness: coarse-precision dates can render a settling curve in the wrong order.
1. **`/patterns` BUILD (amendment 2):** build the page per B6-3's original spec — classifier partition sums, "other" published, add to PUBLIC_ROUTES. Record root cause (never built/merged) in CONSULTANT.md.
2. ~~Chamber normalization~~ — **already shipped in B13, skip.**
3. ~~Custom `not-found.tsx`~~ — **already shipped in B13, skip.**

### B14-2 — The perf pair

1. **Explorer (`/settling-curve`) cold load**: first grid server-rendered or API cached (ISR the initial page of trajectories; keep client interactivity for filters). Kill any stray loading text. Acceptance: real card content in view-source, no double loading affordance.
2. **Search latency**: profile where the 5–9s goes. Ship the cheap win (stream tsvector results first, hydrate semantic re-rank when ready) and report p50/p95 before/after. Do not degrade ranking quality — the B10 eval's ship-rule governs.

### B14-3 — Honesty-surface fixes

1. **OnThisDay unification**: one query module for homepage and feed; ranking prefers threshold events and non-RECORDED transitions over recorded-paper entries; cap logic shared. Same selection for same date across both surfaces.
2. **Non-English catalog**: extend `lib/non-english-pipelines.ts` with missing legislation pipelines (romania, hungary, czech, italy, chile, argentina — verify against `/pipelines`). Apply wherever the default-English rule is promised (feed, OnThisDay, search default).
3. **Feed "since your last visit" counter**: verify the query. If pipelines are paused, empty state says so honestly; if counter is broken, fix it.
4. **Carousel duplicate text**: remove the repeated caption under the mini curve (regression of 6dfd1b7). Add a regression test or comment pointing at the original fix.
5. **Raw pipeline tags on `/settling-curve/coverage`**: add ~8 missing registry display names; confirm zero raw tags render on any public surface (PUBLISH-CHECKLIST P0 rule).
6. **Member stat-tile reconciliation**: add "present/other" count so Yea + Nay + Other = Total visibly; one-line footnote for unity denominator.

### B14-4 — P2 sweep (includes B13 a11y contrast list per amendment 4)

Work the P2 table from both findings files: name-order render transform; /members default browse; split-ledger card title/body split; residue-provenance contrast; mini-curve axis label legibility; ideology auto-apply + axis labels; open-questions badge contrast (B13: ~1.8:1, WCAG AA fail) + "Abstract" strip in cleanDisplayText; reversal-banner CTA naming; story body contrast step; carousel dot count/counter; discovery-rail edge affordance; mobile Fig-1 intent check. Land in themed commits (typography/contrast, presentation transforms, interaction). The two OWNER-CALL items ("COMING — V2" card copy; full-vs-compact number rule) get flagged, not decided.

### B14-5 — Close-outs riding along

Check whether B11-4 close-out items landed: the 12-vote tally-mismatch residue (Congress 103 cluster) added to Known Residues ledger with its log reference; `briefs/b11-report.md` placeholders filled (51,061 ingest count, enrichment totals); CONSULTANT.md entry for the full B11 arc if missing.

## Verification

`tsc`/ESLint/vitest green (including new seq-ordering and chamber-normalization tests); per-fix re-run of the audit's own repro; search + explorer timing numbers before/after; both findings files fully status-marked; Vercel preview green.

## STOP conditions

Any fix drifting into a data write; a perf fix that changes ranking semantics without the eval; /patterns root cause implicating something bigger (report before fixing); two consecutive failures on one criterion. Blocked beats invented.
