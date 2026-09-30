# AUDIT.md — front door vs. Lab (2026-09-29)

Code-only audit: no `.env.local` exists, so no dev server was started and no database was touched. All 143 page routes and 151 API routes were read; each page row was independently verified, then calibrated across batches. Standard: README's promise — every claim traceable to a primary source, tagged SETTLED/CONTESTED/RECORDED/OPEN, cross-referenced.

## A. What the site is today

Two products in one Next.js **16.2.6** codebase (README says 14). The working core is the settling-curve stack — `/settling-curve` with permalinks and embeds, `/claims/[id]` receipts, `/search`, eight stories, and a Discover ring (opinions, retraction explorer, split ledger, reversals, open questions, canon, patterns) that render DB-backed claims with sources and an axis. Around it: 33 static, LLM-written domain taxonomies (~94k lines, zero source URLs) reachable from Explore and homepage tiles; Congress/vote analytics that never link to a claim; four pages shadowed by permanent redirects; an unfinished org/litigation/billing product; two unrelated login systems; three disagreeing pipeline registries; four definitions of "total claims". A public/lab edition switch (`lib/publicEdition.ts`) already exists but is undeployed, so today every route is served, crawlable and linked from the front door.

## B. Route table

Nav: dropdown name, `top`, `footer`, `deep` (only from page links), `orphan`, `redirect` (shadowed by `next.config.ts`). `404p` = absent from `PUBLIC_ROUTES`. P/C = purpose/completeness. CSH = ClaimStatusHistory. Siblings sharing template, data and scores are grouped; every route is listed.

