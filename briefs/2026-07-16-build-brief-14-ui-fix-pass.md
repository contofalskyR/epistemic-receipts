# Build Brief #14 — UI fix pass (executes the audit findings)

**To:** RobClaw / the worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-16)
**Lane:** site/quality. **Zero database writes.** This brief executes the merged findings of the two-layer UI audit: `briefs/b13-ui-audit-findings.md` (mechanical layer, from Brief #13) and `briefs/b13-visual-audit-findings.md` (visual layer, already complete). Where only the visual file exists at dispatch time, execute against it and fold the mechanical findings in when they land.

**Gate:** Brief #12 (follow & return) merged first — this pass touches the same entity pages and must land on their final form. Do not run concurrently with B12.

**The standing hard rule:** render-side fixes only for anything data-adjacent. Chamber-label normalization, name-order display, boilerplate-splitting, "Abstract"-stripping are all presentation transforms — the underlying rows are never edited. Any fix that seems to require a DB write is misclassified: STOP and flag it.

**Bookkeeping rule:** every finding in both findings files gets a status appended as you go — `FIXED (commit)` / `DEFERRED (why)` / `OWNER-CALL (question)`. The findings docs are the ledger; an unmarked finding is an unfinished brief.

---

## 0. Orientation

Sync main; read the newest fable-handoff; read both findings files in full; standing rails as always (branch `loop/site-b14-<date>`, `B14-n:` commits, ~400 lines/phase, push + PR, owner merges, no middleware/auth/CSP/schema, blocked beats invented).

## Phases (batched by the audit's own recommendation)

### B14-1 — The P0s + the 404

1. **`/patterns` 404 investigation first, fix second.** Determine why a page reported built (B6-3) and allowlisted (B6-2) is 404 in production: never merged? route group mismatch? build-time failure swallowed? Fix per the actual cause — land the page if it exists on a branch, build it per B6-3's spec if it never landed (classifier partition must sum, "other" published), or pull it from PUBLIC_ROUTES + all inbound links if the owner prefers deferral. Record the root cause in the report — this one escaped three verification layers, and the *why* matters more than the fix.
2. **Chamber normalization** on member pages: map Voteview chamber strings to one canonical label set before grouping; recompute the breakdown shares. Add a unit test with both raw spellings.
3. **Custom `not-found.tsx`**: dark, branded, one line of copy, links to `/start-here` and search. Applies site-wide.

### B14-2 — The perf pair

1. **Explorer (`/settling-curve`) cold load**: first grid server-rendered or API cached (ISR the initial page of trajectories; keep client interactivity for filters). Kill the stray "LOADING TRAJECTORIES…" string. Acceptance: real card content in view-source, interactive-feeling first paint; no double loading affordance.
2. **Search latency**: profile where the 5–9s goes (semantic leg cold-start, missing index usage, serial legs?). Ship the cheap win (e.g., stream tsvector results immediately, hydrate semantic re-rank when ready) and report p50/p95 before/after. Do not degrade result quality to win latency — the B10 eval's ship-rule still governs ranking changes.

### B14-3 — Honesty-surface fixes

1. **OnThisDay unification**: one query module consumed by homepage and feed; ranking prefers threshold events and non-RECORDED transitions over recorded-paper entries; cap logic shared. The two surfaces must show the same selection for the same date (modulo cap).
2. **Non-English catalog**: extend `lib/non-english-pipelines.ts` with the missing legislation pipelines (romania, hungary, czech, italy, chile, argentina — verify the full tag list against `/pipelines` rather than trusting this enumeration) and apply wherever the default-English rule is promised (feed, OnThisDay, search default).
3. **Feed "since your last visit" counter**: verify the query against the DB. If pipelines are genuinely paused, the empty state says so honestly ("ingest paused during launch week") instead of a bare 0; if the counter is broken, fix it.
4. **Carousel duplicate text**: remove the repeated caption under the mini curve (regression of 6dfd1b7) — add a regression test or a comment pointing at the original fix so it doesn't return a third time.
5. **Raw pipeline tags on `/settling-curve/coverage`**: add the ~8 missing registry display names; grep for every other surface using the same lookup and confirm zero raw tags render anonymously (the PUBLISH-CHECKLIST P0 rule).
6. **Member stat-tile reconciliation**: add the "present/other" count so Yea + Nay + Other = Total visibly; one-line footnote for the unity denominator.

### B14-4 — P2 sweep

Work the P2 table from the visual findings file top to bottom (name-order render transform; /members default browse; split-ledger card title/body split; residue-provenance contrast; mini-curve axis label legibility; ideology auto-apply + axis labels; open-questions badge contrast + "Abstract" strip in cleanDisplayText; reversal-banner CTA naming; story body contrast step; carousel dot count/counter + prefers-reduced-motion; discovery-rail edge affordance; mobile Fig-1 intent check). Plus whatever the mechanical layer's P2 list adds. Each is small; land them in themed commits (typography/contrast, presentation transforms, interaction). The two OWNER-CALL items ("COMING — V2" card copy; full-vs-compact number rule) get flagged, not decided.

### B14-5 — Close-outs riding along (if not already done)

Check whether the B11-4 close-out items landed; if not, do them here: the 12-vote tally-mismatch residue (Congress 103 cluster) added to the Known Residues ledger with its log reference; `briefs/b11-report.md` placeholders filled (51,061 ingest count, enrichment totals); CONSULTANT.md entry for the full B11 arc if missing.

## Verification

`tsc`/ESLint/vitest green (including the new chamber-normalization and OnThisDay-module tests); per-fix re-run of the audit's own repro (curl/view-source checks); search + explorer timing numbers pasted before/after; both findings files fully status-marked; Vercel preview green. Final visual confirmation happens owner-side (a browser re-pass over the fixed surfaces) — note in the report which fixes deserve that look.

## STOP conditions

Any fix drifting into a data write; a perf fix that changes ranking semantics without the eval; /patterns root cause implicating something bigger (report before fixing); two consecutive failures on one criterion. Blocked beats invented.
