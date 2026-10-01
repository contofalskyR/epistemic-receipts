# STATUS.md — live tracker (read this first)

One file, kept short, updated at every phase boundary. Agents: read this and `AUDIT.md`, not the doc pile.
Owner: to resume in a fresh session, say "read STATUS.md, continue Phase N".

## Current state (2026-09-30)

- DB: self-hosted PostgreSQL 17 + pgvector on OCI (83 GB volume, ~30 GB free). Restored from
  `epistemic_receipts_backup.dump`; all large tables verified present (Claim 1,758,105 / deleted=false 1,758,084;
  ClaimStatusHistory 1,822,644; Edge 1,718,766; ClaimRelation 4,820,213; MemberVote 1,798,569;
  ClaimEmbedding 1,757,943; EdgeRevision 1,557,521). Still 0 rows: PipelineRun, User, ApiKey, ApiUsage, Session,
  Account, VerificationToken, Follow, Collection*, *Subscription, AlertSent, SavedQuery, Org*, Litigation*,
  TransitionClaimsSnapshot, SourceCredibilityEvent, SuggestedThresholdEvent, AiJob — believed empty on Neon too.
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
`npm run build` before every push; data-facing counts verified with a read-only query. Nothing writes to the DB.

## Docs (where things are, since Phase 4)

- Root: `README.md`, `CLAUDE.md` → `AGENTS.md` (agent rules), `STATUS.md` (this tracker), `AUDIT.md` (route audit,
  2026-09-29), `LATER.md` (backlog). Nothing else lives at the root.
- `docs/`: the ten docs that code, specs, AGENTS.md or runbooks still cite — `CONSULTANT.md` (architectural memory),
  `SCALING.md` (+ `specs/`), `SECURITY-REVIEW-2026-06-12.md`, `ORDERING-SEMANTICS-2026-07-08.md`,
  `CORPUS-PROMOTER-BULK-PLAN.md`, `PUBLISH-CHECKLIST.md`, `ROADMAP.md`, `TASK_QUEUE.md` (read by
  `scripts/er-worker.sh`), `HARD_FACTS_DOMAINS.md`, `epistemic-receipts-marketing.md` (house rule cited by
  `lib/format.ts`) — beside the pre-existing dated handoffs and `docs/runbooks/`.
- `docs/archive/`: 29 superseded root docs, one line each in `docs/archive/README.md`. Files unchanged (they still
  name each other by old root paths). `briefs/` and `briefings/` untouched — historical.

## Environment facts (so a fresh agent needn't rediscover them)

- `.env.local` has `DATABASE_URL` → the OCI Postgres (self-signed cert, URL ends in `?sslmode=require`).
  `lib/prisma.ts` strips that param and passes `ssl: { rejectUnauthorized: false }`; do the same in ad-hoc
  scripts (see `scripts/ingest-cces.ts`). `DATABASE_URL_READ` is no longer read by anything (the v1 read client
  went in Phase 3).
- Read-only verification pattern (no writes, ever):
  `node -e 'require("dotenv").config({path:".env.local"}); const {Pool}=require("pg"); …pool.query("select …")'`.
- `npm run build` = `prisma generate && node scripts/gen-route-manifest.mjs && next build`; it prerenders 309 pages against the live DB (reads only).
  **Locally, run it as `CIRCLE_NODE_TOTAL=2 npm run build`** (1 prerender worker, ~4 min, 0 timeouts — verified
  2026-09-30). The default 9 workers saturate the OCI Postgres and the sitemap's deep-OFFSET claim chunks
  (`app/sitemap.ts`, `claims-25..28`, ~37 s each in isolation) exceed Next's 60 s static-generation timeout →
  "Failed to build /sitemap/[__metadata_id__]/route … after 3 attempts", exit 1. Two default-config runs failed
  that way on 2026-09-30 with an unrelated diff; not a code problem. (`CIRCLE_NODE_TOTAL` is what Next's default
  `experimental.cpus` reads — no config change needed.) Vercel builds fine as-is.
  `scripts/` is excluded from `tsconfig.json`, so build/`tsc` never type-check it. After deleting routes, run the
  build before `tsc --noEmit`: the stale generated `.next/types/validator.ts` otherwise reports phantom errors.
- `gh` is not installed and git has no GitHub credential in this shell: agents commit locally, the owner pushes
  with `! git push -u origin <branch>` and opens the PR at
  `https://github.com/contofalskyR/epistemic-receipts/compare/main...<branch>?expand=1`.
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
        Claim's four back-relations. Migration written, **NOT applied** (nothing writes to the DB):
        `prisma/migrations/20260930120000_phase3_drop_saas_social_auth/migration.sql` — owner runs
        `npx prisma migrate deploy` after merge. Until then the tables sit unused; the app never touches them.
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
  - Found on the way: the "5,000 most recent auto-generated" trajectories are **0** — the newest 5,000 claims
        with history all carry one transition and the ≥2 filter runs after the `take` (LATER); `/settling-curve/[id]`
        showed slugs as `№ AL-DRIFT` (`id.slice(-8)` meant for CUIDs) — slugs now shown whole.

## Owner's side (not blocking)

- [ ] `grep -c error /tmp/restore-rest.log` on the server → expect 0 (then the empty tables above were empty on Neon)
- [ ] move `/var/lib/pgsql/dump/epistemic_receipts_backup.dump` (12 GB) off the root disk
- [ ] rotate the NARA API key when the new one arrives; put it in `.env.local` as `NARA_API_KEY` (the script reads
      that; no NARA var exists there today); then run the `git filter-repo` purge command from the Phase 0 chat report
      (mirror clone → `--replace-text` → force-push; collaborators re-clone)

## Next action

Merge Phase 2 → 3 → 4 → 5, run `npx prisma migrate deploy`, redeploy. Then the content backlog in `LATER.md`
(Congress as claims first).
