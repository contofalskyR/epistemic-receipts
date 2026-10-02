# LATER.md — the one missing piece, per page

Distilled from `AUDIT.md` §B (2026-09-29) after front door phases 0–3 (2026-09-30). Every row is
a page that works but is not finished; the right-hand column is the single change that would
complete it. Pages deleted in phase 3 are not here (recover any from `archive/full-site`).
Read `STATUS.md` first; this file is the backlog it points to.

## 1. Congress as claims (do this first)

The Congress data — 1.8M `MemberVote` rows, `LegislativeVote`, `MemberIdeology` (51k), `ConstituentOpinion`
(25k), `BillCoverage` (16k), `congress_stock_act_v1` — is the largest body of real receipts on the site
and none of it is a Claim. Every Lab page built on it has the same missing piece:

| page | works today | the one missing piece |
|---|---|---|
| `/votes`, `/votes/[id]` | roll-call browser with source links | **votes are not claims**: no `Claim` + `ClaimStatusHistory` row per roll-call, so nothing links to a receipt |
| `/members`, `/members/[memberId]` | member search / profile, ~2k enriched votes | same — a member's record should list claims they voted on, not bare votes |
| `/congress-trades` | STOCK Act trades vs voting record | same — trades and votes need claim ids to line up as receipts ("small initial set" banner goes when they do) |
| `/analysis/votes`, `/analysis/ideology`, `/analysis/representation`, `/analysis/topics` | careful analytics (votes truncated at 50k) | same — bars and points never link to a claim |
| `/stats/media-coverage` | NYT coverage vs "dark-matter" bills | same — bills as claims would make tile and list totals reconcile |
| `/legislation` | country grid, trackers | omits five Nordic/EU pipelines (~25.8k claims); "12-hour refresh" is false |

The one piece: an ingester that writes one `Claim` per enacted bill / roll-call outcome (text, date,
Source = congress.gov record, `ClaimStatusHistory` = introduced → passed → enacted/failed) and a
`ClaimRelation` from each vote. After that, every page above gets `/claims/[id]` links for free and
the Analyze group can leave the Lab.

## 2. Front-door pages that are one step from finished

| page | the one missing piece |
|---|---|
| `/settling-curve/[id]` | draw the curve (the page is the best per-claim receipt but has no curve graphic; explorer link uses the CUID, not the slug) |
| `/canon` | make the DOI a link |
| `/opinions` | hide the Circuit filter until `courtlistener_circuits_v1` has rows (the typed "2,711" went in phase 6) |
| `/split-ledger` | apply `LIVE_CLAIM_WHERE` (the SQL keeps deleted/DEPRECATED rows); derive the "386" |
| `/communities` | derive the "~1.1M" largest-community figure from the live count |
| `/retraction-explorer` | field filter is a keyword heuristic; show the epistemic axis, not `updateType` |
| `/search` | "semantic" copy is false (full-text + embeddings only when available); mark DEPRECATED rows |
| `/` | hero implies the whole corpus while Fig. 1 is the dated cohort — one sentence of caption |
| `/glossary` | says "four-point" axis; the enum has five values |
| `/corrections` | a "/" placeholder link |
| `/methodology`, `/about` | dated counts (use `corpusCount()`); About links to no case study |
| `/license`, `/privacy`, `/terms` | governing-law placeholder, counsel TODOs, a personal email |
| `/stories/*` | prose has zero inline receipts — link claims from the text (content backlog) |
| `/sources` | 88% of cards are stubs (registry entries with no `caveats`/`method`) |
| `/patterns` | near-orphan — surface from `/settling-curve` |
| `/trajectories`, `/case-studies`, `/law-settler` | near-duplicates of `/settling-curve` / `/reversals` — fold or cross-link, one slot each |
| `/start-here` | duplicates home/stories — fold into `/` and delete (audit bucket LAB; kept public in phase 2) |

## 3. Lab pages worth promoting once the piece is in