| route | nav | renders | data | P/C | bucket | note |
|---|---|---|---|---|---|---|
| `/` | top | hero curve, ticker, counts | Claim, CSH, Source, static slides | 4/4 | FRONT DOOR | Hero implies whole corpus; Fig. 1 is the dated cohort. Links `/docs/api` (404p). |
| `/settling-curve` | Explore | curated grid + explorer | Claim, CSH, Source, `/api/trajectories` | 5/4 | FRONT DOOR | Flagship. "N CURATED" counts auto rows after hydration; never links its permalink. |
| `/settling-curve/[id]` | deep | SSR transition log, sources | Claim, CSH, Source | 5/4 | FRONT DOOR | Best per-claim receipt; no curve graphic; explorer link uses CUID not slug. |
| `/settling-curve/coverage`, `/settling-curve/overview` | deep (tabs) | transition stats / retraction survival | CSH via `/api/epistemic-coverage`, `/api/curve-stats` | 3/3 | LAB | Counts transitions, says claims; overview's lag links 404 (double prefix). |
| `/trajectories` | Explore | trajectories by era + machine lens | Claim, CSH via `/api/history` | 4/4 | FRONT DOOR | Near-duplicate of `/settling-curve` grid; fold in, drop slot. |
| `/embed/trajectory/[slug]` | iframe | 200px curve widget | Claim, CSH, static allowlist | 4/4 | FRONT DOOR | Works. Never move (third-party iframes). |
| `/start-here` | Discover | static onboarding index | static | 2/3 | LAB | Duplicates home/trajectories/stories; counts drift; links `/docs/api`. |
| `/search` | Explore + button | search tabs, curve hits | Claim tsvector, Source, Edge | 5/4 | FRONT DOOR | Core entry. "1.76M" literal; "semantic" copy false; DEPRECATED rows unmarked. |
| `/claims` | Lab | raw newest-claims list | Claim via `/api/claims` | 4/3 | LAB | 336k-row dump, no source/filters; ignores `/feed` params. Superseded by `/search`. |
| `/claims/[id]` | deep (51 inbound) | receipt: axis, evidence, timeline | Claim, Edge, Source, ThresholdEvent, Topic, CSH | 5/4 | FRONT DOOR | Delivers the promise. Collect → `/auth/signin` (404p); metaEdges fetched, unrendered. |
| `/claims/[id]/edit`, `/review` | admin, 404p | edit form / review queue | Claim, Topic, Source, Edge | 2/3, 1/3 | LAB | Client `isReadOnly()` can't see `ALLOW_EDITS` → always disabled in prod. |
| `/receipts/[id]` | orphan, 404p | one-transition permalink | CSH, Claim, Source | 4/4 | LAB | Works; nothing links to it. Wire or delete. |
| `/edges` | orphan, 404p | latest edges + add form | Edge, EdgeRevision | 2/2 | DELETE | Form crashes (`claims.map` on object); read path lives on `/claims/[id]`. |
| `/meta-edges` | Discover | meta-edge list | MetaEdge, Source, Claim | 3/3 | LAB | Shows insert time as event date; no doc URLs; no claim links. |
| `/prereq-graph` | Explore | claims with relations | ClaimRelation, Claim | 4/3 | LAB | The "165k above 0 claims found" page (C1). API drops SUPERSEDED_BY/OUTCOME rows. |
| `/feed` | Research | new events, pipelines, follows | ThresholdEvent, Claim, CSH, Follow | 3/4 | LAB | Empty when pipelines idle 7 days; "N new claims" lands on unfiltered `/claims`. |
| `/labs/claim-diff` | orphan, admin | AI per-transition diffs | TransitionClaimsSnapshot, CSH | 3/2 | LAB | Self-labelled experimental; empty unless enrichment ran. |
| `/fields` | Explore | static grid of 34 guides | static | 2/4 | LAB | Hub for the static guides; moves with them. |
| `/fields/[slug]` | orphan | AcademicField detail | AcademicField, Topic, Claim | 4/3 | LAB | `/fields` never links here; header count is a raw join. |
| `/topics` | Lab | topic tree with counts | Topic, ClaimTopic | 3/4 | LAB | Works; counts include deleted/DEPRECATED, disagree with detail. |
| `/topics/[slug]` | deep (claim chips) | topic claims, timeline, votes | Topic, ClaimTopic, Claim, CSH, Edge | 4/3 | FRONT DOOR | Keep reachable; silent text-search fallback when 0 tagged. |
| `/domains/[domain]` | deep | root topics per domain | Topic | 3/3 | LAB | Duplicates `/topics`; most domains titled by raw slug. |
| `/glossary` | Research | static definitions | static | 2/4 | FRONT DOOR | Keep. Says "four-point" axis vs 5-value enum. |
| `/communities` | deep | 5 community cards, live counts | CSH raw SQL | 3/4 | FRONT DOOR | Methodology companion; "~1.1M" literal beside live counts. |
| `/case-studies` | deep (home) | ≤60 curated trajectories | Claim, CSH | 4/4 | FRONT DOOR | Same set as `/settling-curve` — share one slot. |
| `/astronomy /chemistry /earth-sciences /environmental-science /geology /history /law /medicine /pharmacology /physics /public-health` | deep (`/fields`, tiles) | trajectory rail + static taxonomy | Claim, CSH (rail); static `data*.ts` | 3/3 | LAB | Rail capped by stale `lib/domain-trajectories.ts`; "entries link to verified claims" banner false; zero URLs. |
| `/anthropology /biology /communication /computer-science /economics /education /engineering /finance /governance /ideologies /ip-law /linguistics /logic /mathematics /neuroscience /philosophy /physiology /psychology /security-studies /sociology /sports /tax-law` | deep (`/fields`) | static LLM-written taxonomies with status badges | static `data*.ts` | 2/3 (C4: anthropology, engineering, linguistics, neuroscience, psychology, sociology, tax-law) | LAB | 0 source URLs; badges mimic the axis; economics/finance/governance promise claim links, deliver text search. Five page-less `data.ts` dirs (arts, criminology, materials-science, political-economy, religious-studies) are dead code. |
| `/statistics`, `/statistics/methods` | deep | 257-method taxonomy / 10 methods + claims | static; `/api/statistics/related-claims` | 2/3, 3/4 | LAB | No DB ties; nav collision (Lab "Statistics" is `/stats`); fetch failure loads forever. |
| `/statistics/explorer`, `/statistics/explorer/[slug]` | deep | live OpenAlex method counts / tagged claims | Claim.metadata, `lib/statMethods.ts` | 3/3, 4/3 | LAB | Tags 5k of ~212k claims; operator CLI text shown to visitors. |
| `/stats` | Lab | corpus, axis, vote dashboards | Claim, CSH, LegislativeVote, MemberVote | 3/3 | LAB | `COUNT(*)` over `LEFT JOIN Edge` inflates total; no claim links. |
| `/stats/media-coverage` | Lab | NYT coverage, dark-matter bills | BillCoverage, Claim | 3/4 | LAB | Works; tile/list totals differ by design. |
| `/analysis/corpus` | orphan | five CSH charts | CSH, Claim | 3/4 | DELETE | Only the transition matrix is unique; port it first. |
| `/congress-trades` | Analyze | STOCK Act trades, members | Claim (congress_stock_act_v1), MemberVote | 4/3 | LAB | Real receipts; self-declared in-development, "small initial set". |
| `/stock-act`, `/foreign-legislation` | redirect | never render (308) | — | 3/1, 4/1 | DELETE | Dead behind permanent redirects; delete pages, APIs, `PUBLIC_ROUTES` entries. |
| `/votes`, `/votes/[id]` | Analyze | roll-call browser / detail | LegislativeVote, Source, MemberVote | 3/4, 3/3 | LAB | Works with source links; no claim links. |
| `/members`, `/members/[memberId]` | Analyze | member search / profile | MemberVote, MemberIdeology, static landmark JSON | 3/3, 3/4 | LAB | Blank until query; coverage ~2k enriched votes; profile honest. |
| `/legislation` | Lab | country grid, trackers | Claim (52 tags), ClaimRelation | 3/3 | LAB | Omits five Nordic/EU pipelines (~25.8k claims); "12-hour refresh" false. |
| `/analysis/votes`, `/analysis/ideology`, `/analysis/representation` | Lab | vote analytics / DW-NOMINATE / opinion gap | LegislativeVote, MemberVote, MemberIdeology, ConstituentOpinion, `scripts/output/*.json` | 3/3, 3/4, 3/3 | LAB | Careful analytics, no claim links; votes truncated at 50k. |
| `/financial` | Analyze | four-tab disclosures | Claim by ingestedBy | 3/3 | LAB | Two tabs back onto 0-record pipelines; congress tab duplicates `/congress-trades`. |
| `/analysis/settling-rate` | Analyze | macro settling stats | Claim `trajectory:*`, CSH | 3/4 | LAB | No drill-down; promote once bars link into curve lists. |
| `/analysis/topics` | Lab | roll-call topic trends | LegislativeVote, Source | 3/4 | LAB | Vote analytics, not claims; never links `/votes/[id]`. |
| `/analysis/retraction-lag` | Lab | lag stats | ClaimRelation REVERSED, Claim | 3/3 | LAB | Uses REVERSED where wall uses CONTRADICTS; counts can't reconcile. |
| `/retraction-explorer` | Discover | retracted-paper index | Claim (crossref_retractions_v1) | 4/4 | FRONT DOOR | Canonical; field filter is a keyword heuristic; shows updateType not axis. |
| `/retraction-wall` | Lab | counts, ripple, recent | Claim, ClaimRelation | 3/3 | LAB | Re-views explorer data; script name leaks into UI. Fold in. |
| `/retractions` | deep, sitemap | static feed docs | static | 2/4 | LAB | Only docs for public feeds; fold into explorer footer. |
| `/corrections` | Discover, footer | audit log + flag form | static, Feedback | 2/4 | FRONT DOOR | Accountability page; keep. "/" placeholder link. |
| `/patterns` | deep (`/canon`) | six settling shapes | CSH, Claim | 4/4 | FRONT DOOR | Solid, near-orphan; counts skip deleted filter. |
| `/canon` | deep | ≥5,000-citation papers | Claim (openalex_v1), CSH | 4/4 | FRONT DOOR | Good receipt surface, not in nav; DOI is plain text. |
| `/opinions` | Discover | CourtListener opinion cards | Claim (courtlistener_*), Source, ClaimRelation | 5/4 | FRONT DOOR | Solid. Drop "2,711" literal; hide Circuit filter (pipeline at 0). |
| `/reversals` | Discover | cross-community reversal hub | CSH, curve rail, static arcs | 4/4 | FRONT DOOR | Label "Court Reversals" undersells it; link params ignored downstream. |
| `/law-settler` | Discover, curve tab | legal-doctrine cards | Claim, CSH | 4/4 | FRONT DOOR | Finished; overlaps `/reversals`; already a curve tab. |
| `/open-questions` | Discover | top-50 dormant CONTESTED | Claim, CSH join | 4/4 | FRONT DOOR | Fine; headline counts claims the list can't show. |
| `/split-ledger` | Discover | cross-community disagreements | CSH, Claim raw SQL | 4/4 | FRONT DOOR | Unique thesis page; SQL keeps deleted/DEPRECATED; stale "386" literal. |
| `/timeline`, `/reader` | orphan | server redirects | — | 1/1 | DELETE | Leftover stubs; move to `next.config`. |
| `/drug-arc` | Lab | funnel stages, drug search | Claim (trials, FDA, FAERS), ClaimRelation | 3/3 | LAB | Live counts; heat-map is substring matching. |
| `/historical-events`, `/historical-events/[slug]` | Lab | event cards / detail with votes | HistoricalEvent, HistoricalEventVote, Polity, Claim | 3/4, 4/3 | LAB | Detail has real vote receipts but shows deprecated `currentStatus`. |
| `/stories` | Discover | static index of 8 stories | static | 2/4 | FRONT DOOR | Hub; story list duplicated in 4 files. |
| `/stories/{cfc-ozone-depletion, cold-fusion, continental-drift, dietary-fat-heart, h-pylori, semaglutide-glp1, smoking-lung-cancer, voting-rights-act-1965}` | deep | prose + DB trajectory panel | Claim (`trajectory:<slug>`), CSH, Source | 5/4 | FRONT DOOR | One template cloned 7×; prose has zero inline receipts. |
| `/sources` | Research | ingester-tag catalog | static registry + Claim counts | 3/3 | FRONT DOOR | Core provenance index; 88% of cards are stubs. |
| `/pipelines` | Research | registry with live counts | Claim/Source groupBy + static list | 3/3 | LAB | Third disagreeing registry; "Browse N claims" is a phrase search. |
| `/datasets`, `/datasets/[tag]` | deep | data cards / provenance card | `lib/pipelines/registry.ts`, Claim, PipelineRun | 3/2, 3/1 | LAB (FRONT DOOR after fix) | Every card 404s: `[tag]` reads `params` synchronously; one-line `await` fix. |
| `/datasets/snapshots` | orphan | empty snapshot list | static JSON | 2/1 | LAB | Empty; claims CC BY 4.0 vs `/license`. |
| `/methodology`, `/about` | footer / top | static reference / mission | static | 2/4 | FRONT DOOR | Keep; dated counts and read-through marker; about links no case study. |
| `/docs/api` | deep, sitemap, 404p | static API reference | — | 2/3 | LAB | Advertised everywhere yet not public; tiers contradict `/pricing`. |
| `/pricing` | deep, 404p | plan grid, Stripe | `/api/stripe/checkout` | 1/3 | LAB | Needs a session; public edition has no auth. |
| `/license`, `/privacy`, `/terms` | footer | legal | static | 2/3, 2/4, 2/3 | FRONT DOOR | Keep. Governing-law placeholder, counsel TODOs, personal email. |
| `/books` | Lab | book list, upload, match | Book, BookChunk, BookClaim | 3/3 | LAB | Public page with admin tooling that spawns `npx ts-node` — dead on Vercel. |
| `/reader/[bookId]` | deep | book text, arc, matched claims | Book, BookChunk, BookClaim, Claim | 4/4 | LAB | Best of batch; promote with a cleaned `/books`. |
| `/globe`, `/globe/connections` | Lab, home link | 3D density / arc globe | Claim, PoliticalContext, Polity, PolityClaim, ClaimLocation | 3/3 | LAB | Three disagreeing "claims" bases (C2); play mode trips rate limit. |
| `/globe/lab` | orphan, DENY_EXACT | deep-time globe | same | 3/3 | DELETE | Older fork; port the 4.5 Ga slider first. |
| `/account` | Stripe success URL, 404p | subscription, usage, keys | Org, ApiKey, ApiUsage | 1/1 | LAB | Always bounces to `/login` — post-purchase flow broken. |
| `/admin/feedback` | admin | feedback rows | Feedback | 1/4 | LAB | Works; unpaginated. |
| `/alerts`, `/bookmarks` | redirect | never render (308) | TopicSubscription / Bookmark | 2/1, 3/1 | DELETE | Dead; but `/following` never manages TopicSubscription, and alert emails still point here. |
| `/auth/signin`, `/auth/verify`, `/auth/error` | 404p | magic-link form / notices | User, VerificationToken, Session | 2/4, 2/5, 2/5 | LAB | Second identity system beside `/login`; signin ignores `callbackUrl`. |
| `/login` | admin, 404p | admin password form | env only | 1/5 | LAB | Owner gate; keep. |
| `/collections`, `/collections/[id]` | orphan, 404p | collections / claims with notes | Collection, CollectionItem, Membership | 2/4, 3/4 | LAB | Works signed-in; nothing links to the list. |
| `/following` | deep (`/feed`) | follows + bookmarks | Profile, Follow, Bookmark, Claim | 3/5 | FRONT DOOR | Only anonymous personal page; Follow buttons never navigate here. |
| `/feedback` | deep | feedback form | Feedback | 2/5 | FRONT DOOR | Works; duplicates global FeedbackButton. |
| `/org/[orgId]/{api-keys, ip-ranges, litigation, litigation/[matterId], litigation/[matterId]/new-claim, members, usage}` | orphan, 404p | org admin, litigation, exports | Org, Membership, ApiKey, OrgIpRange, OrgUsageDaily, LitigationMatter, MatterClaim | 1–2/1–3 | LAB | Not functional end-to-end: no first-owner Membership path; writes middleware-blocked; usage never written. |

