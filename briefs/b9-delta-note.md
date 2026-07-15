# B9-1 — Reconciliation Delta Note
_For owner review before any code changes. Branch: `loop/site-b9-2026-07-14`._
_Plan authored 2026-06-22. Reading current `HEAD` as of 2026-07-14._

---

## 1. Plan-vs-current delta

The `HOMEPAGE-REDESIGN-PLAN.md` was written when the homepage was a search-first void (large headline, input, chips, BlackHoleCanvas). Since then, **B3 and a prior untracked redesign pass** shipped substantial changes. Current `app/page.tsx` + components reflect a near-complete §3.6/Phase 0 pass, a partial §3.1 pass, and a partially-done §3.3.

### §3.1 — Featured Trajectories hero

| Status | Detail |
|--------|--------|
| **Already exists in some form** | `HomeHero` is now a server component implementing the `v1-landing-mockup.html` design ("How long does 'settled' stay settled?", Newsreader font, live `HomeSurvivalFig` survival curve, two CTAs). The old client search island and `BlackHoleCanvas` are gone. `HomeCarousel` (B3) sits below the hero text section and handles rotating claim examples. |
| **What the plan would replace** | Plan §3.1 described "2–3 rotating settling-curve mini-card tiles" as the hero itself, with search demoted beneath. What shipped is closer to the mockup's approach: a static survival figure is the flagship visual, not rotating cards. Both achieve "trajectories above the fold." |
| **Where B3 components land in the mockup's layout** | `HomeCarousel` → occupies the plan's "rotating card" slot, just below the Fig. 1 block (fine; no relocation needed). `OnThisDay` strip → sits between carousel and `HomepageSections` (matches "reason to return" intent). `StartHere` section → inside `HomepageSections`, plays the role of the plan's Discovery Rail (§3.2). `DomainRecentMoves` → wired to domain pages, not the homepage; no change needed. |

### §3.2 — Discovery rail (curated entry points)

| Status | Detail |
|--------|--------|
| **Partially exists** | `StartHere` component is in `HomepageSections`. `MovedTicker` shows live recent transitions. |
| **What the plan would replace** | Three overlapping chip systems: `TOPIC_CHIPS` (HomeHero), random `TaxonomyIndex` (HomepageSections), `DomainGrid`. Audit: `TOPIC_CHIPS` is gone (HomeHero is now a server component). `TaxonomyIndex` and `DomainGrid` tiles are also gone — HomepageSections comment says "Replaces the StatsBar + DomainGrid tiles with one quiet index band." |
| **Gap remaining** | `app/lib/discovery-rail.ts` does not exist. The "curated scroll-snap entry points" (tobacco funding, semaglutide, gun votes) from §3.2 haven't been authored. `StartHere` page exists at `/start-here` but the homepage section is a static block. No `app/lib/featured-trajectories.ts` either. |

### §3.3 — "What's new" feed

| Status | Detail |
|--------|--------|
| **Substantially done** | `lib/feed.ts` exists and exports `loadRecentTransitions`. `page.tsx` calls `loadRecentTransitions(6)` and passes `whatsNew` to `HomepageSections`. `MovedTicker` renders it. Hardcoded `CHANGELOG` array is gone. |
| **Gap remaining** | Footer "last updated June 19, 2026" — need to verify whether `layout.tsx` still hardcodes this. Friendly pipeline label mapping (crossref_retractions_v1 → human label) may still be raw. |

### §3.4 — Mobile settling curve carousel

| Status | Detail |
|--------|--------|
| **Not yet done** | `StatsBar` mobile grid fix is unclear (StatsBar may be gone with the tile redesign). No `SettlingCurveMini` component exists. No swipeable full-screen hero. |

### §3.5 — Progressive disclosure (example search results)

| Status | Detail |
|--------|--------|
| **Not done** | No example-query server prefetch in `loadHomepageData()`. Not in current scope for B9 either — low priority given search is now a dedicated page. |

### §3.6 — Proportionality & cleanup

| Status | Detail |
|--------|--------|
| **Mostly done** | Full-bleed fix: `layout.tsx`'s `<main>` padding state unclear — needs spot-check. Hero uses `max-w-5xl` matching HomepageSections. "26 taxonomies" copy: `DomainGrid` is replaced; issue gone. Random topics: `TaxonomyIndex` gone. BlackHoleCanvas: retired. Hardcoded changelog: retired. Nav promotion: **NOT DONE** — still 5 dropdown groups with flagships buried. Visual-language drift (inline `C` palette): not reconciled. |

---

## 2. §6 "Decisions for you" — recommendations

