# LATER.md — the one missing piece, per page

Distilled from `AUDIT.md` §B (2026-09-29) after front door phases 0–3 (2026-09-30). Every row is
a page that works but is not finished; the right-hand column is the single change that would
complete it. Pages deleted in phase 3 are not here (recover any from `archive/full-site`).
Read `STATUS.md` first; this file is the backlog it points to.

## 1. Congress: link, correct, relate (do this first)

Owner decision 2026-10-12 (`docs/phase7-questions.md`): the premise "none of it is a Claim" was wrong.
`voteview_v1` (113,319 roll-calls), `congress_v1` (10,360 laws), `congress_bills_tracker_v1` (17,280),
`congress_votes_v1` (505) and `congress_stock_act_v1` (921) are claims already. The work is to correct
them, link them and relate them, not to ingest. Order: (2) Senate cloture corrections → (6) vote → law
relations → (7) duplicates → (8) `legislativeVoteId` keys → (13) `/votes` + `/members` leave the Lab.

| page | works today | the one missing piece |
|---|---|---|
| `/votes`, `/votes/[id]` | public since Q13 (2026-10-13): claim links, "Result under review" on 814 votes | fix the 814 in per-type batches, then rebuild `data/vote-results-under-review.json` |
| `/members`, `/members/[memberId]` | public since Q13: US bioguide members, senator ids merged | member-level votes cover the landmark subset only (Q10); 6,185 votes with no member id (below) |
| `/congress-trades` | STOCK Act trades vs voting record | relabel the 921 trades as secondary sources credited to Quiver Quantitative (Q9); the set does not grow |
| `/analysis/votes`, `/analysis/ideology`, `/analysis/representation`, `/analysis/topics` | careful analytics (votes truncated at 50k) | bars and points link to claims; these stay Lab (Q13) |
| `/stats/media-coverage` | NYT coverage vs "dark-matter" bills | BillCoverage stays background data, not claims (Q14) |
| `/legislation` | country grid, trackers | omits five Nordic/EU pipelines (~25.8k claims); remove the false "auto-refreshes every 12 hours" sentence (Q11) |

### Vote results still wrong after batch 1 (`scripts/correct-senate-cloture.ts`)

Batch 1 corrects the 475 Senate cloture votes since 1989 whose Voteview `vote_result` says the motion
was rejected. Voteview's `vote_result` usually names what happened to the measure, not whether the yeas
won (an 80–20 vote to table an amendment is "Amendment Rejected"), so each remaining group needs its
own rule. No guessing from description text. Census 2026-10-12 against `HSall_rollcalls.csv`:

| group | claims | the rule it needs |
|---|---|---|
| Senate cloture votes, 1975–1988 (94th–100th) | 122 stored passed/tied with "CLOTURE" in the description | Voteview has no `vote_result` before the 101st; match each to the Senate's own cloture table (senate.gov "Senate Action on Cloture Motions"), which lists every cloture vote and its outcome |
| House motions to suspend the rules (2/3) | 238 stored passed, Voteview "Failed" | `vote_question` is "On Motion to Suspend the Rules…" and yeas < 2/3 of those voting → failed |
| Senate 3/5 votes other than cloture | 300 | mostly motions to waive a budget point of order: confirm the question is a waiver and yeas < 60 → failed |
| Senate 2/3 votes | 45 | veto overrides, treaties, constitutional amendments, convictions: per question type, yeas < 2/3 of those present and voting → failed |
| Senate ties | 85 tied → failed, 51 + 15 cloture tied → passed, 39 at 2/3 or 3/5 | Voteview's counts omit the Vice President: a tie the VP broke passed (say so in the text), any other tie failed |
| House ties | 27 tied → failed, 2 tied → passed | a House tie fails; the 2 "Agreed to" ties need the Clerk's roll-call page |
| contradictions | 5 Senate passed → failed at 1/2, 4 Senate failed → passed, 3 House close votes | `vote_result` contradicts the tally or the description: check each against senate.gov / clerk.house.gov by hand |
| batch-1 thresholds | 2 (RS1080451, RS1160596) | Voteview's `majority_requirement` says 1/2 for cloture votes that needed 3/5; batch 1 kept Voteview's value |