### API routes (151)

`/api/v1/*` 11 (metered, key-gated) · `/api/mcp` 1 · cron 6 + ingest 2 (`report-stripe-usage` has no `vercel.json` schedule) · auth/login/unsubscribe 3 · admin 2 · org/litigation 8 · stripe 3 · claims 8 · topics/taxonomy/fields/domains 7 · trajectories/curve/coverage/history/labs 7 · analysis/statistics 9 · stats 8 · legislation/votes/members/opinions 6 · congress-trades/stock-act/financial 4 · globe 8 · drug-arc/events/timeline/threshold 7 · search/retractions/citations/oembed/badge/proxy 9 · bookmarks/follow/alerts/feed/subscribe/user 12 · collections 5 · books 9 · edges/meta-edges/sources/pipelines/datasets 6 · review/feedback/sentry 4. **~25 have no in-app caller** (`/api/claims/homepage`, `/api/datasets`, `/api/domains`, `/api/pipelines`, `/api/timeline`, `/api/threshold-events*`, `/api/trajectories/search`, `/api/historical-events*`, `/api/drug-arc/funnel`, five `/api/stats/*`, `/api/subscribe/*` though allowlisted, `/api/admin/api-keys`).

## C. Header/body mismatches (verified)

1. **`/prereq-graph` — the reported "165k / 0 claims found".** Header: ISR `COUNT(DISTINCT fromClaimId) FROM ClaimRelation`, no Claim join or deleted filter (`app/prereq-graph/page.tsx:17-24`). Body: per-request `Claim JOIN ClaimRelation … deleted=false` + domain chip + ILIKE, LIMIT 25 (`app/api/prereq-graph/route.ts:66-99`) → "No claims found for this filter." Zero when a chip's pipelines have no relations or the first fetch fails. The `165,250`/`165,233` grep hits elsewhere are `rgba()` colours, not counts.
2. **`/globe`.** Hover counts: pipeline→country map + PoliticalContext edges (`api/globe/density/route.ts:17-45`, `country/[code]/route.ts:31-60`). Sidebar: PolityClaim-linked only, `total 0` without a Polity row (`api/globe/country-claims/route.ts:41-79`).
3. **`/topics` → `/topics/[slug]`.** Raw `Topic._count.claims` (`api/topics/route.ts:7-25`) vs detail excluding deleted/DEPRECATED/NULL, then silent text fallback (`api/topics/[slug]/route.ts:70-168`).
4. **`/open-questions`.** `claim.count` CONTESTED (`page.tsx:25-31`) vs `INNER JOIN ClaimStatusHistory` list (`lib/dormancy.ts:35-97`).
5. **`/retraction-wall`.** `claimRelation.count(CONTRADICTS)` (`page.tsx:165`) vs second-hop citation CTE (`page.tsx:41-60,122-129`).
6. **`/legislation` US card.** `groupBy ingestedBy` (`api/legislation/route.ts:504-532`) vs body keyed on topic `congress-119` (`:700-724`).
7. **`/pipelines`.** "Browse N claims" from `groupBy` (`page.tsx:106-119`) links to `/search?q=<four words>` full-text (`api/search/route.ts:104-146`); static notes sit beside live "—".
8. **`/` corpus pills.** Per-pipeline COUNT (`page.tsx:54-61`) → destinations are text searches or static guides.
9. **`/patterns`.** CSH counts without Claim join (`page.tsx:47-54`) vs exemplars filtered deleted/DEPRECATED (`:59-71`).
10. **`/settling-curve`.** "N CURATED" from client `/api/trajectories` (curated + ≤5,000 auto, `route.ts:44-49`) vs SSR curated list (`page.tsx:54`).
11. **`/settling-curve/coverage`.** `claimStatusHistory.count()` labelled "claims" (`api/epistemic-coverage/route.ts:9`); homepage calls the same number "dated transitions".
12. **`/fields/[slug]`**, **`/reversals`→`/settling-curve`**: raw-join header vs filtered list (`api/fields/[slug]/route.ts:63-92`); transition counts linking with params the destination ignores (`reversals/page.tsx:258`, `settling-curve/page.tsx:10`).
13. **Corpus total, four definitions.** `/` (`status not DEPRECATED`, drops NULL), `/stats` (`deleted=false`; `/api/corpus-stats:18-25` also joins Edge), `/sources` (`IS DISTINCT FROM DEPRECATED`), `/pipelines` — plus "1.76M"/"1.7M+" literals (`Nav.tsx:14,263`, `SearchClient.tsx:370`, `start-here/page.tsx:215`, `layout.tsx:21`) vs AGENTS.md ~336.9k.

