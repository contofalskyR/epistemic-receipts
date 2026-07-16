# B13 — UI Audit Findings (mechanical layer)

**Branch:** `loop/site-b13-2026-07-16`  
**Date:** 2026-07-16  
**Method:** static analysis, grep sweeps, WCAG contrast computation from hex values in lib/status.ts and component code.  
**Scope:** B13 phases 1–6 per the brief. Zero data edits, zero design redesigns. Inline fixes ≤10 lines each.

---

## Inline fixes shipped (commits on branch)

| Commit | What | File(s) |
|---|---|---|
| B13-1 `8fac17e` | Stale "1.6M" counts → "1.76M" in Nav (2 places); layout.tsx meta description "1.6M+" → "1.7M+"; removed duplicate carousel text (line 278 was `s.text` repeated verbatim under the mini-curve) | `app/components/Nav.tsx`, `app/layout.tsx`, `app/HomeCarousel.tsx` |
| B13-2 `24925bb` | **P0 fix** — Normalize chamber labels at render: merge "House of Representatives" → "House" before groupBy render; recompute shares correctly | `app/members/[memberId]/page.tsx` |
| B13-5 `f554041` | Add `prefers-reduced-motion` guard to carousel auto-advance and fade transition | `app/HomeCarousel.tsx` |
| B13-6 `87bf9da` | Custom `not-found.tsx` — dark branded 404 with links to /start-here and /search | `app/not-found.tsx` (new file) |

---

## Remaining findings

### P0 — renders wrong or missing information

| Severity | Route/File | What | Proposed fix | Effort |
|---|---|---|---|---|
| P0 | `/patterns` | **Page does not exist.** No `app/patterns/` directory. Also **not in `PUBLIC_ROUTES`** (contrary to what the visual audit stated — it is absent from both `lib/publicEdition.ts` and the filesystem). No links to it found in current source code. Anyone reaching the URL via an external link, doc, or bookmark gets the default Next.js 404 (now the branded one post B13-6, but the route is still dead). | Build the page (scoped task for B14), or confirm it was dropped and remove any external references. Do not add to PUBLIC_ROUTES until the page exists. | M |

### P1 — broken or embarrassing

#### B13-3 — Ordering violations (seq not used on curve-rendering consumers)

`ORDERING-SEMANTICS-2026-07-08.md` decided seq-based ordering. These consumers still sort by `occurredAt` with no `seq` primary key — each can render a curve in the wrong order, which is a correctness bug for this site.

| Severity | Route/File | What | Proposed fix | Effort |
|---|---|---|---|---|
| P1 | `app/components/DomainCurveRail.tsx:51` | `statusHistory` ordered by `[{occurredAt:"asc"},{createdAt:"asc"}]` — no `seq`. Used in domain pages and homepage sections. | Add `{seq:"asc"}` as primary sort key: `[{seq:"asc"},{occurredAt:"asc"},{createdAt:"asc"}]`. Also add `seq` to the select so callers can use it. | S |
| P1 | `app/api/search/route.ts:164` | `statusHistory` for search-result curve cards ordered by `[{occurredAt:"asc"},{createdAt:"asc"}]`. | Same seq-first swap. | S |
| P1 | `app/api/history/route.ts:102,143` | History API returns status history ordered by `[{occurredAt:"asc"},{createdAt:"asc"}]`. External consumers and OG images use this. | seq-first swap. | S |
| P1 | `app/law-settler/page.tsx:32,64` | Law-settler curve data ordered by `occurredAt`. | seq-first swap. | S |
| P1 | `app/case-studies/page.tsx:64` | Case-studies curve ordered by `occurredAt`. | seq-first swap. | S |

#### B13-6 — Contrast failure

