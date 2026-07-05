# Briefing 07 — Curve-First Domains

## The vision (owner's words)

The settling-curve page IS the product. Every domain page — legislation, retractions, drugs, courts, papers — should lead with trajectories the way `/settling-curve` does: timeline chart, key receipts, story summary, exports. Tables and lists are secondary navigation, not the experience.

## Shipped 2026-07-04 (this machine)

1. **Universal explorer.** `/settling-curve?t=<anything>` now accepts raw claim CUIDs, not just curated slugs — the deep link was previously discarded unless it matched the curated list, even though `/api/trajectories/[id]` already had a claim-id fallback. One line unlocked the explorer for all 235k+ multi-step claims. Raw-claim mode shows an "Open receipt →" link (curated metadata like era/domain is absent; everything else degrades gracefully).
2. **Receipt → explorer.** Claim pages with ≥2 transitions show a "View settling curve →" chip (API now returns `_count.statusHistory`).
3. **Encyclopedia → explorer.** Machine-derived lens cards open in the explorer (receipt reachable from there).
4. **`DomainCurveRail`** (`app/components/DomainCurveRail.tsx`) — server component: give it a title + pipeline list, it renders the richest multi-step curves (mini sparkline cards) linking into the explorer; renders nothing when empty, never breaks its page. Mounted on `/legislation` with law-settler + court-reversals + bills pipelines.

## The remaining build, in order

### 1. Extract `CurveExplorer` from the monolith (the real refactor)

`app/settling-curve/SettlingCurve.tsx` (~1,450 lines) contains the chart (community lanes, markers, key-interval bracket), key-receipt panel, story summary, transition log, share/export row, sidebar browser, and reading mode — as one client component. Extract, in this order (each step shippable):

- `CurveChart` (lanes+markers+interval; props: transitions, selected marker, onSelect)
- `KeyReceiptPanel` (selected transition + source + export row)
- `StorySummary` (already a self-contained `renderStorySummary`)
- `CurveExplorer` = composition of the three + `TransitionLog`, taking `(claim, transitions)` props — no fetching, no sidebar
- `/settling-curve` becomes: sidebar browser + `<CurveExplorer>`; other pages embed `<CurveExplorer>` directly

Rules: pure refactor — no visual changes in the same commits; the deep-link, share, and export behaviors must survive (they're the product's flywheel); screenshot-compare before/after at 1440/768.

### 2. Per-domain rollout (each ~a day once #1 exists)

| Page | Data source | Data readiness |
|---|---|---|
| `/retraction-explorer` | wave-2 curves (18,280 pub→retraction arcs) | **Ready now** — highest-value target, do first |
| `/legislation` | bills + repeals | Rail shipped; full explorer embed **needs wave 3** (briefing 03) — bill outcomes are what make legislative curves move. nz_repealed needs its wave-2-style prepend (enacted-era row) to draw as a reversal |
| `/drug-arc` | FDA labels/approvals + curated drug curves | Wave 1 done; page already exists — retrofit to embed `CurveExplorer` |
| `/opinions`, courts | curated + courtlistener (born-settled: flat) | Court *reversal* arcs are curated-only for now |
| papers | openalex promoter output | Grows as the loop runs; rail can mount once >50 curves exist per field |

Pattern per page: `DomainCurveRail` at top (already reusable) → click-through to explorer → later, embedded `CurveExplorer` with a domain-filtered sidebar replacing the generic one.

### 3. Data dependencies to schedule

- **Wave 3** (briefing 03) is what turns `/legislation` from "a few curated curves" into "every bill's lifecycle" — it is now UI-motivated, not just data hygiene.
- **nz_repealed_acts_v1** prepend (enacted→REVERSED) makes 4,372 repeal reversals drawable.
- Machine-lens pagination (`/api/history?lens=machine`) if any domain wants >1,000 browsable.

## Cautions

- `DomainCurveRail` queries per request (narrow, pipeline-filtered). If a rail is ever fed a huge pipeline set, add caching before widening it.
- Don't mount rails fed by same-day two-steppers (voteview et al.) — degenerate sparklines; that's why the legislation rail's pipeline list omits voteview.
- Raw-claim explorer mode lacks era/domain metadata; if raw-claim traffic grows, have `/api/trajectories/[id]` return `ingestedBy`-derived domain/era so the header and related-picks work fully.