## D. Proposed top nav (≤6 flat links, all ≥4/4)

Settling Curve `/settling-curve` · Search `/search` · Opinions `/opinions` · Retractions `/retraction-explorer` · Split Ledger `/split-ledger` · Reversals `/reversals`.

Also ≥4/4 without a slot: `/open-questions`, `/canon`, `/patterns`, `/case-studies`, `/law-settler`, `/trajectories` (duplicate), `/stories/*` (hub is 2/4) — surface from the homepage and `/settling-curve`. About/Methodology/Corrections/legal stay in the footer. Every current Analyze item is LAB.

## E. Doc pile

*(Consolidated in front door phase 4, 2026-09-30: the paths below were rewritten to where each file went — referenced docs to `docs/`, the rest to `docs/archive/` with `docs/archive/README.md` as the index. `STATUS.md` § Docs is the current map.)*

None of `DESIGN-*`, `REVIEW-*`, `NEXT-SESSION`, `SHIP-BRIEF`, `STRANGER-TEST` ever existed in git history. Near-matches: `docs/SECURITY-REVIEW-2026-06-12.md`, `docs/archive/HOMEPAGE-REDESIGN-PLAN.md`, `docs/archive/HANDOFF-PRELAUNCH-FIXES.md`, `specs/HANDOFF-OPENCLAW.md`, `docs/review-2026-06-09.md`, `docs/CONSULTANT.md`. Root pile, first 20 lines only (★ = referenced by AGENTS/CLAUDE/README/specs/code):