| # | Decision | Recommendation | Block code? |
|---|----------|----------------|-------------|
| 1 | **Trajectory curation method** (in-code `featured-trajectories.ts` vs. `Claim.metadata` flag) | **In-code `featured-trajectories.ts`** — already aligned with the editorial-not-algorithmic rule; no migration; `HomeCarousel` likely uses a similar pattern already. | No — proceed with in-code. |
| 2 | **Hero balance** (trajectories as hero vs. co-equal with search) | **Already resolved by what shipped.** Survival curve is the hero; search is demoted to nav. The B9 code pass should not reopen this. | No. |
| 3 | **Featured trajectory count** (3 on desktop, N on mobile) | **4 desktop, up to 6 mobile swipe.** Matches HomeCarousel patterns. | No. |
| 4 | **"Changed status" feed timestamp** | **Already resolved.** `ClaimStatusHistory` has a `createdAt` column (standard Prisma field). `loadRecentTransitions` in `lib/feed.ts` uses it. No new column needed. | No. |
| 5 | **Black-hole canvas keep or retire** | **Already resolved — retired.** HomeHero is a server component with no canvas. | No. |
| 6 | **Hook copy authoring** (agent drafts vs. owner writes) | Recommend: **agent drafts 5 candidate hooks from the real trajectory set** (h-pylori, semaglutide, roe-dobbs, smoking-cancer, cfc-ozone) for owner to approve/edit before shipping. If owner wants to write them directly, that blocks B9-2 until they're provided. | **BLOCK CODE** — discovery-rail copy must be author-approved before it ships. Agent can draft candidates in B9-2 for your review, but final text needs a yes. |

**Summary:** Only §6 item #6 (hook copy) is a hard block on B9-2 code. All other decisions are already resolved or have a clear default. Recommend agent drafts hooks as part of B9-2 with an explicit owner sign-off step.

---

## 3. Nav target table

> **Key:** KEEP = no change needed · GRADUATE = move out of ⚗ Lab · CUT-FROM-NAV = hide from nav, URL stays reachable · RENAME/REDIRECT = nav label or route change · NEEDS-OWNER-DECISION = can't proceed without a yes

### Explore group

| Current Item | Current Group | Proposed Disposition | Reason |
|---|---|---|---|
| Settling Curve | Explore | **KEEP + PROMOTE** — make primary link (not dropdown) | Flagship visual; mockup nav shows this as a top-level item |
| Search | Explore | **KEEP** (already has standalone Search button in nav bar) | Redundant in dropdown since it has a dedicated search button |
| Trajectory Encyclopedia | Explore | **KEEP** | Core surface; graduates alongside /settling-curve |
| Topic Taxonomies (`/fields`) | Explore | **KEEP** | Useful browse surface |
| Evidence Chains (`/prereq-graph`) | Explore | **KEEP** | Niche but correct placement |

### Analyze group

| Current Item | Current Group | Proposed Disposition | Reason |
|---|---|---|---|
| Settling Rate | Analyze | **KEEP** | Backs the paper's Fig. 1 analysis |
| Congress Trades | Analyze | **KEEP** | Flagship accountability feature |
| Browse Votes | Analyze | **KEEP** | Backed by 140k Voteview records |
| Members | Analyze | **KEEP** | Companion to Votes |
| Financial (`/financial`) | Analyze | **KEEP** | Scope-explained in About rewrite |

### Discover group

| Current Item | Current Group | Proposed Disposition | Reason |
|---|---|---|---|
| Retraction Explorer | Discover | **KEEP** | Flagship — 26k+ retractions |
| Suppression & Amplification | Discover | **KEEP** | Flagship — named feature (PUBLISH-CHECKLIST P1 done) |
| Corrections | Discover | **KEEP** | P0 done — public flag form live |
| Court Opinions | Discover | **KEEP** | Backed by courtlistener data |
| Start Here | Discover | **KEEP** | Curated entry point; B3 landed |
| Stories | Discover | **KEEP** | 7 story pages with CitationButton |
| Reversals | Discover | **KEEP + PROMOTE** — consider primary link | Mockup had "Reversals" as top nav; B3 built the 4-section hub |
| Law Settler Curve | Discover | **NEEDS-OWNER-DECISION** — fold under Settling Curve or keep separate? | Overlaps with /settling-curve; could be a tab there |
| Bookmarks | Discover | **CUT-FROM-NAV** | User-specific utility page; not a flagship destination |

### Research group

| Current Item | Current Group | Proposed Disposition | Reason |
|---|---|---|---|
| What's New (`/feed`) | Research | **KEEP** | Live feed; B3 wired into homepage |
| Sources | Research | **KEEP** | Provenance page; P0 reconciled |
| Pipelines | Research | **CUT-FROM-NAV** | Development-level detail; stays reachable by URL; raw pipeline list is dev-only in prod already |
| Glossary | Research | **KEEP** | Reference utility |

### Lab group (⚗)

