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
| `/opinions` | hide the Circuit filter until `courtlistener_circuits_v1` has rows; drop the typed "2,711" |
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
| Prisma schema | `prisma/migrations/20260930120000_phase3_drop_saas_social_auth` is written, not applied — owner runs `prisma migrate deploy` |
| `metadata` on Source/Edge/MetaEdge | queued migration (AGENTS.md) |
| six claims written after the restore | find the writer (a cron or ingest route) |
| `use cache` | `unstable_cache` is "replaced by `use cache`" in Next 16; migrating needs `cacheComponents: true` (whole-app rendering change) — its own PR, after the front door settles |
| auto-generated trajectory list | `/api/trajectories` and the explorer label "5,000 most recent auto-generated" but the list is **empty**: the newest 5,000 claims with history each have one transition and the ≥2 filter runs after the `take` — filter in SQL (`statusHistory` count ≥ 2) or drop the label |
| optional claim-page panels | `WhatHappenedNextPanel`, `ClaimRelationsPanel`, `TopicTimeline` hide on a failed fetch (they never claim zero) — a one-line error would be more honest than silence |
| `/settling-curve` payload | the SSR grid ships all 5,698 curated cards (~3 MB of RSC props) on every visit; paginate or stream the grid |
| MCP endpoint | unauthenticated read-only, over the public claim graph (`isPublicRoute` / `LIVE_CLAIM_WHERE`); phase 3 deleted the key-gated `/api/mcp` + `lib/v1` — recover the tool surface from `archive/full-site`, drop the key |