- `docs/archive/ARCHIVES.md` — declassified-archive catalogue
- `docs/archive/AUDIT-2026-05-21.md`, `docs/archive/AUDIT-PRELAUNCH-2026-07-06.md`, `docs/archive/AUDIT-WHITEPAPER-GAP-2026-07-03.md` — past audits
- `docs/archive/B7-REPORT.md` — Build Brief 7 report
- `docs/archive/CHECKLIST-2026-07-08.md` — owner's what's-left list
- `docs/archive/chemistry-taxonomy-build-prompt.md`, `docs/archive/statistics-taxonomy-build-prompt-v2.md`, `docs/archive/TAXONOMY-META-PROMPT.md` — prompts that generated the taxonomy pages
- ★ `docs/CONSULTANT.md` (4,830 lines) — architectural memory; the de facto pile
- ★ `docs/CORPUS-PROMOTER-BULK-PLAN.md` — backfill plan
- `docs/archive/DUPLICATE-TRAJECTORIES-2026-07-06.md` — generated duplicate report
- ★ `docs/epistemic-receipts-marketing.md` — positioning draft
- `docs/archive/fable-cover-prompt.md` — AI prompt with pasted diagnostics
- `docs/archive/HANDOFF-PRELAUNCH-FIXES.md` — shipped 2026-07-10
- `docs/HARD_FACTS_DOMAINS.md` — domain list
- `docs/archive/HISTORY.md` — build decisions and dead ends
- `docs/archive/HOMEPAGE-REDESIGN-PLAN.md` — homepage plan
- `docs/archive/LAUNCH-PLAN-2026-07-24.md` — launch source of truth
- `docs/archive/MATERIAL-LOG.md`, `docs/archive/MATERIAL-QUEUE.md` — orchestrator log/queue
- `docs/archive/NARA-ROADMAP.md` — NARA roadmap; **plaintext API key at line 5**
- ★ `docs/ORDERING-SEMANTICS-2026-07-08.md` — claim-row ordering decision
- `docs/archive/PIPELINE_QUEUE.md`, `docs/TASK_QUEUE.md` — agent queues (May 2026)
- `docs/archive/PITCH-COGSCI-SETTLING-CURVES.md` — pitch
- `docs/archive/PREPUBLICATION-GAPS-2026-07-24.md`, `docs/archive/PUBLICATION-RUNBOOK-2026-07-22.md` — superseded by launch plan
- `docs/archive/problem-solve.md` — north-star thesis
- ★ `docs/PUBLISH-CHECKLIST.md` — edition-flag checklist
- `docs/ROADMAP.md` — pipelines + monetization
- `docs/archive/Robert Contofalsky - Epistemic Receipts (cleaned).md`, `docs/archive/WHITEPAPER.md` — whitepaper drafts
- ★ `docs/SCALING.md` — phased plan driving `specs/`
- `docs/archive/scientific.md` — corpus-construction notes
- `docs/archive/SECURITY-ASSESSMENT-2026-07-09.md`, ★ `docs/SECURITY-REVIEW-2026-06-12.md` — security reviews
- `docs/archive/substack-article-general.md`, `docs/archive/substack-article-technical.md` — article drafts
- `docs/review-2026-06-09.md`, ★ `specs/HANDOFF-OPENCLAW.md` — repo review / orchestrator boot doc

