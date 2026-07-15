# Build Brief #9 — Nav trim + homepage convergence (pre-publicity polish)

**To:** RobClaw / the Claude Code worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-14)
**Lane:** site. **Zero database writes.** Timing: before publicity — the wave lands on the homepage and the nav, not on `/split-ledger`.

**This brief supersedes two MATERIAL-QUEUE one-liners** (`nav-trim`, `homepage-convergence`) — note that in your report so the next tick marks them.

**The spec already exists — don't reinvent it.** `HOMEPAGE-REDESIGN-PLAN.md` is a full implementation plan (hero, discovery rail, what's-new, mobile-first curve, progressive disclosure, proportionality cleanup, sequencing, file list, conventions). `docs/design/v1-landing-mockup.html` is the visual target. `docs/lab-pages-triage-2026-07-03.md` carries the nav/lab-graduation verdicts. Your job is reconciliation and execution, not redesign.

---

## 0. Gate + orientation

1. **Gate:** Brief #7 merged. Fine to run parallel to B8/launch ops — homepage/nav changes inherit to both editions.
2. Sync main; orientation protocol; then read in full: `HOMEPAGE-REDESIGN-PLAN.md` (especially §6 "Decisions for you" and §7 conventions), `docs/design/v1-landing-mockup.html`, `docs/lab-pages-triage-2026-07-03.md`, `PUBLISH-CHECKLIST.md` P1 items, current `app/page.tsx` + `app/components/Nav.tsx`.
3. Standing rails: branch `loop/site-b9-<date>`, `B9-n:` commits, ~400 lines/phase, push + PR, owner merges. No middleware/auth/CSP/schema. Never fabricate a number — every stat rendered on the new homepage derives from a query, never hand-written (the plan's own house rule).

## Phases

### B9-1 — Reconciliation note (≤1 page, owner-reviewed BEFORE code)

The plan is dated 2026-07-03; the homepage has drifted since (claim carousel, OnThisDay strip, StartHere section, survival fig all shipped after it was written). Produce `briefs/b9-delta-note.md`:

- Plan-vs-current delta: what the plan prescribes that now exists in some form, what it replaces, what B3's OnThisDay/carousel should become in the target layout (keep their functionality — placement per the mockup).
- The plan's §6 "Decisions for you," answered: pull each decision out, recommend a default, mark which block code.
- Nav target: current groups/items → proposed groups/items (a table). Include the lab-graduation list from the triage doc and the PUBLISH-CHECKLIST P1 trims (sports A–E cut-or-keep, `/globe/lab` unlist, `/foreign-legislation` fold-or-rename) as decision-gated rows.

**STOP here for owner review of the note** (this is the design-note checkpoint from HANDOFF-OPENCLAW, applied because the homepage is the highest-stakes surface on the site). Silence is not a yes.

### B9-2 — Homepage convergence (after note approval)

Execute the approved note against the mockup: featured-trajectories hero above the fold, discovery rail, what's-new/OnThisDay placement, mobile-first settling curve (§3.4 — verify on a phone-width viewport, not just devtools), proportionality cleanup (§3.6). Respect §7 conventions verbatim. Server-render everything that can be; view-source must show the hero's claim text. Preserve ISR semantics (OnThisDay's daily roll must survive the restructure).

### B9-3 — Nav trim

Per the approved table: consolidate groups, graduate the triage doc's lab list out of ⚗, execute the decided P1 trims. Hard rules: every removed nav item remains reachable from a hub page (`/fields`, `/start-here`, `/docs`, or a section index) — removal from nav is never removal from the site; redirects for any renamed/folded route (`/foreign-legislation` → wherever decided) added to `next.config.ts` redirects, permanent; sitemap and `PUBLIC_ROUTES` stay consistent with whatever moves.

### B9-4 — Verification

`tsc`/ESLint/vitest green; homepage view-source shows real derived numbers (grep against a live count query — the plan's no-hand-written-stats rule); mobile viewport screenshot-equivalent check (fetch with mobile UA + verify the §3.4 layout branch); every former nav destination reachable via crawl from `/` (script it: BFS from homepage, assert no orphaned reader-facing page); Vercel preview green; Lighthouse-style sanity on the preview homepage (no regression in first-load payload — the plan's §2 diagnosis was proportionality, don't win design and lose weight).

## Report

`briefs/b9-report.md`: the delta note verdicts as executed, before/after nav table, the orphan-check output, queue-tick note for RobClaw, anything deferred.

## STOP conditions

Owner hasn't approved the B9-1 note; mockup and plan conflict on something material (present both, don't pick silently); a trim would orphan a page; anything wanting middleware/schema; two consecutive failures on one criterion. Blocked beats invented.
