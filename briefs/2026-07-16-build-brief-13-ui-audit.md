# Build Brief #13 — UI audit, mechanical layer (copy, charts, ordering, interaction)

**To:** RobClaw / the worker it dispatches on `epistemic-receipts`
**From:** Robert (via planning session, 2026-07-16)
**Lane:** site/quality. **Zero database writes.** This is an audit-first brief: trivial fixes ship inline; everything with a design dimension becomes a severity-ranked list the owner picks from. The rendered site is publicly fetchable — audit the live HTML, not just the source.

**Division of labor:** this brief covers everything auditable from code + fetched HTML. A separate visual pass (screenshots, rendered charts, spacing, animation feel) runs in parallel through the owner's browser — your findings doc and that one merge into a single ranked list, so structure yours for merging (one finding per line, file/route + severity + fix-or-proposal).

**The one hard rule above all others:** never "fix" text that is data. Claim text, source titles, quoted material, and historical language come from pipelines and sources — a spelling oddity there is source fidelity, not a typo. Only OUR copy (JSX strings, metadata, banners, button labels, explainers, story prose we authored) is in scope. When in doubt, it's data — leave it and flag it.

---

## 0. Orientation

Sync main; orientation protocol; read the newest fable-handoff. Then read as audit anchors: `ORDERING-SEMANTICS-2026-07-08.md` (the decided seq-based ordering), `lib/status.ts` (the only legal source of axis colors/labels), `epistemic-receipts-marketing.md` §brand-voice + §the-one-rule (promise-free copy), `docs/lab-pages-triage-2026-07-03.md` + PUBLISH-CHECKLIST P2 (known cosmetic debt — don't re-discover it, verify what's still open), the D-4 empty-state pattern, `specs/SPEC-adaptive-claim-timeline.md` honesty rules (precision-aware dates).

Standing rails: branch `loop/site-b13-<date>`, `B13-n:` commits, push + PR, owner merges. Inline fixes capped at ~10 lines each and zero design judgment; anything larger is a finding, not a commit. Blocked beats invented.

## Phases

### B13-1 — Copy sweep (typos + voice)

Extract every user-facing string we author (JSX text nodes, `metadata` exports, aria-labels, empty states, banners, glossary entries, story prose, /about, /methodology, docs pages). Then:

- Spellcheck (US English) + grammar pass. Typos in our copy: fix inline, one commit, full list in the report.
- House-style consistency: axis names always the canonical tokens (SETTLED, not "settled"/"Settled" mid-sentence unless prose-styled consistently); "settling curve" casing; product terms; en/em dash and quote-mark consistency; no promise-language (the marketing doc's one rule — flag any "always/never/guaranteed/truth" copy).
- Every rendered count traces to a query, never hand-written (grep for hardcoded totals like "1.6M"/"1,6" in copy — the headline-count decision must not be re-contradicted by stray strings).

### B13-2 — Number + date formatting

Inventory how counts, percentages, and dates render across pages. Findings to hunt: mixed thousands separators, "1.6M" vs "1,619,751" used without a rule (propose one: compact in nav/hero, exact in tables/stats), differing % precision on sibling stats, and any date that renders day-precision from a YEAR/MONTH-precision row (the honesty bug class — grep every `toLocaleDateString`/format call against the datePrecision field's presence). If formatting is scattered, propose a `lib/format.ts` consolidation as a finding with a call-site count — don't execute the refactor in this brief.

### B13-3 — Ordering audit (anchored to the decided semantics)

ORDERING-SEMANTICS decided seq-based ordering with consumer swaps in the build order. Verify each curve-displaying surface (claim timeline, explorer, curve rails, OG images, API responses, receipts, chain audit) now orders by `seq` — list any consumer still sorting by date, each is a P1 finding (it can render a curve in the wrong order, which for this site is a correctness bug, not cosmetics). Separately, list every index page's current sort (feed, explorer, open-questions, claims, search, patterns, split-ledger) in a table with a one-line "is this the order a first-time visitor would want" verdict — the /claims NARA-wall problem (PUBLISH-CHECKLIST P2) is the known example; propose diversified-first-page or better defaults as findings.

### B13-4 — Chart + graph audit (code-side)

Inventory every chart/graph component (curve rails, SettlingCurveMini, survival fig, ideology scatter, analysis pages, stats pages, drug-arc funnel, globe overlays, patterns exemplars). Per chart, check: axis labels and units present; legend or direct labeling; date axes precision-aware; colors exclusively via `lib/status.ts` or the chart's own documented palette (extend B6's stray-hex audit to chart code); sensible degenerate-data behavior (0 points, 1 point, all-equal values); label-collision handling; denominator/coverage caption where the data is a subset (the B11 rule, applied everywhere). Known open items to verify and re-rank rather than rediscover: drug-arc funnel bars not proportional (currently footnoted — propose an actual proportional fix), retraction-lag repeated pair counts, globe wide-viewport void + chip wrapping. Improvements land as ranked proposals with effort estimates — ship nothing visual in this brief.

### B13-5 — Interaction + animation inventory

- Search: debounce behavior, no keystroke loss (regression-check the recently fixed bug with a scripted rapid-input test if feasible), loading/empty/error states distinct and honest.
- Carousel: timing, pause-on-hover, and whether navigation is keyboard-reachable.
- `prefers-reduced-motion`: inventory every animation/transition (carousel fades, globe rotation, hover transitions) and flag any that ignore it — each is a cheap accessibility win.
- Focus states on all interactive elements (copy-link, cite, embed, follow buttons); anchor-scroll behavior on `/claims/[id]#t-{seq}`.
- Loading affordances: spinner-vs-skeleton consistency across pages; any page that can flash empty-then-populate (the "Last pull: never" class of bug from the triage doc).

### B13-6 — A11y + link integrity

- Contrast: compute WCAG AA for every axis-color-on-background pairing in `lib/status.ts` usage (text-on-dark, badge text, chart labels) — exact ratios in the report; failures are P1.
- aria-labels on icon-only buttons; heading hierarchy per template (one h1, ordered levels); alt text on informative images/OG previews where applicable.
- Dead-link crawl: BFS from `/` on the live public site across internal links (bounded depth, dedup); every 404/500 listed. Sample 30 external source links across pipelines for liveness — report, don't fix (external rot is data-team territory).

## Deliverable

`briefs/b13-ui-audit-findings.md` on the branch: every finding as `severity | route/file | what | proposed fix | effort(S/M/L)`, with severities: **P0** = renders wrong information (ordering, precision, mislabeled data); **P1** = broken or embarrassing (contrast failures, dead links, collision, missing reduced-motion); **P2** = polish (voice, spacing, animation feel). Plus: the inline-fix commit list (typos/aria/format one-liners you shipped), the sort-order table, the contrast table, and a proposed fix-pass grouping (what a Brief #14 would batch, in what order). The visual-pass findings will be merged into this file — leave a placeholder section.

Note: `briefs/b13-visual-audit-findings.md` already exists — the owner's browser pass is complete. Merge your mechanical findings with it (don't overwrite; append or note the merge point).

## STOP conditions

Any edit to claim/source/quoted text; any visual redesign attempted inline; a P0 ordering finding tempting a data fix (report it — ordering repairs on rows are data-lane, owner-gated); two consecutive failures on one criterion. Blocked beats invented.