| Severity | Route/File | What | Proposed fix | Effort |
|---|---|---|---|---|
| P1 | `app/open-questions/page.tsx:115` | Dormancy leaderboard right-edge CONTESTED badge uses `text-gray-700` (#374151) on `bg-gray-900/50` (#111827 base). **Contrast ≈ 1.8:1** — WCAG AA requires ≥4.5:1 for normal text. | Change to `text-gray-400` or use the canonical `AXIS_BG_CLASS.CONTESTED` ("bg-amber-900 text-amber-300") to match the woken-claims section above it. | S |

### P2 — polish

| Severity | Route/File | What | Proposed fix | Effort |
|---|---|---|---|---|
| P2 | `app/components/SettlingCurveMini.tsx:19–27` | `AXIS_VIS` dict re-declares all 7 axis hex colors instead of importing from `lib/status.ts`. Colors may drift. | Replace the color fields with `AXIS_COLOR[axis]` from `lib/status.ts`; keep the `level` and `label` fields local. | S |
| P2 | `app/HomeSurvivalFig.tsx:128–129` | Survival curve line and label use `#34d399` (emerald-400), which is close but not identical to canonical SETTLED `#22c55e` (emerald-500). The curve represents "not-yet-settled" share, so using SETTLED color is arguably wrong semantically — but the inconsistency is worth an owner call. | Owner decides: either `AXIS_COLOR.SETTLED` for consistency, or a distinct neutral color (e.g. `#38bdf8` OPEN) to signal "this is the surviving-contested population." | S |
| P2 | `app/stories/*/page.tsx` (8 files) | Each story page defines an identical `formatDate(d, datePrecision)` function. ~16 lines of duplicated logic. | Extract to `lib/format.ts`; import in all consumers. Also consolidates with `app/components/DomainRecentMoves.tsx` and `app/opinions/OpinionsClient.tsx` which define their own variants. **Proposed as a finding; scope for B14, not B13 (>10 lines, no design judgment, but broad refactor).** | M |
| P2 | `app/HomepageSections.tsx:340` | "Coming — V2" card — promise-adjacent copy on a site with a no-promise-language rule. Comment says "deliberately unlinked." | Owner call: reframe as "In the lab →" or remove. | S |
| P2 | `app/analysis/corpus/page.tsx:7` | Page metadata description still says "1.6M epistemic baseline rows." | Update to "1.7M+" to match current corpus size. | S |
| P2 | `app/analysis/corpus/CorpusCharts.tsx:184` | Hardcoded fallback "1.6M" shown when no data loaded. | Update fallback to "1.7M+". | S |
| P2 | `lib/following.ts:93` | Following-feed statusHistory ordered by `{occurredAt:"desc"}` without seq. Lower priority than P1 list (following feed mini-curves, not primary curve renderer). | seq-first swap. | S |

---

## Sort-order table (B13-3)

| Route | Current sort | First-time-visitor verdict |
|---|---|---|
| `/settling-curve` | `statusHistory._count desc` (most transitions first) | Good — complexity signals interestingness |
| `/feed` | `createdAt desc` | Correct — reverse-chronological |
| `/open-questions` | `dormancyYears desc` | Good — most dormant first |
| `/reversals` | Editorial (hardcoded `CURATED_ARCS`) | Good — manually curated |
| `/split-ledger` | Server-computed via `lib/split-ledger.ts` (no explicit claim sort) | Acceptable — structural grouping |
| `/claims` | `createdAt desc` | **P2 — NARA wall confirmed still open** (PUBLISH-CHECKLIST P2). Ingestion-date order surfaces NARA bulk ingest, not the most interesting claims. Propose diversified-first-page: rotate by domain/community. |
| `/search` | Hybrid relevance (tsvector + pgvector) | Good |
| `/members` | Empty until query typed — no default browse | P2 — default browse missing (visual audit) |

---

## Contrast table (B13-6)

All axis colors tested against site background `bg-gray-950` ≈ `#030712` (L ≈ 0.002). WCAG AA requires ≥4.5:1 for normal text.

| Axis | Hex | Contrast on #030712 | AA pass? |
|---|---|---|---|
| SETTLED | #22c55e | ~9.5:1 | ✓ |
| CONTESTED | #f59e0b | ~9.8:1 | ✓ |
| REVERSED | #ef4444 | ~5.7:1 | ✓ |
| RECORDED | #94a3b8 | ~8.4:1 | ✓ |
| OPEN | #38bdf8 | ~9.8:1 | ✓ |
| ABANDONED | #6b7280 | ~4.6:1 | ✓ (narrow pass) |
| UNRESOLVABLE | #a78bfa | ~7.9:1 | ✓ |

**Failure outside the axis color set:**

| Element | Foreground | Background | Contrast | AA pass? |
|---|---|---|---|---|
| open-questions dormancy CONTESTED badge | `text-gray-700` #374151 | `bg-gray-900` #111827 | ~1.8:1 | ❌ |

ABANDONED is the narrowest pass at ~4.6:1. Monitor if it ever appears at sub-18px on a lighter background.

---

## B13-5 — Interaction / animation inventory

| Item | Status | Finding |
|---|---|---|
| Carousel prefers-reduced-motion | Fixed (B13-5 commit) | Now stops auto-advance and skips fade transition when motion is reduced |
| Carousel pause-on-hover | Working — `onMouseEnter setPaused(true)` | ✓ |
| Carousel keyboard nav | Dot buttons have `aria-label="Go to slide N"` and are reachable via Tab | ✓ |
| BlackHoleCanvas prefers-reduced-motion | Checked — `app/components/BlackHoleCanvas.tsx:98` reads `matchMedia` and respects it | ✓ |
| SettlingCurve.tsx prefers-reduced-motion | CSS rule present at line 265: `@media (prefers-reduced-motion: reduce){.sc-anim{transition:none !important}}` | ✓ |
| Search debounce / keystroke loss | Fixed in prior commit `c704ecc` — `inputFocusedRef` guards sync effect | ✓ verified by code |
| Search loading/error/empty states distinct | SearchClient.tsx has distinct states per visual audit | needs browser verification (visual pass) |
| Globe rotation prefers-reduced-motion | Not verified in this pass — globe is Lab-only, not in PUBLIC_ROUTES | flag for visual pass |

---

## B13-1 — Copy sweep notes

- Spellcheck of JSX strings across app/ found no clear typos in our authored copy. (Data strings skipped per brief rule.)
- Casing of axis labels is consistent via `AXIS_LABEL` in `lib/status.ts` — no rogue lowercase "settled" found in JSX.
- No "always/never/guaranteed/truth" promise-language found in public-facing copy except the methodology page where these words are used precisely in technical context ("This flag is never set by any script").
- "Coming — V2" on homepage (`HomepageSections.tsx:340`) is the only promise-adjacent copy flagged. Owner call.
- Hardcoded totals: `app/layout.tsx`, `app/components/Nav.tsx`, `app/analysis/corpus/page.tsx`, `app/analysis/corpus/CorpusCharts.tsx` had stale 1.6M counts. layout.tsx and Nav.tsx fixed in B13-1. corpus pages remain (P2, listed above).

---

## B13-2 — Number/date formatting notes

- Date precision: story pages correctly check `datePrecision` before rendering day-level dates (`formatDate` checks precision before adding `day:"numeric"`). DomainRecentMoves correctly uses `formatPreciseDate(item.occurredAt, item.datePrecision)`. No honesty-bug class found in these paths.
- Count formatting: no mixed thousands-separator issues found. Numbers consistently use `.toLocaleString()` or formatted via server-side functions.
- Compact vs. exact: no formal rule codified — still ad-hoc (visual audit finding confirmed). Propose a `lib/format.ts` with `compactCount` for nav/hero (already in `app/page.tsx` via a helper) and `exactCount` for tables. Finding, not a commit.
- `app/review/page.tsx:163` uses bare `new Date().toLocaleDateString()` with no locale or precision awareness — minor but inconsistent.

---

## Visual-pass findings (merge section)

*The following is imported verbatim from `briefs/b13-visual-audit-findings.md` (owner's browser pass). Items already addressed by B13 inline fixes are noted.*

**P0 — renders wrong or missing information**

| Route | Finding | Status after B13 |
|---|---|---|
| /patterns | 404 in production — page never built, not in PUBLIC_ROUTES | Custom 404 now branded; root cause finding above; needs B14 build task |
| /members/[id] | Chamber breakdown "House" and "House of Representatives" as two rows | **Fixed in B13-2** |

**P1 — broken, misleading, or embarrassing**

| Route | Finding | Status after B13 |
|---|---|---|
| /settling-curve | Cold load 9 empty skeleton cards + stray "LOADING TRAJECTORIES…" | Open — B14 |
| /search | ~5–9s cold query time | Open — B14 |
| /members/[id] | Stat tiles don't reconcile (Yea+Nay ≠ Total; missing ~28 present/other) | Open — B14 |
| /feed | "0 new claims since last visit" counter suspect | Open — B14 |
| /feed (OnThisDay) | Non-English leak (Romanian legislation) | Open — B14 |
| / (homepage) vs /feed | Two OnThisDay implementations disagree | Open — B14 |
| / (carousel) | Duplicate text per slide | **Fixed in B13-1** |
| /settling-curve/coverage | Raw pipeline tags on public page (argentina_legislation_v1 etc.) | Open — B14 |
| any bad URL | Default unstyled Next.js 404 | **Fixed in B13-6** (custom not-found.tsx) |

**P2 — polish** (all open for B14, see visual audit doc for full list)

Notable items confirmed by code inspection:
- `/open-questions` CONTESTED badge contrast: confirmed as ~1.8:1 (moved to P1 contrast finding above)
- Carousel 13 pagination dots: confirmed `HomeCarousel.tsx` renders dots for all `SLIDES.length` items; the `width:20` active / `width:6` inactive pattern is in use
- "Coming — V2" card: `HomepageSections.tsx:340` confirmed (owner call per brief)

---

## Proposed B14 batching

**Pass 1 — Two P0s + ordering suite + a11y fix** (highest ROI, all mechanical)
- Build `/patterns` page or scrub from any docs/external references
- 5 seq-ordering swaps (DomainCurveRail, search route, history route, law-settler, case-studies)
- open-questions contrast fix (text-gray-400 on dormancy badges)

**Pass 2 — UX regressions** (visual-pass P1s)
- Explorer cold-load: ISR or API cache for first grid; remove stray loading text
- Search latency: profile tsvector vs semantic cold-start
- Members stat-tile reconciliation: add "28 present/other" tile or footnote

**Pass 3 — OnThisDay + non-English catalog**
- Unify two OnThisDay implementations (homepage vs feed)
- Extend `lib/non-english-pipelines.ts` catalog with 8 missing pipelines

**Pass 4 — P2 polish sweep**
- Copy: stale corpus-page 1.6M counts, "Coming — V2" resolution
- Colors: SettlingCurveMini import from lib/status.ts; HomeSurvivalFig color owner call
- lib/format.ts consolidation (8 duplicated story formatDate functions + 4 client variants)
- /claims default sort diversification (NARA-wall P2)
- /members default browse (no-query empty state)

---

*Findings generated from code-side audit on branch `loop/site-b13-2026-07-16`. Visual-pass items imported from `b13-visual-audit-findings.md` (owner's browser pass, 2026-07-16). Merge is additive — this doc supersedes neither.*