| page | the one missing piece |
|---|---|
| `/analysis/settling-rate` | drill-down: bars link into curve lists |
| `/reader/[bookId]`, `/books` | a cleaned `/books` (its admin tooling spawns `npx ts-node`, dead on Vercel) |
| `/receipts/[id]` | inbound links (from each transition on `/claims/[id]`) — or delete |
| `/prereq-graph` | render `SUPERSEDED_BY`/`OUTCOME` edges distinctly, not just as "links" |
| `/meta-edges` | document URLs and claim links; show the event date, not the insert time |
| `/fields`, `/fields/[slug]` | `/fields` never links to `[slug]`; header count is a raw join |
| `/drug-arc` | heat-map is substring matching — match on RxNorm/ChEBI ids |
| `/historical-events/[slug]` | shows the deprecated `currentStatus` instead of the axis |
| `/globe` | one "claims" basis for hover, sidebar and density (§C.2) |
| `/feed` | honest empty state when pipelines idle for 7 days |
| `/topics` | tree counts now match the detail (phase 1); needs a reason to exist beside `/topics/[slug]` |
| `/domains/[domain]` | duplicates `/topics`; titles are raw slugs |
| `/statistics`, `/statistics/methods`, `/statistics/explorer` | no DB ties; nav collision with `/stats`; fetch failure loads forever |
| `/datasets/snapshots` | empty; claims CC BY 4.0 against `/license` — fill or delete |
| `/retractions`, `/retraction-wall` | fold into `/retraction-explorer` (feed docs → footer; wall → a tab) |
| `/labs/claim-diff` | empty unless enrichment ran |
| the 33 taxonomies (`/history`, `/physics`, …) | 0 source URLs; badges mimic the axis — source them or keep them Lab (content backlog) |

## 4. Infrastructure

| item | the one missing piece |
|---|---|
| link-integrity test | done in Phase 4 (2026-09-30): `tests/unit/link-integrity.test.ts` (anonymous surface incl. `components/`, `lib/`, template hrefs; every href exists) + the CI "Unit tests" step |
| `middleware.ts` | Next 16 renames it `proxy.ts` (Node runtime); `tests/integration.test.ts` imports `{ middleware }` — rename in its own PR |
| Prisma schema | done 2026-09-30: `prisma/migrations/20260930120000_phase3_drop_saas_social_auth` applied to production (23:15:52 UTC); the 20 tables are gone |
| `metadata` on Source/Edge/MetaEdge | queued migration (AGENTS.md) |
| six claims written after the restore | find the writer (a cron or ingest route) |
| `use cache` | `unstable_cache` is "replaced by `use cache`" in Next 16; migrating needs `cacheComponents: true` (whole-app rendering change) — its own PR, after the front door settles |
| optional claim-page panels | `WhatHappenedNextPanel`, `ClaimRelationsPanel`, `TopicTimeline` hide on a failed fetch (they never claim zero) — a one-line error would be more honest than silence |
| `/settling-curve` payload | the SSR grid ships all 5,698 curated cards (~3 MB of RSC props) on every visit; paginate or stream the grid |
| MCP endpoint | unauthenticated read-only, over the public claim graph (`isPublicRoute` / `LIVE_CLAIM_WHERE`); phase 3 deleted the key-gated `/api/mcp` + `lib/v1` — recover the tool surface from `archive/full-site`, drop the key |

## 5. Review findings, 2026-10-01 (not yet scheduled)

Found by the read-only review of front door phases 4–5 (2026-09-30/10-01) and not fixed by phase 6. Pre-existing
unless marked "phase 5".

- **OG cards:** the fallback card is cached for a day when the DB errors (`app/api/og/{claim,trajectory,receipt}/route.tsx`
  catch blocks reuse the success `Cache-Control`); "☆" renders as a missing-glyph box (90 claims; the Google-font
  fallback 400s); curves whose transitions share one year stack at the left edge (228,298 claims); the claim-card
  caption uses the stored `epistemicAxis` instead of `resolveDisplayAxis` (61 claims contradict their page); NULL-`seq`
  rows sort differently on the card and the page (366 claims); the evidence count drops when `claimEmergedAt` is null
  (1 claim); `/api/og/*` has no rate limit (the CDN is the only throttle); phase 5 made the trajectory card invent a
  "Recorded <current year>" dot for claims with no history.
