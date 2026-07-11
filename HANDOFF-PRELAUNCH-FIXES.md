# Handoff — prelaunch fixes (already implemented, needs ship)

> **2026-07-10 UPDATE:** All fixes described below are shipped to `main` (last commit: `1b5f030`). Read this as historical record, not a todo list. Cross-reference `git log` for the definitive commit history.


**Status: the code is written and in the working tree. This is NOT a build-from-scratch
spec — it's a review-and-ship handoff.** Everything below is already applied to
`epistemic-receipts` (Next 16). `tsc --noEmit` passes (exit 0); ESLint is clean on
touched files; pure logic is unit-tested. A full `next build` was NOT run (the build
environment used had no DB connectivity). Nothing is committed or pushed yet.

## The one-paragraph version
Review the diff, run `npm run build` locally, commit, push. Pushing also refreshes the
stale ISR/CDN copies that crawlers and social scrapers currently see. Four things are
NOT code and remain open (see "Not done" below).

---

## Verify locally before pushing
```bash
npm install            # if needed
npx tsc --noEmit       # expect exit 0
npm run build          # <-- the step I could NOT run; do this before trusting the deploy
```
Then spot-check after deploy:
- `/sitemap.xml` returns a `<sitemapindex>` (was 404).
- `/case-studies` renders ~60 curated items (was "No case studies found").
- A claim with transitions (e.g. `/claims/cmqoappnu03yxsadpa90nu942`) shows transition
  nodes on its timeline and its page no longer contradicts its OG "latest transition" text.
- Search "pluto" — no literal `<i>`/`<sup>` tags in results.
- Homepage: retracted-papers stat == Retractions domain-tile count.

---

## What changed and why (file-by-file)

**Launch blockers**
- `app/case-studies/page.tsx` — query used `ingestedBy:"manual"`; curated trajectories are
  tagged `seed:*`, so it matched 0 rows and the page was empty. Now filters by the
  `trajectory:` externalId prefix and presents a curated set (featured hooks first, then
  reversals / ≥3-transition arcs, capped 60). **Judgment call — confirm the editorial bar
  matches intent.**
- `app/sitemap.xml/route.ts` (NEW) — `generateSitemaps()` only serves `/sitemap/[id].xml`;
  robots.txt advertised `/sitemap.xml`, which 404'd. This route emits the `<sitemapindex>`
  pointing at the real chunks. Keep its `CHUNK`/id logic in sync with `app/sitemap.ts`
  (comment added there too).
- `app/layout.tsx` — footer credit pointed at the non-resolving apex `robertcontofalsky.com`;
  now `https://www.robertcontofalsky.com/` (www host works). Also updated the default meta
  description off "1M+ verified facts" to match the homepage's 1.6M framing.
- `app/security-studies/page.tsx`, `app/communication/page.tsx` — both linked `/political-science`,
  which has no route (only hard-broken internal link in the codebase). De-linked to plain text.

**Claim-page timeline contradiction (data-read bug)**
- `lib/claim-detail.ts` — `statusHistory` was `take:1`; the page timeline ignored it entirely,
  so pages rendered "Dormant · no revisions" while the OG/meta description cited a transition.
  Now selects the full transition list (added `community`, dropped `take:1`). NOTE: this file
  is the documented COLD-CRAWL HOT PATH — the list is bounded (≤ dozens per claim) but watch
  for perf on high-transition claims. `statusHistory[0]` is still the latest (order stays
  `occurredAt desc`), so `lib/jsonld.ts` and `generateMetadata` remain correct.
- `app/claims/[id]/page.tsx` — rebuilt `ClaimTimeline` to render three node kinds (emergence,
  dated sources, status transitions) instead of only dated sources mislabeled "Claim emerged."
  Fixes the bogus age math ("13.6 yrs" on an 87-yr claim) and duplicate emergence labels.
