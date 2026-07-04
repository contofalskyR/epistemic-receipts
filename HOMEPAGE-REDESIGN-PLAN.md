# Homepage Redesign — Implementation Plan

_Authored 2026-06-22. Scope: turn the search-first homepage into a "Wikipedia meets a live epistemic dashboard" landing experience, and fix the layout/proportionality problems along the way._

This plan maps every proposed change to concrete files, components, and data sources already in the repo, in the order I'd ship them. It is grounded in a read of the current code (`app/page.tsx`, `app/HomeHero.tsx`, `app/HomepageSections.tsx`, `app/layout.tsx`, `app/components/Nav.tsx`, the `/api/*` routes, and `prisma/schema.prisma`) and a live audit of `epistemic-receipts.vercel.app` at desktop width. Local `HEAD` equals `origin/main`, so the deployed site matches the code referenced here.

---

## 1. The core problem (confirmed)

The homepage renders `HomeHero` (client search island) wrapping `HomepageSections` (server-rendered bands). Above the fold a first-time visitor sees only: a large headline ("What fact would you like a receipt for?"), a search box, ten chips, and an off-center black-hole starfield. The value proposition — the settling curve, the representation gap, 1.6M sourced claims — is entirely below the fold or buried in nav dropdowns.

The data is genuinely impressive; the homepage shows almost none of it. Four of the most compelling assets already exist as routes and APIs but are **not wired into the homepage**:

| Asset | Exists at | Homepage uses it? |
|---|---|---|
| Settling curves (flagship visual) | `/settling-curve`, deep-linkable via `?t=<slug>` | No |
| Curated trajectories + metadata | `/api/history`, `/api/trajectories` | No |
| Live "what's new" feed | `/feed` (`loadPipelineBuckets`, `loadRecentThresholdEvents`) | No — homepage hardcodes a changelog instead |
| Inline search results | `/api/search` (already used in hero on keystroke) | Only after the user types |

The redesign is mostly **wiring existing capability into the front door**, not building new systems.

---

## 2. Diagnosis — what's busted / proportionality

Each item below was confirmed in code and/or the live audit, with the file to fix.

1. **Above-the-fold is a search-only void.** `HomeHero.tsx` hero section (≈ lines 357–393) is headline + input + chips + tagline over `BlackHoleCanvas`. No content, no hook. The black-hole graphic is off-center-right and visually collides with the chips and the "Start with a question" tagline.

2. **"Featured Claims" are arbitrary latest-by-axis rows, not trajectories.** `app/page.tsx` `loadHomepageData()` picks `findFirst({ orderBy: { createdAt: "desc" } })` per axis (lines 58–72). Live, the SETTLED card rendered an untranslated Russian statute ("Федеральный закон от 04.08.1994 г. № 16-ФЗ"), CONTESTED an obscure ECHR case, RECORDED a random judicial-confirmation vote. This is a poor, sometimes non-English first impression and has nothing to do with the settling-curve story the section title implies.

3. **"26 taxonomies" copy vs. 12 cards.** `HomepageSections.tsx` `DomainGrid` header says "26 taxonomies" (line ≈ 287) but `DOMAINS` only contains 12 entries (lines 49–162). Copy/data mismatch.

4. **The changelog is hardcoded and written for developers.** `CHANGELOG` is a static array in `HomepageSections.tsx` (lines 166–227), spanning June 1–19; the footer in `layout.tsx` (line 26) separately hardcodes "last updated June 19." Both are manual and will go stale. Entries read like git commits ("epistemicAxis badges wired across all claim surfaces," "113,319 Voteview roll-calls") rather than user-facing news, and they duplicate the real, live `/feed`.

5. **Bands can't go full-bleed; content widths are inconsistent.** `layout.tsx` wraps everything in `<main className="px-6 py-8">` (line 23). `StatsBar` is `w-full border-y`, so its band stops ~24px short of each viewport edge instead of bleeding — it reads as a slightly-inset box. The hero is `max-w-3xl` (768px) while every band below is `max-w-6xl` (1152px), producing a narrow-then-wide jump. `py-8` also adds dead space above the hero.

6. **"Browse by Topic" re-randomizes every load.** `page.tsx` does `[...allTopics].sort(() => Math.random() - 0.5).slice(0, 16)` (line ≈ 101). Live, this surfaces an arbitrary, foreign-parliament-heavy set (Slovak National Council, Luxembourg Chamber of Deputies, Taiwan ROC National Archives). It's non-deterministic, defeats caching consistency, and is the opposite of "curated entry points."