- **Error handling:** `app/error.tsx` Retry calls `reset()`, which re-renders the cached payload and never refetches
  (phase 5); no `app/global-error.tsx` (a root-layout DB failure gives an unbranded 500); uncached receipt pages fail as
  a 21-byte `text/plain` 500 on DB errors; `/reversals` rails (`DomainCurveRail.tsx`) swallow DB errors and ISR caches
  the page without them; `/feedback` sticks at "Sending…" on a network failure.
- **Counts:** homepage "26,679 retracted papers" links to a page saying 26,624 (and 29 of the 55 Retraction Watch rows
  repeat Crossref papers); homepage "241,501 settling curves" counts 21 deleted claims (`lib/curve-counts.ts:29` lacks
  `deleted = false`; `/patterns` says 241,480); the hero ties "1.76M" to Fig. 1, which is computed from 5,698 dated
  trajectories; `/opinions` says every opinion is "linked to related legislation" (0 of 2,778 are); `/split-ledger`
  "Of 3,367 claims tracked across multiple communities" is the disagreeing subset (3,475 are multi-community).
- **Machine lens:** `/api/history?lens=machine` ORDER BY has ties, so ~29% of the 1,000 cached rows reshuffle on every
  regeneration (paging can repeat or skip rows).
- **Caching duplication (phase 5):** the curated trajectory list is cached once per server bundle (page runtime + route
  runtime) — two cold fills, independent revalidation; the SSR grid and `/api/trajectories` can disagree for up to an
  hour after a curated change.
- **Explorer:** `/settling-curve` replaces its server-rendered grid with skeletons while the 5.8 MB list refetches
  (`SettlingCurve.tsx` sets `listLoading` on mount despite the initial list); the list error is a custom banner without
  `role="alert"`; counters print without separators ("LOAD MORE · 10674 REMAINING"); "1 transitions".
- **Data:** 873 Crossref journal names stored HTML-escaped ("Science &amp; Justice"); the receipt page "← all claims"
  link goes to `/`; two admin POST handlers skip `isReadOnly()` (`app/api/books/[bookId]/match`, `request-analysis`);
  `app/api/login` caps no field length.
- **CI:** Node 20 is end-of-life while 5 dependencies declare Node ≥22 (`ai`, `@ai-sdk/*`); no `engines` field or
  `.nvmrc`.
- **Docs:** `docs/CONSULTANT.md` keeps an old absolute WHITEPAPER path; `specs/11-provenance-and-data-cards.md:26`
  reads "AGENTS.md/docs/ROADMAP.md"; the archived whitepaper's `figure1.png` link broke (image left at the repo root).
- **Search copy:** the zero-result state says "your search just counted" — nothing is recorded
  (`app/search/SearchClient.tsx`).
- **Server log:** one transient `Connection terminated unexpectedly` (a dropped pg connection) near the end of the
  review run; not reproduced.

Found during phase 6 (2026-10-01), left for later:

| item | the one missing piece |
|---|---|
| robots and client-rendered pages | `Disallow: /api/` (now actually served) keeps crawlers from the read APIs that `/topics/[slug]` (460 sitemap URLs), `/opinions` and `/retraction-explorer` render from, so those pages index without their data. Owner decision: `Allow` those reads, or render them server-side |
| router navigation on ISR pages that read their own query | after a deep link with a query, the client router keeps a hydration route-cache entry that sends every `<Link>` to the page back to that query for 5 minutes. Phase 6 renders `/retraction-explorer` (stats cached) and `/corrections` per request and moves the explorer's filters with `history.pushState`; the same pattern remains in Lab `PrereqGraphClient` and `CongressTradesClient` (ISR, `router.push` on their own search params) |
| one ISR 404 per bogus id | `/claims/[id]`, `/settling-curve/[id]` and `/datasets/[tag]` now return real 404s, and ISR caches one per unique unknown id; for `/datasets/[tag]` (tags are code) `dynamicParams = false` would bound it |
| `@stoplight/spectral-cli` | unused since phase 6 deleted the API-contract workflow — uninstall is the owner's call |