| Current Item | Current Group | Proposed Disposition | Reason |
|---|---|---|---|
| Globe (`/globe`) | Lab | **KEEP in Lab** (P2 wide-viewport layout void remains) | Renders with live density; layout cosmetics pending |
| Claims (`/claims`) | Lab | **KEEP in Lab** | P2 default-ordering issue (NARA caption wall); not graduation-ready |
| Topics (`/topics`) | Lab | **KEEP in Lab** | P1 taxonomy data (Pakistan mis-parented) needs owner DB action first |
| Events (`/historical-events`) | Lab | **KEEP in Lab** | Verified working; no urgent issues |
| Books (`/books`) | Lab | **GRADUATE** | Verified working, no issues (triage doc confirms) |
| Media Coverage | Lab | **KEEP in Lab** | P1 junk queries need a re-run of `populate-bill-coverage.ts` first |
| Global Legislation (`/foreign-legislation`) | Lab | **NEEDS-OWNER-DECISION** | Triage doc: "older sibling of /legislation, same data, different UI, no US." Options: (a) fold global search into /legislation and redirect; (b) rename nav label to "Global Legislation Search" to distinguish scope; (c) cut from nav, keep URL. |
| Legislation (`/legislation`) | Lab | **GRADUATE** | P1 country-zero fix (tracker tag) + P2 "never" flash fix both applied in triage pass |
| Topic Trends (`/analysis/topics`) | Lab | **KEEP in Lab** | Verified working; no urgent issues |
| Vote Analysis (`/analysis/votes`) | Lab | **GRADUATE** | P1 raw tag fix + P2 loading skeleton both applied in triage pass |
| Statistics (`/stats`) | Lab | **KEEP in Lab** | Verified working; graduation not explicitly recommended in triage |
| Representation (`/analysis/representation`) | Lab | **GRADUATE** | Verified working; B-series added clickable topic drill-downs |
| Retraction Lag | Lab | **KEEP in Lab** | P2 duplicate-count cosmetic; not blocking but not clean either |
| Retraction Wall | Lab | **GRADUATE** | P1 ranking fix (cite count instead of CONTRADICTS count) applied in triage pass |
| Drug Arc (`/drug-arc`) | Lab | **GRADUATE** | Verified working; funnel proportionality footnoted |

### Not in current nav — disposition needed

| Item | Current Group | Proposed Disposition | Reason |
|---|---|---|---|
| `/sports` (Sections A–E) | Not in nav | **NEEDS-OWNER-DECISION** | PUBLISH-CHECKLIST P1: 197-entry sports catalog is weakest-fit content. Options: (a) cut A–E entirely; (b) keep page, rename any future nav entry to "Sport Science" per About rewrite. Not in nav today — decision only matters if owner wants to surface it. |
| `/globe/lab` (paleogeography) | Not in nav | **CUT-FROM-NAV** | PUBLISH-CHECKLIST P1: "charming, off-mission, orphaned." Already unlisted; confirm no inbound links. |
| `/open-questions` (B3 new) | Not in nav | **NEEDS-OWNER-DECISION** — add to Research or Discover? | B3 built this (50 longest-dormant CONTESTED claims). Linked from /start-here and /feed but no nav entry. |
| `/split-ledger` (B4 new) | Not in nav | **NEEDS-OWNER-DECISION** — add to Analyze or hold? | B4 built divergence tiering; B3 recommended owner greenlight before surfacing. |

---

## 4. "Block code" items and owner decisions needed

Before B9-2 (homepage code) can proceed:

1. **Hook copy** (§6 #6): Agent can draft 5 candidate hook lines in B9-2 for owner approval. If owner wants to provide them directly, share before B9-2 starts.

Before B9-3 (nav trim) can proceed:

2. **Law Settler Curve** disposition — fold under /settling-curve or keep as Discover item?
3. **Global Legislation vs. Legislation** — fold, rename, or cut-from-nav?
4. **/open-questions** — add to nav (where?) or leave as linked-but-unlisted?
5. **/split-ledger** — owner greenlight to surface in nav?
6. **Sports Sections A–E** — cut or keep? (Only matters if planning to add back to nav.)

Items #2–6 are **nav-trim block code**. B9-2 (homepage code) can proceed without them.

---

_Produced 2026-07-14. Read files: `HOMEPAGE-REDESIGN-PLAN.md`, `docs/design/v1-landing-mockup.html`, `docs/lab-pages-triage-2026-07-03.md`, `PUBLISH-CHECKLIST.md`, `app/page.tsx`, `app/HomeHero.tsx`, `app/HomepageSections.tsx`, `app/components/Nav.tsx`, `CONSULTANT.md`, `briefs/2026-07-13-b3-report.md`, `briefs/2026-07-14-b4-report.md`, `briefs/2026-07-14-b5-report.md`._