7. **Three overlapping "browse" affordances, no hierarchy.** `TOPIC_CHIPS` (10 hardcoded chips in `HomeHero.tsx`, lines 82–93) + `DOMAINS` grid (12 cards) + random `TaxonomyIndex` (16 chips). A new user gets three competing chip systems and no clear path.

8. **Nav overload buries the flagships.** `Nav.tsx` has 6 primary links plus three dropdowns totalling ~30 destinations. Settling Curve, Trajectories, Globe, and Representation — the genuinely compelling features — all live inside dropdowns.

9. **Mobile is an undifferentiated vertical stack (from CSS).** `StatsBar` is `flex-col sm:flex-row`, so on phones it stacks into five tall full-width number blocks (~500px of stats) before any content; `DomainGrid` collapses to one column (12 stacked cards); the settling curve never appears. (Note: I could not force a true mobile viewport through the browser tool — window resize didn't drop below the `md` breakpoint — so item 9 is from reading the Tailwind classes, not a screenshot.)

10. **Visual-language drift between flagship surfaces.** `TrajectoryEncyclopedia.tsx` and `SettlingCurve.tsx` use an inline hex palette (`C = { bg: "#08080f", … }`) distinct from the Tailwind `gray-950` system used on the homepage. The two most important surfaces don't look like the same product.

---

## 3. The redesign, mapped to files

### 3.1 Featured Trajectories hero (above the fold)

**Goal.** Replace the empty starfield with 2–3 rotating settling-curve cards, each with a one-line hook ("The cause of the 1918 flu wasn't settled until 2005 — an 88-year lag"). Keep search, but demote it beneath the trajectories.

**Data.** Trajectories are `Claim` rows with `externalId LIKE 'trajectory:%'` and a `statusHistory` (`ClaimStatusHistory`) of dated `toAxis` transitions. `/settling-curve` already deep-links via `searchParams.get("t")` (`SettlingCurve.tsx` line ≈ 201), where `t` is the `externalId` minus the `trajectory:` prefix — the same id `TrajectoryEncyclopedia` links with (`/settling-curve?t=${it.id}`).

There is **no "featured" flag** today. Two ways to curate, pick one:

| Option | How | Pros | Cons |
|---|---|---|---|
| **In-code curated set (recommended for v1)** | New `app/lib/featured-trajectories.ts` exporting `[{ slug, hook }]` for 4–6 hand-picked trajectories | No migration; fast; matches the repo's "editorial-not-algorithmic / curated lists" rule in `AGENTS.md` | Hook copy lives apart from the data |
| **`Claim.metadata` flag** | Write `metadata.featured = true` + `metadata.hook` on chosen trajectory claims via a seed script; query them in `loadHomepageData()` | Queryable, travels with the record | Needs a curation script + write path; more moving parts |

`Claim.metadata Json?` exists (`schema.prisma`), so the metadata path needs no migration if you prefer it later. Recommend shipping the in-code set first.

**Server fetch.** `app/page.tsx` is already an async server component with `revalidate = 300`. Extend `loadHomepageData()` to also load the featured trajectories (claim text, `statusHistory` markers, first/last year, key interval) for the curated slugs, and pass them into `HomeHero`.

**UI.**
- Extract a presentational `app/components/SettlingCurveMini.tsx` — a compact SVG sparkline of the markers (expert-literature/institutions dots across firstYear→lastYear with the "key interval" bracket), rendered from server-passed data. Do **not** mount the full 32KB `SettlingCurve.tsx` in the hero.
- New `FeaturedTrajectoryHero` (in `HomeHero.tsx` or a sibling) renders a rotating card: hook headline + `SettlingCurveMini` + "See the full curve →" linking to `/settling-curve?t=<slug>`. Auto-rotate on a timer (reuse the `useCyclingPlaceholder` pattern already in `HomeHero.tsx`), with manual dots.
- Demote the existing search block: smaller headline, input below the trajectory card.

**Retire/repurpose.** The current `FeaturedClaims` section (`HomepageSections.tsx` lines 368–384) and its `loadHomepageData` queries (lines 58–72) — replaced by curated trajectories.

### 3.2 Discovery rail (curated entry points)

**Goal.** One horizontally-scrollable strip of curated "follow this thread" entry points — not bare labels. E.g. "Follow the tobacco industry's funding claims," "How close were Senate votes on gun legislation?," "Watch semaglutide go from obscure peptide to $50B drug."

**Implementation.** New `app/lib/discovery-rail.ts` exporting `[{ label, blurb, href }]`, each `href` a pre-seeded search or destination (`/search?q=…`, `/congress-trades`, `/settling-curve?t=…`, `/analysis/representation`). Render as a scroll-snap row — the era-tab pattern in `TrajectoryEncyclopedia.tsx` (`flex gap-2 overflow-x-auto`) is the model. Place it directly under the hero.

**Consolidate the three chip systems.** Retire `TOPIC_CHIPS` (`HomeHero.tsx` 82–93) and the random `TaxonomyIndex` (`HomepageSections.tsx` 419–455) in favor of this one curated rail. Keep `DomainGrid` (it's good and data-driven) but fix its "26 taxonomies" copy (item 2.3) — either show the true `DOMAINS.length` or pull the real taxonomy count from `/api/fields`.

### 3.3 "What's new" feed (reason to return)

**Goal.** A live feed: trajectories recently added, claims that changed epistemic status, datasets recently ingested. Replace the hardcoded changelog.

**Implementation.** The logic already exists in `app/feed/page.tsx` (`loadPipelineBuckets` = recent claims grouped by pipeline over 7 days; `loadRecentThresholdEvents`). Extract that into `app/lib/feed.ts` so both `/feed` and the homepage use it. Add a compact `WhatsNewStrip` server component to `HomepageSections.tsx` (replacing `ChangelogSection`, lines 457–483) that shows the latest 4–6 items and links "See the full feed →" to `/feed`.

**Humanize.** The feed currently shows raw pipeline tags (`crossref_retractions_v1`). Map them to friendly labels (the `DOMAINS`/`sourceTags` data in `HomepageSections.tsx` is a starting dictionary).

**"Changed epistemic status" caveat.** `ClaimStatusHistory.occurredAt` is the *historical* date of the transition, not when it was ingested. To show "changed status this week" you need an ingestion timestamp on the history row (a `createdAt`). If that column doesn't exist, v1 should show "recently added trajectories" (by `Claim.createdAt`) instead — flagged as a decision in §6.

**Also fix.** Remove the hardcoded "last updated June 19, 2026" in `layout.tsx` (line 26) — derive from the latest claim `createdAt` or drop it.

### 3.4 Mobile-first settling curve

**Goal.** On phones, the hero *is* a full-screen, swipeable settling-curve carousel — the most compelling visual leads, instead of a search void above 500px of stacked stats.

**Implementation.**
- Reuse the curated featured-trajectory set (§3.1) and `SettlingCurveMini`.
- Below `sm`, render a full-viewport-height horizontal scroll-snap carousel (`snap-x snap-mandatory`, one trajectory per panel: hook + mini-curve + "full curve →"). Search collapses to a compact bar or icon at the top.
- Above `sm`, the same data renders as the desktop rotating card (§3.1) — one component, responsive.
- Fix `StatsBar` mobile height: change `flex-col` to a 2- or 3-column grid on mobile (`grid grid-cols-2`) so five stats don't consume ~500px.

**Performance.** Keep the hero server-data-driven (SVG from passed markers); avoid mounting `SettlingCurve.tsx` or fetching `/api/history` on the landing page.

### 3.5 Progressive disclosure (search that teaches itself)

**Goal.** Show the search bar, but also 3 example queries with results inline *before* the user types, so the format and depth are immediately legible.

**Implementation.** In `loadHomepageData()`, server-fetch results for 3 example queries (reuse the `/api/search` query logic directly against Prisma to stay within the RSC). Pass them to `HomeHero` and render with the existing `ClaimResult` card and `ResultsLegend` (already defined in `HomeHero.tsx`, lines 143–275) in a collapsed "example results" state that the live search replaces on keystroke. Near-zero new UI — it reuses what's there.

### 3.6 Proportionality & cleanup (the "fix what's busted" pass)

| Fix | File | Change |
|---|---|---|
| Full-bleed bands | `layout.tsx` (line 23) | Drop horizontal padding from `<main>` (`py-8` → `py-0` or vertical only); let each section own its padding so `StatsBar`/hero can reach the edges |
| Consistent content width | `HomeHero.tsx`, `HomepageSections.tsx` | Pick one container width (`max-w-6xl`) and constrain hero text internally; kill the 3xl→6xl jump |
| "26 taxonomies" | `HomepageSections.tsx` (≈ 287) | Show real count or pull from `/api/fields` |
| Random topics | `page.tsx` (≈ 101) | Replace random sample with curated rail (§3.2); make SSR-stable |
| Black-hole overlap | `app/components/BlackHoleCanvas.tsx` | Center/constrain behind hero, lower opacity, or retire in favor of the settling curve as the signature visual |
| Vertical rhythm | `HomepageSections.tsx` | Normalize `py-16`/`pb-20` to one spacing scale |
| Nav promotion | `Nav.tsx` | Promote Settling Curve, Globe, Trajectories, Representation to primary; thin dropdowns |
| Visual-language drift | `TrajectoryEncyclopedia.tsx`, `SettlingCurve.tsx` | Move the inline `C` hex palette to shared Tailwind theme tokens |

---

## 4. Sequencing

Ordered for value-per-day, with each phase shippable on its own.

- **Phase 0 — Cleanup (~½ day).** §3.6 items that need no new data: full-bleed/width fixes, "26 taxonomies," random→curated, footer date, mobile `StatsBar` grid. Immediate proportionality win, low risk.
- **Phase 1 — Hero + progressive disclosure (1–2 days).** Curated trajectory set, `SettlingCurveMini`, `FeaturedTrajectoryHero`, example-query results. The highest-leverage change.
- **Phase 2 — Discovery rail (~1 day).** Curated entry points; retire the two redundant chip systems; `DomainGrid` copy fix.
- **Phase 3 — Live "What's new" (~1 day).** Extract `lib/feed.ts`; `WhatsNewStrip`; retire hardcoded changelog.
- **Phase 4 — Mobile settling curve (1–2 days).** Swipeable full-screen hero; depends on `SettlingCurveMini` from Phase 1.
- **Phase 5 — Nav + theme + verify (~½ day).** Nav promotion, palette alignment, responsive screenshot pass at 390/768/1440.

Critical path: Phase 1's `SettlingCurveMini` unblocks Phase 4. Everything else is parallelizable.

---

## 5. Net file change list

**New**
- `app/lib/featured-trajectories.ts` — curated `{ slug, hook }[]`
- `app/lib/discovery-rail.ts` — curated `{ label, blurb, href }[]`
- `app/lib/feed.ts` — extracted recent-activity loaders
- `app/components/SettlingCurveMini.tsx` — SVG sparkline
- `app/components/FeaturedTrajectoryHero.tsx` — rotating/swipeable hero (or inline in `HomeHero.tsx`)
- `app/components/WhatsNewStrip.tsx` — live feed strip

**Modified**
- `app/page.tsx` — `loadHomepageData()`: add featured trajectories + example-query results; drop the three latest-by-axis queries and the random topic sample
- `app/HomeHero.tsx` — demote search; mount hero + example results; remove `TOPIC_CHIPS`
- `app/HomepageSections.tsx` — replace `FeaturedClaims` and `ChangelogSection`; fix `DomainGrid` copy; `StatsBar` mobile grid; retire `TaxonomyIndex`
- `app/layout.tsx` — `<main>` padding; footer date
- `app/components/Nav.tsx` — promote flagships
- `app/components/BlackHoleCanvas.tsx` — reposition/retire
- `app/settling-curve/SettlingCurve.tsx`, `app/trajectories/TrajectoryEncyclopedia.tsx` — share theme tokens

---

## 6. Decisions for you

1. **Trajectory curation:** in-code `featured-trajectories.ts` (recommended v1) or `Claim.metadata.featured`/`hook` seeded in the DB?
2. **Hero balance:** trajectories as the hero with search demoted below, or trajectories and search as co-equal above the fold?
3. **Featured count:** how many curated trajectories (3 on desktop, N swipeable on mobile)?
4. **"Changed status" feed:** does `ClaimStatusHistory` carry an ingestion timestamp? If not, v1 shows "recently added trajectories" and we add that column later.
5. **Black-hole canvas:** keep it as brand identity, or retire it and let the settling curve be the signature visual?
6. **Hook authoring:** want me to draft the actual hook copy and the discovery-rail entries from the real trajectory set, or will you write those?

---

## 7. Conventions to respect (from `AGENTS.md`)

- This is **Next.js 16** with intentional breaking changes — `AGENTS.md` says read `node_modules/next/dist/docs/` before writing code. The plan keeps data-fetching in the existing RSC (`loadHomepageData`) and the hero a thin client island, which fits the current structure.
- **Curated lists must trace to a verifiable source** and curation is **editorial, not algorithmic.** The curated trajectory hooks and discovery-rail entries fit this rule — they're hand-authored and point at real records, not model-invented.

---

_Sources: live audit of https://epistemic-receipts.vercel.app (homepage + `/settling-curve`); repo files cited inline; `prisma/schema.prisma`; `AGENTS.md`._
