# STATUS.md — live tracker (read this first)

One file, kept short, updated at every phase boundary. Agents: read this and `AUDIT.md`, not the doc pile.
Owner: to resume in a fresh session, say "read STATUS.md, continue Phase N".

## Current state (2026-10-01)

- DB: self-hosted PostgreSQL 17 + pgvector on OCI (83 GB volume, ~30 GB free). Restored from
  `epistemic_receipts_backup.dump`; all large tables verified present (Claim 1,758,105 / deleted=false 1,758,084;
  ClaimStatusHistory 1,822,644; Edge 1,718,766; ClaimRelation 4,820,213; MemberVote 1,798,569;
  ClaimEmbedding 1,757,943; EdgeRevision 1,557,521). Still 0 rows (2026-10-01): PipelineRun, AlertSent, SavedQuery,
  AiJob, TransitionClaimsSnapshot, SourceCredibilityEvent, SuggestedThresholdEvent — believed empty on Neon too. User,
  ApiKey, ApiUsage, Session, Account, VerificationToken, Follow, Collection*, *Subscription, Org*, Litigation* were
  dropped with the rest of the 20 Phase 3 tables (migration applied 2026-09-30; list under Phase 3).
- App: `main` builds and deploys on Vercel with `@prisma/adapter-pg` (PR #22). Homepage curve, settling curves,
  law-settler confirmed live after redeploy.
- Audit: `AUDIT.md` (route table, mismatches, nav proposal, risks) is the input for the restructure.

## Decisions (locked)

- Corpus count = `deleted = false` (1,758,084 at restore; 1,758,090 on 2026-09-30 — six rows were written after
  the restore, source unknown, worth a look). Public figure stays "1.76M". One helper (`lib/corpus.ts`), one
  query, no literals. The 182 DEPRECATED uspto rows count (they are `deleted = false`); `/stats` and `/sources`
  say so. Default views hide them via `LIVE_CLAIM_WHERE`.
- Lab serving = one deployment; non-public routes require the admin cookie; Lab dropdown only when logged in.
  Two-project `NEXT_PUBLIC_EDITION` scaffolding retired 2026-09-30 (Phase 2); the env var is inert.
- Top nav = Settling Curve · Search · Opinions · Retractions · Split Ledger · Reversals (+ About).
  Methodology / Corrections / legal in the footer.
- The 33 taxonomies + `/fields` + `/statistics` move to Lab as one block.
- Hard constraints: don't rename `middleware.ts`; don't move `/embed`, `/claims/[id]`, `/settling-curve/[id]`;
  no `/lab/` prefix; exact-match the public route list; move listing pages, not prefixes.

## Working rules

One phase at a time, one branch + one PR per phase, stop for go-ahead between phases. Single agent, no subagents.
`npm run build` before every push; data-facing counts verified with a read-only query. Nothing writes to the DB
(one owner-approved exception: `TransitionSourceCandidate`, see Transition sourcing below).

## Docs (where things are, since Phase 4)

- Root: `README.md`, `CLAUDE.md` → `AGENTS.md` (agent rules), `STATUS.md` (this tracker), `AUDIT.md` (route audit,
  2026-09-29), `LATER.md` (backlog). Nothing else lives at the root.
- `docs/`: the ten docs that code, specs, AGENTS.md or runbooks still cite — `CONSULTANT.md` (architectural memory),
  `SCALING.md` (+ `specs/`), `SECURITY-REVIEW-2026-06-12.md`, `ORDERING-SEMANTICS-2026-07-08.md`,
  `CORPUS-PROMOTER-BULK-PLAN.md`, `PUBLISH-CHECKLIST.md`, `ROADMAP.md`, `TASK_QUEUE.md` (read by
  `scripts/er-worker.sh`), `HARD_FACTS_DOMAINS.md`, `epistemic-receipts-marketing.md` (house rule cited by
  `lib/format.ts`) — beside the pre-existing dated handoffs and `docs/runbooks/`. Dated findings:
  `TRANSITION-SOURCING-2026-10-09.md`.
- `docs/archive/`: 29 superseded root docs, one line each in `docs/archive/README.md`. Files unchanged (they still
  name each other by old root paths). `briefs/` and `briefings/` untouched — historical.

## Environment facts (so a fresh agent needn't rediscover them)

- `.env.local` has `DATABASE_URL` → the OCI Postgres (self-signed cert, URL ends in `?sslmode=require`).
  `lib/prisma.ts` strips that param and passes `ssl: { rejectUnauthorized: false }`; do the same in ad-hoc
  scripts (see `scripts/ingest-cces.ts`). `DATABASE_URL_READ` is no longer read by anything (the v1 read client
  went in Phase 3).
- Read-only verification pattern (no writes, ever):
  `node -e 'require("dotenv").config({path:".env.local"}); const {Pool}=require("pg"); …pool.query("select …")'`.
- `npm run build` = `prisma generate && node scripts/gen-route-manifest.mjs && next build`; it prerenders ~275 pages against the live DB (reads only; 275 at Phase 6).
  **Locally, run it as `CIRCLE_NODE_TOTAL=2 npm run build`** (1 prerender worker, ~4 min, 0 timeouts — verified
  2026-09-30). The default 9 workers saturate the OCI Postgres and the sitemap's deep-OFFSET claim chunks
  (`app/sitemap.ts`, `claims-25..28`, ~37 s each in isolation) exceed Next's 60 s static-generation timeout →
  "Failed to build /sitemap/[__metadata_id__]/route … after 3 attempts", exit 1. Two default-config runs failed
  that way on 2026-09-30 with an unrelated diff; not a code problem. (`CIRCLE_NODE_TOTAL` is what Next's default
  `experimental.cpus` reads — no config change needed.) Vercel builds fine as-is.
  `scripts/` is excluded from `tsconfig.json`, so build/`tsc` never type-check it. After deleting routes, run the
  build before `tsc --noEmit`: the stale generated `.next/types/validator.ts` otherwise reports phantom errors.
- `gh` is installed and logged in, and git pushes through the macOS keychain (checked 2026-10-01), so a push from this
  shell would succeed — agents still never push or open PRs: agents commit locally, the owner pushes with
  `! git push -u origin <branch>` and opens the PR at
  `https://github.com/contofalskyR/epistemic-receipts/compare/main...<branch>?expand=1`. gitleaks 8.30.1 is installed
  and `core.hooksPath=.githooks` is set (2026-10-01), so the pre-push secret scan runs on the owner's push.
- Vercel production = `main`. Homepage is ISR (`revalidate = 3600`); after data changes, Redeploy without build cache.
- Server: `ssh opc@…`, tmux session `restore`, PGDATA `/var/lib/pgsql/17/data`, dump at `/var/lib/pgsql/dump/`.
- Known false positive: `165,250` / `165,233` in the code are `rgba()` colour literals, not counts.

## Phases

- [x] **Phase -1 — pg driver** · branch `phase-minus-1/pg-driver` · PR #22 merged · build green · counts verified.
- [x] **Phase 0 — stop the bleeding** · branch `fix/front-door-phase-0` · done 2026-09-30 · build green · tsc clean ·
      310 tests pass · PR: owner pushes the branch and opens it (see Environment facts)
  - [x] strip NARA key from `docs/archive/NARA-ROADMAP.md` — it was also in `docs/archive/HISTORY.md`, `docs/ROADMAP.md`, `docs/TASK_QUEUE.md`; all four
        now read `<redacted — set NARA_API_KEY in .env.local>`. Purge command was handed over in the Phase 0 chat
        report, deliberately NOT in the PR (public repo). Owner runs it after rotating.
  - [x] `/datasets/[tag]`: `await params` (un-404s every card linked from /about, /methodology)
  - [x] delete redirect-shadowed pages + their API routes: `/stock-act`, `/foreign-legislation`, `/alerts`, `/bookmarks`
        (`/api/bookmarks` kept — `hooks/useBookmarks` + `/following` use it); `/timeline` and `/reader` redirect stubs
        moved into `next.config.ts` (exact sources; `/reader/[bookId]` untouched); alert emails → `/following`
  - [x] add `/docs/api` to `PUBLIC_ROUTES`; "Collect" renders only once a session is confirmed (mount probe, fail closed)
  - [x] commit `AUDIT.md` + `STATUS.md`
  - Found on the way, left for Phase 3: `components/destinations/DestinationNav.tsx` is unmounted dead code (its
    `/foreign-legislation` link was retargeted to `/legislation`); `/following` still has no TopicSubscription UI now
    that `/api/alerts` is gone (the cron keeps sending; only the manage surface is missing).
- [x] **Phase 1 — honest numbers** · branch `fix/front-door-phase-1` · done 2026-09-30 · build green · tsc clean ·
      314 tests pass · PR: owner pushes the branch and opens it
  - [x] `lib/corpus.ts`: `corpusCount()` (deleted = false, `unstable_cache` 1 h), `corpusCountCompact()` ("1.76M"),
        `corpusCountByPipeline()` (same definition, so tiles sum to the headline), `LIVE_CLAIM_WHERE` /
        `liveClaimSql()` (default-view filter: not deleted, not DEPRECATED, NULL status IN). Used by `/`, layout
        metadata + Nav, `/search`, `/start-here`, `/stats`, `/sources`, `/pipelines`, `/api/claims`, `/api/corpus-stats`.
  - [x] literals gone: `Nav.tsx` ×2, `SearchClient.tsx`, `start-here` ×2, `layout.tsx` ("1.7M+"), `prereq-graph`
        metadata ("4.8M+"), `settling-curve/coverage` metadata ("1M+"), corpus-stats note ("1.25M rows").
        Guard: `tests/unit/corpus-literals.test.ts` (figure within two words of "claims"; dated records + `/corrections` exempt).
  - [x] `/prereq-graph`: `lib/prereq-graph.ts` is the one population query for header and body; client shows
        "Couldn't load claims — Retry" on a failed fetch instead of "No claims found".
  - [x] `/api/corpus-stats`: `total_claims` was COUNT(*) over `Claim LEFT JOIN Edge` (claim–edge pairs: 1,765,275
        vs 1,758,090) → `corpusCount()` + EXISTS; `pct_sourced` 96.9 → 97.3.
  - [x] "N CURATED": `isCurated` flag + label "5,698 CURATED TRAJECTORIES · 5,000 MOST RECENT AUTO-GENERATED"
        (it read "10,698 CURATED" after the background fetch).
  - [x] filter alignment: topics list `_count` now uses the default-view filter (was raw ClaimTopic rows) and the
        detail discloses its text-search fallback; patterns shape counts join live claims (241,501 → 241,480);
        open-questions header = ranked population (CONTESTED with a dated transition); retraction-wall tile counts
        the CTE's population (pipeline-restricted CONTRADICTS); `/api/trajectories` auto list no longer drops
        NULL-status claims.
  - Found, left for later: `/communities` types "(~1.1M)" for the largest community (Phase 5 content);
        `app/api/pipelines/route.ts` (no in-app caller) still runs its own GROUP BY — Phase 3 deletion; ~11 inline
        copies of the correct not-DEPRECATED filter could be swept to `LIVE_CLAIM_WHERE` in Phase 3/4.
- [x] **Phase 2 — the Lab line** · branch `fix/front-door-phase-2` · done 2026-09-30 · build green under
      `NEXT_PUBLIC_EDITION=public` · tsc clean · 441 tests pass · PR: owner pushes the branch and opens it
  - [x] `lib/publicEdition.ts`: EXACT `PUBLIC_ROUTES` (no prefix matching) + `PUBLIC_PATTERNS` for the five
        dynamic pages (`/claims/[id]`, `/settling-curve/[id]`, `/topics/[slug]`, `/datasets/[tag]`,
        `/embed/trajectory/[slug]`) + `DENY_EXACT` (/claims, /topics, /settling-curve/coverage|overview,
        /datasets/snapshots) + `/claims/[id]/edit` pattern. Buckets from AUDIT.md §B.
  - [x] `middleware.ts` (not renamed): every non-public page route → admin gate (redirect `/login?from=…`),
        same response as /admin; `/login` stays open; APIs and file-extension paths untouched. Unknown paths get
        the gate too (deny-by-default). `NEXT_PUBLIC_EDITION` scaffolding retired everywhere (middleware, robots,
        sitemap, Nav, subscribe routes) — email subscribe is live again on the one deployment.
  - [x] Nav = Settling Curve · Search · Opinions · Retractions · Split Ledger · Reversals · About; ⚗ Lab dropdown
        (four sections) renders only after `GET /api/login` → `{ admin: true }` (new one-bit probe, timing-safe,
        open in dev). Lab items self-filter through `isPublicRoute`.
  - [x] homepage retargets: domain links → `/topics/<root-slug>` (academic-literature, nara-catalog, medicine,
        chemistry, astronomy, vdem, us-enacted-legislation, world-bank-indicators) and `/opinions`; "Full feed" →
        `/settling-curve`; "Globe" pill → `/sources`; start card → `/stories/continental-drift`; the
        "Senate votes vs public opinion" card (→ /congress-trades, Lab) became a Split Ledger card.
  - [x] public→Lab links removed: Fig. 1 "Full analysis" (→ /analysis/settling-rate) now → `/settling-curve`;
        settling-curve tab bar lost the Overview/Coverage tabs; topic breadcrumbs to /topics and
        /domains/economics are plain text; /search, /case-studies, /open-questions, /following, /start-here
        links to /fields, /topics, /feed retargeted.
  - [x] tests: `public-edition-routes.test.ts` rewritten (full route paths, comment-stripped hrefs, every
        PUBLIC_ROUTES/DENY_EXACT entry must have a page, matcher rows); new `lab-gate.test.ts` runs the
        middleware as production (40 cases). Sitemap: every list through `onlyPublic()`; Lab URLs removed.
  - Deviations from AUDIT.md §B, owner to confirm: `/start-here` KEPT PUBLIC (audit: LAB) — /, /patterns,
        /open-questions and the 404 page use it as the onboarding entry; `/docs/api` and `/datasets*` public
        (Phase 0). Moved to Lab beyond the STATUS list, per the audit buckets:
        /prereq-graph, /retraction-wall, /retractions, /congress-trades, /votes, /members, /financial,
        /domains/[domain], /reader/[bookId], /fields, /statistics*.
  - Known behaviour: anonymous requests for unknown paths redirect to /login rather than 404 (deny-by-default).
  - Found, pre-existing, NOT touched: **`/sitemap.xml` is a 404 on production** (verified 2026-09-30) and has been
        since commit 89a72f9 (2026-07-07) removed `app/sitemap.xml/route.ts` believing Next 16 emits an index for
        `generateSitemaps()` — it does not; only `/sitemap/{static,topics,claims-N}.xml` exist, while robots.txt
        advertises `/sitemap.xml`. Fix in Phase 3/4: an index route under a non-conflicting path (e.g.
        `/sitemap-index.xml`) + robots pointer, or list the chunk URLs in robots.
- [x] **Phase 3 — delete & consolidate** · branch `fix/front-door-phase-3` · done 2026-09-30 · build green ·
      tsc clean · tests green · PR: owner pushes the branch and opens it (merge Phase 2's PR first — this branch
      sits on top of `e3f031e`)
  - **Recovery:** the pre-deletion state is tag `v0-full-site` = branch `archive/full-site` (= `e3f031e`, the
    Phase 2 tip). Anything below comes back with `git checkout archive/full-site -- <path>`.
  - [x] SaaS layer deleted: `/org/*`, `/pricing`, `/account`, `/docs/api`; `/api/org/*`, `/api/stripe/*`,
        `/api/litigation/*`, `/api/admin/api-keys*`, crons `report-stripe-usage` + `flush-api-usage`;
        `lib/billing`, `lib/litigation`, `lib/orgAuth`, `lib/orgUsage`, `lib/entitlements`, `lib/cidr`;
        `scripts/stripe-setup.ts`. **Judgment call:** `/api/v1/*`, `/api/mcp` and `lib/v1` went too — with key
        minting gone (0 keys ever) nothing could authenticate to them. Packages `stripe`, `next-auth`,
        `@auth/prisma-adapter` removed.
  - [x] second auth system deleted: `/auth/*`, `/api/auth/[...nextauth]`, `lib/auth.ts`, `/api/user/*`. `/login`
        (admin cookie) is the only gate.
  - [x] social features deleted: collections (+`AddToCollection`), follows (+`FollowButton`), `/following`,
        bookmarks (+`BookmarkToggle`, `hooks/useBookmarks`), `/api/feed/following*|bookmarked-activity`,
        subscriptions (`/api/subscribe/*`, `/api/unsubscribe`, cron `claim-alerts`, the email branch of
        `topic-alerts` — the owner's Telegram digest and `WatchedTopic` (10 rows) stay). Rows lost: 1 Bookmark,
        2 Profile. Privacy page rewritten to match.
  - [x] audit deletes: `/edges` (+`/api/edges`); `/globe/lab` after porting the deep-time slider into `/globe`
        (log-scale 4.5 Ga→present, era labels, geography-only below 3000 BCE; the lab's mapping was mirrored);
        `/analysis/corpus` (+API, `lib/corpusAnalysis`) after porting the transition matrix to `/stats`
        (`TransitionMatrixSection`, live-claim join); five page-less taxonomy `data.ts` dirs (arts, criminology,
        materials-science, political-economy, religious-studies); `components/destinations` (dead); 17 uncalled
        API routes (`claims/[id]/topics*`, `books/*/matches/reasons`, `drug-arc/funnel|therapeutic-areas`,
        `historical-events*`, `threshold-events*`, `trajectories/search`, `timeline`, `datasets`, `domains`,
        `pipelines`, `claims/homepage`, five `stats/*`).
  - [x] one pipeline registry: `lib/pipelines/registry.ts` now 194 entries with `category` + `status`; `/sources`
        and `/pipelines` derive from it (their own 185- and 78-row lists deleted). 9 tags defaulted to
        category "Other" (`cces_v1`, `eu_parliament_votes_v2`, `ipn_v1`, `uspto_v1`, `costarica_legislation_v1`,
        `ncbi_gene_v1`, `nih_clinical_trials_v1`, `cr_unsc_v1`, `scotus_v1`).
  - [x] Neon gone: 3 one-shot `_fix/_check` scripts deleted; `audit-gaps.ts`, `audit-worldbank-crisis.ts`,
        `ingest-cces.ts` moved to the pg adapter; `serverExternalPackages` trimmed to `pdf-parse`.
  - [x] **Prisma:** 20 models removed (User, Account, Session, VerificationToken, Org, Membership, OrgIpRange,
        OrgUsageDaily, ApiKey, ApiUsage, LitigationMatter, MatterClaim, MatterExport, Collection, CollectionItem,
        Profile, Follow, Bookmark, TopicSubscription, ClaimSubscription) + enums MatterStatus, ExportFormat +
        Claim's four back-relations. Migration
        `prisma/migrations/20260930120000_phase3_drop_saas_social_auth/migration.sql` applied to production 2026-09-30
        23:15:52 UTC (`_prisma_migrations.finished_at`, read-only check 2026-10-01); the 20 tables are gone.
  - [x] real 404s: `scripts/gen-route-manifest.mjs` → `lib/route-manifest.json` (104 routes, 14 patterns) runs
        in `npm run build`; middleware gates only paths that exist, unknown paths reach Next's 404.
        `tests/unit/route-manifest.test.ts` fails if the committed file is stale.
  - [x] `/sitemap.xml` fixed: `app/sitemap-index.xml/route.ts` builds the index from `generateSitemaps()`;
        `next.config.ts` rewrites `/sitemap.xml` → it (beforeFiles). Sitemap filters use `LIVE_CLAIM_WHERE`.
  - [x] `LATER.md` written (Congress-as-claims first).
- [x] **Phase 4 — guard** · branch `fix/front-door-phase-4` · done 2026-09-30 · build green · tsc clean ·
      385 unit tests pass, 1 skipped (was 268; +104 per-route manifest cases, +14 link-integrity) · PR: owner pushes the branch and opens it (sits on top of Phase 3's `f1336f3`; merge 2 → 3 → 4)
  - [x] CI now runs the unit suite: new "Unit tests" step (`npm test`) in `.github/workflows/ci.yml` before the DB
        steps. link-integrity, lab-gate, public-edition-routes, route-manifest and corpus-literals gate every PR —
        none of them ran in CI before (only `test:integration` did).
  - [x] `tests/unit/link-integrity.test.ts`: (1) the anonymous surface — every public `page.tsx`, the
        layout/error/not-found files on its path, and the transitive closure of their local imports through
        `app/components/`, `components/`, `lib/` — contains no href to a Lab route. Template hrefs are judged by
        shape (`/members/${id}` → `/members/_`; a fully dynamic `/${x}` counts as Lab); navigation calls
        (`router.push`, `redirect`) count as hrefs. One region-scoped exemption: Nav's admin-only `LAB_SECTIONS`,
        and the test fails if that marker moves. (2) Every internal href in app/, components/, lib/ resolves to a
        manifest page, an `app/api/**/route.ts`, or a `public/` file. (3) `next.config.ts` redirect destinations
        exist. Mutation-tested (Lab href on a public page / in lib/ / in a reachable component, dynamic first
        segment, renamed marker, Lab link outside the exemption, dead href): all seven fail the suite.
  - [x] Found by the guard and fixed: `/topics/[slug]` (public) linked `/domains/<domain>` (Lab) twice — plain text
        now, as the crumb root became in Phase 2; `/datasets/snapshots` linked `/datasets/snapshots/readme`, a page
        that never existed (spec/12 ships the README inside each release) — text now.
  - [x] `public-edition-routes.test.ts`: the superseded link block and its `LAB_ONLY` map (still exempting the
        deleted `/pricing`) removed; keeps list-entries-are-pages, exact matcher and sitemap checks.
        `route-manifest.test.ts`: every manifest route must have its `page.*` file by name; every pattern has a
        dynamic segment.
  - [x] Root doc pile consolidated (see Docs above): 10 referenced → `docs/`, 29 → `docs/archive/` + index. 227
        references rewritten to repo-relative paths in live files (AGENTS.md, STATUS.md, AUDIT.md §E, code comments,
        specs/, legal/, docs/, `scripts/er-worker.sh`). Left as-is: `docs/archive/*`, `briefs/`, `briefings/`, and
        the applied migration `20260708150000_add_transition_seq` (Prisma checksums migration files).
  - [x] `LATER.md` §4: MCP endpoint, unauthenticated read-only, over the public claim graph.
- [x] **Phase 5 — presentable** · branch `fix/front-door-phase-5` · done 2026-09-30 · build green · tsc clean ·
      391 unit tests pass, 1 skipped (+6: `og-metadata.test.ts`) · PR: owner pushes the branch and opens it (sits on Phase 4's `8ac3770`; merge 2 → 3 → 4 → 5).
      Replaces the old "content" Phase 5 — sourcing the taxonomies and story receipts stay in `LATER.md`.
  - [x] Honest states: `components/DataState.tsx` = `LoadingState` / `EmptyState` / `ErrorState` (three sentences:
        waiting · "No X for this filter" · "Couldn't load X" + Retry). Client fetchers now check `r.ok`, keep an
        `error` state and a retry key: `/opinions`, `/retraction-explorer`, `/topics/[slug]` (404 ≠ error),
        WorldBankView, `/trajectories`, `/search`, the explorer list. SSR empty lists use `EmptyState`
        (patterns, open-questions, case-studies, split-ledger ×2, settling-curve/[id], datasets/[tag], receipt
        sources). `app/error.tsx` + `app/loading.tsx` (root), `app/claims/[id]/error.tsx` on the shared state.
        Verified in Chromium against the production build with `/api/*` intercepted to 500: every page shows the
        error state and Retry recovers; empty filters show the empty state with "Clear filters".
        Optional claim-page panels (`WhatHappenedNext`, `ClaimRelations`, `TopicTimeline`) still hide on failure.
  - [x] Caching: `/settling-curve` and `/split-ledger` were dynamic all along (they read `searchParams`), so their
        `revalidate` never applied; same for `/api/retractions`, `/api/history`, `/api/trajectories/[id]`. Now
        `unstable_cache` (1 h) behind all of them + `Cache-Control: s-maxage=3600`: `lib/trajectory-list.ts`
        (curated list in 1,000-row chunks — the whole list is 3.1 MB and the data cache refuses items over 2 MB,
        logged as "Failed to set Next.js data cache"), `lib/split-ledger.ts` loaders, `/api/opinions`,
        `/api/retractions` (free-text `q` bypasses), `/api/history` (curated lens derives from the chunked list;
        machine lens cached), `/api/trajectories`, `/api/trajectories/[id]`. Measured warm: opinions 1.8 s → 8 ms,
        trajectories 6.6 s → 20 ms, `/settling-curve` 6.5 s → 63 ms. `/`, `/retraction-explorer`, `/reversals`
        were already ISR. `use cache` needs `cacheComponents: true` (whole-app change) — LATER.
  - [x] Open Graph: `lib/og-shared.tsx` `CurveCard` draws the settling curve (SettlingCurveMini geometry, inline
        SVG) for `/api/og/trajectory` and `/api/og/claim` (falls back to the axis card when a claim has no
        history); `/api/og/default` is the card for everything else. `lib/og.ts` `socialMetadata()` attaches an
        image to every `openGraph`/`twitter` block — a child `openGraph` replaces the parent's whole object, so
        the root default alone was not enough; 11 pages (communities, start-here, split-ledger, 8 stories →
        their trajectory's curve) converted. Verified: every page emits `og:image` + `twitter:card`.
  - [x] README: one paragraph, three Playwright screenshots (`docs/screenshots/`, `scripts/screenshots.mjs`,
        `playwright` devDependency), Run locally / Data (Zenodo DOI 10.5281/zenodo.23049991) / Architecture;
        Pipeline Scripts kept.
  - [x] Sentry removed: no DSN or auth token in any env, and the three `Sentry.init` config files were never loaded
        (no `instrumentation.ts`/`instrumentation-client.ts`, required since SDK v8) — it was inert. Gone:
        `@sentry/nextjs`, `withSentryConfig`, `sentry.*.config.ts`, `/api/sentry-tunnel` (+ middleware
        allowlist/rate-limit rows), the CI `sourcemaps` job, runbook rows.
  - Found on the way: `/settling-curve/[id]` showed slugs as `№ AL-DRIFT` (`id.slice(-8)` meant for CUIDs) — slugs
        now shown whole.
  - [x] Found on the way → fixed · branch `fix/auto-trajectories` · 2026-09-30 · build green · tsc clean · 396 unit
        tests pass, 1 skipped (+5 `auto-trajectories.test.ts`) · PR: owner pushes the branch and opens it.
        The "most recent auto-generated" trajectories were **0**: `getAutoTrajectories` took the newest 5,000 claims
        with *any* history (each carries one transition) and only then applied the ≥2 filter. The count now runs in
        SQL (`autoTrajectoryIdsSql`: `ClaimStatusHistory` GROUP BY claim HAVING COUNT(*) ≥ $min → live, non-curated,
        `createdAt` DESC with an `id` tie-break, LIMIT $limit; bind parameters only, ~2 s cold). Read-only count:
        236,181 live non-curated claims have ≥2 transitions, so `/api/trajectories` returns 5,698 curated + 5,000 auto,
        each with ≥2 milestones, and the explorer reads "5,698 CURATED TRAJECTORIES · 5,000 MOST RECENT
        AUTO-GENERATED" (the sidebar's typed "Showing curated trajectories" now shows the same derived label).
        Chunked, not trimmed: 5,000 cards measure ~2.9 MB by the Data Cache's own count (over its 2 MB limit), so
        the cards load in 1,000-id chunks (~580 KB each) keyed by their ids, under a cached id list (150 KB) — the
        API keeps its documented 5,000. Only the full list is cached; `limit` slices afterwards and `minMilestones`
        is capped in the key (NaN → 2), so query strings no longer grow the cache key space.

- [x] **Phase 6 — hardening** · branch `fix/front-door-phase-6` (from `origin/main` `1e4e632`) · done 2026-10-01 ·
      build green · tsc clean · 624 unit tests pass, 1 skipped (was 396) · eslint 0 errors · PR: owner pushes the branch and opens it.
      The planned defects were reproduced on a production build of the untouched branch (curl + Chromium) and
      accepted on the final build. A read-only multi-agent review of the diff then found one major and several minor
      issues (reproduced on intermediate builds or by prototype); all are addressed on this branch (listed in the PR).
  - [x] real 404s: `app/loading.tsx` (phase 5) removed — it streamed every page after a 200 shell, so unknown ids on
        `/claims/`, `/settling-curve/`, `/datasets/`, `/embed/trajectory/` were ISR-cached 200s. Guard
        `tests/unit/no-soft-404.test.ts`. By design: a throw while rendering a dynamic page is now a real 500; dynamic
        routes are no longer prefetched; a 404's body is Next's error shell (noindex) with the not-found UI rendered
        client-side; `app/not-found.tsx` and `app/claims/[id]/not-found.tsx` carry their own titles.
  - [x] one robots.txt: `public/robots.txt` (stale; shadowed `app/robots.ts` under `next start`) removed;
        `app/robots.ts` allows `/api/og/` (link-preview images) and keeps `Disallow: /api/`. `tests/unit/robots.test.ts`.
  - [x] link previews: the root layout's block is image-only (`defaultSocialMetadata()`), so ~25 pages stop
        inheriting the homepage's og:url/og:title; the homepage keeps its own og:url; Satori title clamp
        (`textOverflow: "ellipsis"`) + shared `truncate()`. `tests/unit/og-metadata.test.ts` runs the real layout
        metadata through Next's resolver.
  - [x] middleware decodes the path once: 400 for malformed escapes; 308 for encoded ASCII aliases (allowlisted target,
        no "//", stability check — no loops, no protocol-relative Location); every gate judges both spellings; the
        dot rule is gone (any manifest page is gated, prefetch segment files included); `from=` is the raw path;
        POST `/api/search/miss` gets its 5/min. `/login` redirects through `lib/safeRedirect.ts` (same origin only,
        dot-segment safe) and reports rate limits and network errors honestly.
  - [x] bounded cache keys on `/api/opinions` (dated views uncached), `/api/retractions` (+ `lib/retraction-filters.ts`),
        `/split-ledger`, `/canon` and `/api/trajectories/[id]` (an uncached existence check keeps unknown ids out
        of the Data Cache and makes hard-deleted or renamed rows 404 at once); the last hand-rolled SQL escape is gone.
  - [x] honest states: curve detail error/not-found/Retry, Cite checks the status, `/sources` no longer swallows DB
        errors, era counts "…"/"—", `/opinions` header from the unfiltered total, full-text curated search,
        `/datasets/[tag]` "unset". `/retraction-explorer` filters move the URL with `history.pushState`, and it and
        `/corrections` are rendered per request: as ISR pages, a deep link's query stuck to every later `<Link>` to
        them for 5 minutes (the nav and homepage links to the explorer; a correction filed against an earlier
        transition).
  - [x] docs/CI: README corrected (DIRECT_URL, dev can write, the integration seed wipes its target — it now refuses a
        database not named `*_test` — caching exceptions, transition sources); removed
        `.github/workflows/api-contract.yml`, `public/api/openapi.yaml`, `.spectral.yaml`; the 6 resolved drift lines
        (ApiKey/Org/Collection) pruned; `LATER.md` §5 holds the 2026-10-01 review findings not fixed here.
  - Pending, owner-side: CI's "Check migration drift" step (expect "Only known drift present (10 lines) — OK");
    the live checks after deploy (the redeploy also clears soft-404 and alias ISR entries).
  - Owner decisions listed in the PR: `Allow` `/api/oembed` and the read APIs client pages render from; uninstall
    `@stoplight/spectral-cli`; "unset" vs "unclassified"; the `/opinions` "linked to related legislation" copy.

- [x] **Transition sourcing (`claude_sourcing_v1`)** · branch `feat/transition-sourcing` (from `origin/main` `21ddb9c`) ·
      run 2026-10-08/09 · build green · tsc clean · 646 unit tests pass, 1 skipped · not pushed. Findings:
      `docs/TRANSITION-SOURCING-2026-10-09.md`; runbook: `scripts/README-sourcing.md`.
  - **The DB was written on purpose here, by owner approval:** migration `20261008120000_transition_source_candidates`
    is applied (2026-10-08 23:25 UTC), and the new `TransitionSourceCandidate` table is the only table the
    pipeline writes. `ClaimStatusHistory` (1,822,644), Source and Edge are untouched. Promotion into Source + Edge
    is `scripts/promote-transition-sources.ts --confirm`, run by hand after review; it never touches
    `ClaimStatusHistory`.
  - Premise corrected: curated transitions were already 99.97% sourced (11,808 / 11,811), but 5,512 (47%) cite
    Wikipedia — 98% of those in `seed:human-history-trajectories`. Those, plus the 6 with no usable source, are
    the 5,518 targets.
  - Done: 4,764 of 5,518 (pilot 200, full run 3,515, top-up 1,049; md5 order, so a random sample) for **$198.80**,
    i.e. the promo credit is used up. Results: 4,705 candidates (1,589 rated ≥ 0.5, 528 ≥ 0.7) and 59
    `no_source_found`. Haiku 5.5 first, with Sonnet 5.5 only when Haiku had nothing usable. 754 remain
    (~$28 at the same rate, which would now come from the purchased balance).
  - Spend came from the $200 promo credit, which expires 2026-10-12 UTC. The lifetime cap is $180; all API
    calls must finish by 2026-10-11 18:00 New York. Ledger: `logs/transition-sourcing-ledger.jsonl` (gitignored).
    The key is multi-workspace and needs `ANTHROPIC_WORKSPACE_ID` in `.env.local`.
  - Found: history "settling" dates cluster on round years. Of 1,621 year-precise RECORDED→SETTLED rows, 401 fall
    on a century year and 232 in 2000. About 90 candidates flag a stored date that disagrees with its record.
    Details and examples are in the findings doc.
  - Machine review (2026-10-09, `feat/verify-transition-sources`): `scripts/verify-transition-sources.ts` fetched all
    4,705 candidate URLs. The excerpt was on the page for 2,693; about 1,060 were bot-walled. `review --auto-review --apply`
    then accepted 809 (excerpt on page, not metadata, confidence ≥ 0.5) and rejected 88 (links dead on two checks).
    3,808 are left as candidates for a human. Every decision is recorded in `trace.review.by` as
    `machine:verify-transition-sources`; promotion writes those rows as `humanReviewed` false, `autoApproved` true.
    Not promoted yet: the plan is 809 rows, 768 distinct URLs, 34 of them already a Source.

## Owner's side (not blocking)

- [ ] `grep -c error /tmp/restore-rest.log` on the server → expect 0 (then the empty tables above were empty on Neon)
- [ ] move `/var/lib/pgsql/dump/epistemic_receipts_backup.dump` (12 GB) off the root disk
- [ ] rotate the NARA API key when the new one arrives; put it in `.env.local` as `NARA_API_KEY` (the script reads
      that; no NARA var exists there today); then run the `git filter-repo` purge command from the Phase 0 chat report
      (mirror clone → `--replace-text` → force-push; collaborators re-clone)
- [ ] transition sourcing: approve `scripts/promote-transition-sources.ts --confirm` for the 809 machine-accepted rows
      (or spot-check them first with `--sample 20 --status accepted`); then review the 3,808 left
      (`scripts/review-transition-sources.ts --sample 50 --min-confidence 0.7`,
      then `--accept` / `--reject`), then promote with `scripts/promote-transition-sources.ts --confirm`. Push
      `feat/transition-sourcing` and open its PR.

## Next action

Phases −1…6 and `fix/auto-trajectories` are merged (PRs #22–#30, `origin/main` `21ddb9c`); the Phase 3 migration is
applied. `feat/transition-sourcing` is done, awaiting owner review (see its entry above). Next: the owner redeploys
→ Phase 6b (`feat/wire-what-exists`)
→ Phase 6c (`fix/bce-dates`: code first; the data fix is the owner's) → Phase 7 (`feat/congress-link`). `LATER.md` §1's
premise is outdated: Congress roll-calls (`voteview_v1`) and enacted laws (`congress_v1`) are already claims — Phase 7
links, corrects and relates them rather than re-ingesting.
