# SPEC — Adaptive claim timeline (all 1.76M claims, one component)

*Replaces the current linear timeline on `app/claims/[id]`. Queue position: alongside the follow-UI work (they share the page). The screenshot pathology (receipt 5F358049 — overprinted labels, 5.5-year void) is Shape 1 of five; this spec must render all five from the same rules with no per-shape code paths.*

## Inputs
The full dated event set for a claim: emergence (`claimEmergedAt` + precision), every `ClaimStatusHistory` row (`occurredAt`, `datePrecision`, `toAxis`, seq order), source dates, and `today`. Nothing else — the component is a pure function of this array.

## The algorithm (gap-based clustering with explicit compression)

1. **Sort** events chronologically (seq is the tiebreak authority within equal dates).
2. **Cluster**: walk the sorted list; start a new cluster when the gap to the previous event exceeds `G = max(90 days, 0.15 × total span)`. Today is an event; it clusters like any other.
3. **Allocate width**: each cluster's width = `max(minClusterPx, nEvents × 52px)`, i.e. proportional to *event count*, not duration — legibility beats physics inside a cluster. Within a cluster, positions are linear in time. Each inter-cluster gap renders as a fixed-width **break glyph** (zigzag, 34px) with its true duration labeled beneath ("11 yrs"). Remaining width distributes to clusters proportional to their internal time spans.
4. **Degenerate cases** (these are most of the corpus):
   - 0–1 events → **no axis**. Render the compact row (Shape 4): status dot, "Recorded <date>", dormancy note. Constant 44px height.
   - 2 events → two markers + one gap pill; no full axis chrome.
5. **No-break condition**: if no gap exceeds `G`, render a plain linear axis (Shape 2). Breaks appear only when they earn their existence — a Plessy→Brown doctrine spread across decades is already legible.
6. **Height is constant**: 150–180px max in every mode. The timeline never again spends a viewport on a void.

## Honesty rules (non-negotiable — these carry the site's thesis into the pixels)
- **Compression is always explicit.** The axis is never silently nonlinear; every compressed span is a visible break glyph with a labeled duration. Hover any break: exact date range.
- **Date precision renders as geometry.** `DAY` = dot. `MONTH`/`QUARTER` = short bracket span. `YEAR` = wide bracket span, label suffixed "(year precision)". A year-precision event never sits at a fabricated day position — the "dates are never invented" rule, made visual.
- **The status band always spans full width** beneath the markers, colored by `toAxis` at every moment (the FactStatus palette from EpistemicAxisBadge, including REVERSED red and ABANDONED stone post-patch-3). Band segments passing through a break render at ~50% opacity — status continues, time is compressed. The band answers "what was true when"; markers answer "what happened when." Two channels, never merged.
- **Dormancy is information.** The trailing gap label reads "N yrs · no new activity" — for a reversed claim that's "unchallenged since"; for a settled one it's stability. Same glyph, honest label.

## Label collision
Stagger labels across up to 3 vertical rows with leader lines to their markers (greedy: place each label in the lowest row where it fits with 8px padding). If a cluster still overflows (>5 events in one week), collapse to a single marker with a count badge ("4 events"); click expands an event list below the timeline. Labels never overprint — this is an acceptance criterion, not a preference.

## Interaction
- Hover marker: exact date (with precision), transition `fromAxis → toAxis`, one-line reason.
- Hover break: true date range and duration.
- Click marker: scrolls to the corresponding row in Evidence & Sources / revision history.
- The "View settling curve →" link remains the escape hatch to the full-page visualization; this component is the claim page's summary, not a replacement.

## Acceptance tests (one per shape — use these exact fixtures)
1. **Burst-dormant** (receipt 5F358049 / any crossref retraction): 3 events in Jan 2021 legible at day scale, one break, today. No overprinted labels at 375px or 1440px widths.
2. **Slow burn** (a SCOTUS overruling pair, e.g. an 1896→1954 doctrine): plain linear axis, zero breaks, band shows gray→green→red.
3. **Multi-cluster** (an NZ or foreign-legislation claim with enact/amend/repeal): ≥2 breaks, each labeled with its true gap.
4. **Entry-only** (any unenriched OpenAlex claim): compact row, no axis, 44px, no visual noise.
5. **Precision honesty** (any YEAR-precision transition): bracket span rendered, "(year precision)" in label and hover.
6. **7-axis tolerance**: a claim whose latest toAxis is ABANDONED renders a stone band segment and stone marker (ties into the Phase 4 sweep).

## Out of scope
Zoom/pan, animation, the settling-curve full page, and any change to how dates are stored. This is a rendering component; the transition contract remains the only writer of truth.