- `app/claims/[id]/ClaimInteractive.tsx` — bare `toLocaleDateString()` → `"en-US"` (locale
  hydration mismatch, source of the React #418 in console).

**Homepage counts / tiles**
- `app/page.tsx` — retraction stat now derives from the same grouped query as the tiles
  (crossref + retraction_watch) so the stats bar and Retractions tile can't disagree; the
  per-pipeline query now excludes NULL-verificationStatus rows to match the headline/pipelines
  totals.
- `app/HomepageSections.tsx` — "Neuroscience = 318k" was the whole OpenAlex corpus mislabeled;
  renamed to "Academic Literature." Removed the 99-claim Biology tile (read as a bug next to
  300k tiles). Fixed dead ingestedBy keys (`world_bank_v1`→`worldbank_v1`; dropped nonexistent
  `ipcc_v1`, `faers_adverse_v1`). **Verify tile counts against `/pipelines` after deploy** — a
  couple of keys (`congress_bills_tracker_v1`, `congress_stock_act_v1`) were inferred.

**Text escaping**
- `lib/text.ts` (NEW) — `cleanDisplayText` strips real markup tags THEN decodes entities
  (order matters; unit-tested). Applied in `app/search/SearchClient.tsx`,
  `app/retraction-wall/page.tsx`, `app/retraction-explorer/RetractionExplorerClient.tsx` to
  kill literal `<i>Context</i>` (OpenAlex abstracts) and `Science &amp; Justice` double-escape.

**Metadata / SEO**
- Added `export const metadata` to `app/{about,feed,fields,books,datasets,timeline,drug-arc}/page.tsx`.
- Added metadata-only `layout.tsx` for client pages that can't export it themselves:
  `app/{glossary,meta-edges,topics,claims,bookmarks,feedback}/layout.tsx` (NEW).

**Hygiene**
- `app/sources/SourcesClient.tsx` — `book-analysis:<cuid>` leaked raw; `displayTag()` genericizes
  the label (DB tag untouched).
- `.gitignore` — added `*.bak`, `*.log.attempt*`.
- `app/about/page.tsx` — added metadata; escaped a stray apostrophe.

**Tooling / docs (NEW, not wired into the app)**
- `scripts/find-duplicate-trajectories.ts` — lists near-duplicate curated trajectories
  (read-only) or `--deprecate` to flag non-kept members `verificationStatus=DEPRECATED`.
- `AUDIT-PRELAUNCH-2026-07-06.md`, `DUPLICATE-TRAJECTORIES-2026-07-06.md` — findings.

---

## NOT done — needs a human or a follow-up pass
1. **Curate the 2 whitepaper-cited claims** (`cmqwoxe6l07dy8o0y6xrs8xnv`,
   `cmqoappnu03yxsadpa90nu942`) — still UNREVIEWED with unsourced 50/100 scores. Content work.
   (The timeline-contradiction *rendering* bug is fixed for all claims, but these two still
   need real review + sourced transitions before the paper circulates.)
2. **Duplicate trajectories** — 265 groups / 316 removable. DB write = owner's call. Run
   `npx tsx scripts/find-duplicate-trajectories.ts` (list) then `--deprecate` (apply). The
   keep-pick heuristic is imperfect; review + use `KEEP_OVERRIDES`.
3. **`git rm --cached`** the tracked junk (the sandbox was read-only for these):
   `app/opinions/OpinionsClient.tsx.bak`, `.pipeline-openfda-labels-full.log.attempt1`,
   `.pipeline-openfda-labels-full.log.attempt2` (now gitignored).
4. **Public-edition ops** — set `NEXT_PUBLIC_EDITION=lab` before publicity so the lab site
   stops being indexed; do the second-Vercel-project steps in `PUBLISH-CHECKLIST.md` when ready.

## Deliberately left alone (pre-existing, not my regressions)
`Date.now`-in-render (`app/retraction-wall/page.tsx:175`), setState-in-effect
(`app/search/SearchClient.tsx`, `app/retraction-explorer/…`), and two unused-var warnings
(`WhatsNewItem`, `ALL_CATEGORIES`). Identical at HEAD; the build tolerates them. Clean up
separately if desired.