### Vote → law links (`scripts/link-votes-to-laws.ts`, 12,285 VOTE_ON written 2026-10-13)

| item | the one missing piece |
|---|---|
| H.J.Res. 368 (97th Congress) | Voteview's Senate roll call 426 on 1981-11-28 names it, but the `congress_v1` law claim `cmpcume1n02cppls2llu6x4x6` says enacted 1981-11-23 (the day of the 1981 shutdown veto), so the vote was left unlinked. Check the enactment date against Congress.gov / the Statutes at Large; fix the law claim if it is wrong, then rerun the linker (it adds only this pair). |
| 119th-Congress tracker bills | VOTE_ON links only `congress_v1` laws; votes on `congress_bills_tracker_v1` bills that have not become law are not linked (Q5/Q6 scope). |

### Voteview claim texts (full descriptions restored 2026-10-13)

`scripts/restore-voteview-full-text.ts` put the full Voteview description back into the 85,987 `voteview_v1` claim
texts the import had cut to 80 characters (old text in `metadata.corrections`, batch `voteview-full-text-2026-10`).

| item | the one missing piece |
|---|---|
| two 1995 table fragments | Voteview's own description of Senate roll calls 2 and 3 of the 104th Congress begins with a stray row of its source table ("2 5 JANUARY 1995 2 52 39 3 37 49 2 S.2 BY GRASSLEY …", "3 6 JANUARY 1995 3 74 17 23 17 51 0 (SENATE TABLED WELLSTONE …"). Left as Voteview has them; hand-fix claims `cmq5l0vyt5iaasal8p8xumtjl` and `cmq5l0vyt5iabsal8bxzanrm2` by dropping the prefix (record it in `metadata.corrections`). |
| stale embeddings | re-embed 86,063 stale claims, ~$0.18, needs OPENAI_API_KEY; verify scripts/backfill-embeddings.ts runs against the new DB first. (85,987 from the full-text restore + 76 batch-1 cloture corrections outside it; exact count 8,957,636 tokens with tiktoken. The nightly `/api/cron/embed-incremental` will not do it: it answers 503 while `ALLOW_EDITS` is off and looks back only 25 hours.) |

### Member votes (Phase 7 Q13, 2026-10-13)

| item | the one missing piece |
|---|---|
| 6,185 Voteview member votes with no member id | `voteview_v1` member votes whose `memberId` is null (e.g. "ABBITT, Watkins Moorman"): they count on vote pages but reach no `/members` profile. Match on Voteview's ICPSR id from `HSall_members.csv` → bioguide via unitedstates/congress-legislators (`id.icpsr`), its own dry run and yes. Left alone by owner decision. |
| 24 roll calls recorded twice | 24 votes have member votes on both the `voteview_v1` LegislativeVote and its `congress_votes_v1` twin (9 House, 3,885 rows; 15 Senate, 1,500 rows — identical since the LIS merge). Member pages skip the `congress_votes_v1` copy at read time; deleting the 5,385 duplicate rows is a separate decision. |

### Deferred by the owner (2026-10-12)

- `congress_v1` laws get introduced/passed transitions (~10k Congress.gov calls, needs `CONGRESS_API_KEY`) — Q4, not now.
- **After 2027-01-03:** mark the 119th Congress's unpassed tracker bills ABANDONED ("died with the 119th Congress") — Q11. The tracker refresh stays off.

## 2. Front-door pages that are one step from finished

| page | the one missing piece |
|---|---|
| `/opinions` | ~~hide the Circuit filter until `courtlistener_circuits_v1` has rows~~ — outdated: it has 1,232 live rows (2026-10-01). The registry still marks the tag retired with "0 records" (owner: registry text) |
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
