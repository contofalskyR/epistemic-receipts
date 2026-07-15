# B9 Report — Homepage Convergence + Nav Trim
_Branch: `loop/site-b9-2026-07-14` · Commits: B9-1, B9-2, B9-3_

---

## B9-1 — Reconciliation delta note
**Status: shipped** (prior commit)
The delta note for owner review: plan-vs-current audit, §6 decisions, nav target table. Owner decisions finalized before B9-2 began.

---

## B9-2 — Homepage convergence

### `lib/featured-trajectories.ts`
Module already existed in `main` (shipped in the June 22 "settling-curve hero" commit). Three curated trajectories with owner-written hooks:
- `semaglutide-glp1` — THE RISE
- `pluto-discovery-1930` — THE DEMOTION
- `oxycontin-reduced-abuse-liability-1995` — THE REVERSAL

No new trajectories added — adding entries requires hook copy, which is owner-blocked.

### Hook candidates (`briefs/b9-hook-candidates.md`)
Five candidate site-hero one-liners for the `h1` headline:
1. How long does "settled" stay settled? *(existing, safe default)*
2. Knowledge changes. We keep the receipts.
3. The science was settled. Then it wasn't.
4. Every claim has a birthday. Some have a death date.
5. A research observatory of claims, aging in public.

**Hook placeholder in code:** `{/* HOOK: owner picks from briefs/b9-hook-candidates.md */}` sits above the `h1` in `app/HomeHero.tsx`. No visible gap — the existing headline renders until owner picks.

### Discovery rail
`lib/discovery-rail.ts` (6 curated hooks: H. pylori, plate tectonics, stem-cell fraud, representation gap, retraction web, Congress trades) was already written in main but **not wired** to the homepage. B9-2 adds `DiscoveryRail` function in `HomepageSections.tsx` — a scroll-snap row labeled "Follow a thread" rendered after StartHere.

### Mobile carousel (§3.4)
New `app/components/MobileTrajectoryCarousel.tsx` — server component, no client JS. Renders `block sm:hidden`. Each card shows:
- Eyebrow tag + claim text
- `{/* HOOK ... */}` placeholder comment (no visible gap — claim text fills the card)
- `SettlingCurveMini` sparkline from embedded fallback milestones
- "See the full curve →" link to `/settling-curve?t=<id>`

Desktop hero (`HomeHero` + `HomeSurvivalFig`) wraps in `hidden sm:block`. At 375px, the snap carousel leads; at ≥640px, the survival fig leads.

### Layout padding
`layout.tsx` `px-6 py-8` is intentional (needed for ~80 non-homepage routes; June 22 commit reasoning). `HomeHero`'s internal top padding reduced from `pt-8 sm:pt-14` to `pt-2 sm:pt-6` — eliminates ~32px of stacked dead space above the headline. Tracked in code comment.

### ISR
`revalidate = 3600` preserved on `app/page.tsx`. OnThisDay's revalidate unchanged (lives in its own component with its own revalidate).

### Server-render
`HomeHero` is a server component — hero claim text, eyebrow, and headline all appear in view-source. `MobileTrajectoryCarousel` is also server-rendered. No hero content gated behind JS.

---

## B9-3 — Nav trim

### Nav before/after

| Route | Before | After | How |
|---|---|---|---|
| `/settling-curve` | Explore group | Explore group (unchanged) | — |
| `/law-settler` | Discover group | Discover group (kept) + Law Doctrine tab in SettlingCurveNav | Both, per owner decision |
| `/foreign-legislation` | Lab group ("Global Legislation") | **Removed from nav** | Permanent redirect → `/legislation` |
| `/legislation` | Lab group | Lab group (desc updated to cover both scopes) | — |
| `/open-questions` | Not in nav | **Discover group** (new) | Graduated |
| `/split-ledger` | Not in nav | **Discover group** (new) | Graduated |
| Sports A–E | Not in nav | Not in nav | Confirmed absent, no change |
| `/bookmarks` | Discover group | **Removed from nav** | Cut; reachable from /feed |

### Redirect
`next.config.ts`: `{ source: "/foreign-legislation", destination: "/legislation", permanent: true }` — old URLs, bookmarks, and inbound links resolve correctly.

### PUBLIC_ROUTES
Added `/open-questions` and `/split-ledger` (both now in Discover nav; must be whitelisted on the public edition). `/start-here`, `/stories`, `/reversals` were already listed.

### Sitemap
`/open-questions` and `/split-ledger` were already in `STATIC_URLS` — no sitemap change needed.

### Orphan check
Every removed/trimmed nav item is reachable:
- `/foreign-legislation` → permanent redirect to `/legislation` ✓
- `/bookmarks` → linked from `/feed` (BookmarkedActivity component) ✓
- Sports A–E → URL still resolves (`/sports` page exists) ✓
- No other nav items removed (Pipelines was already CUT-FROM-NAV in prior B-series)

---

## B9-4 — Verification

- `npx tsc --noEmit`: **clean** (0 errors)
- ESLint on all touched files: **clean** (0 warnings)
- Homepage stats derive from live DB queries (`loadHomepageData()`) — verified spot-checked: `claimCount` comes from `prisma.claim.count`, `transitionCount` from `prisma.claimStatusHistory.count`, `retractedPapers` from the per-pipeline grouped query. No hand-written numbers.
- Mobile viewport 375px: `MobileTrajectoryCarousel` renders via `block sm:hidden` (`sm` = 640px breakpoint). Path is component-logic verified — the `sm:hidden` class hides the carousel above 640px, showing it at 375px. `HomeHero` wraps in `hidden sm:block` (inverse).
- All former nav destinations reachable: confirmed via orphan check above.
- Vercel preview: will trigger on push (CI checks PR preview URL).

---

## Deferred

- **Hero hook pick** — owner must pick from `briefs/b9-hook-candidates.md`. The existing h1 ("How long does 'settled' stay settled?") serves until then. Update: replace the `{/* HOOK: ... */}` comment near the `h1` in `app/HomeHero.tsx`.
- **Featured trajectory expansion** — adding more entries to `FEATURED_TRAJECTORIES` requires new hook copy per trajectory. Unblocked once owner picks the site-hero hook.
- **MATERIAL-QUEUE items** — `nav-trim` and `homepage-convergence` queue items are superseded by this brief.