Other dirs (counts): docs 15, specs 31, briefs 37, briefings 21, marketing 3, memory 2, tracker 10, legal 6. Only 9 of 41 are referenced anywhere.

**Replacement — `STATUS.md` (headings only):** Purpose and north star · Current state (verified date, edition flags, live URL) · Architecture invariants (security, ordering, data doctrine) · Pipeline registry pointer (AGENTS.md canonical) · Open launch gates · Active queues · Decision log (dated, one line each) · Audit and review history · Superseded documents · Known risks and secrets exposure · Content and marketing drafts index · Build prompts and handoffs index · How to update this file.

## F. Three biggest risks

1. **A Lab split already exists — four times, undeployed, prefix-matched.** Nav `lab:true` only hides a dropdown on the public edition (all 15 items stay in `PUBLIC_ROUTES`, sitemapped, crawlable, home-linked); `ADMIN_PATHS` gates `/labs/*`; `DENY_EXACT` gates `/globe/lab`; `tests/unit/public-edition-routes.test.ts` keeps its own `LAB_ONLY` list. `isPublicRoute` matches by prefix (`lib/publicEdition.ts:116-118`), so dropping `/claims` or `/topics` 404s every canonical URL emitted by `/api/v1/verify`, `/api/mcp`, `EmbedButton` and the sitemap. Don't add a fifth mechanism or a `/lab/` prefix; move listing pages, not prefixes; verify with a production build under `NEXT_PUBLIC_EDITION=public` (every gate is bypassed in `next dev`).
2. **The gate lives in a deprecated file and CI protects no links.** `middleware.ts` carries the security model and edition gate; Next 16 renames it `proxy.ts` (Node runtime), both files together fail the build, and `tests/integration.test.ts:26` imports `{ middleware }` — don't rename it in the restructure PR. The link-integrity test never runs in CI, skips `components/`, `lib/` and template hrefs, and treats `LAB_ONLY` hits as passes (`/docs/api` is already a public 404 while it's green). Path-bound config (`/embed` CSP override, oEmbed matchers, six cron paths, four permanent 308 redirects) breaks silently on directory moves; never move `/embed`, `/settling-curve/[id]`, `/claims/[id]`.
3. **Content integrity is the real front-door problem.** The 33 taxonomies (~94k lines, ~4.2k "key facts", ~1.4k status stamps, 0 URLs) breach the sourcing rule by analogy and squat root slugs (`/history`, `/law`, `/physics`) — bucket them as one unit. Corpus counts have four query definitions plus hand-bumped "1.76M" literals; the "165k vs 0" is a query divergence, not a string. Freeze number edits during the restructure, then route every total through one helper. Also: a plaintext NARA API key is committed at `docs/archive/NARA-ROADMAP.md:5` (rotate, purge); `/datasets/[tag]` is dead on Next 16; `/account`, Stripe's success URL, always bounces to `/login`.
