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

- Corpus count = `deleted = false` (1,758,084). Public figure stays "1.76M". One helper, one query, no literals.
- Lab serving = one deployment; non-public routes require the admin cookie; Lab dropdown only when logged in.
  Retire the two-project `NEXT_PUBLIC_EDITION` scaffolding.
- Top nav = Settling Curve · Search · Opinions · Retractions · Split Ledger · Reversals (+ About).
  Methodology / Corrections / legal in the footer.
- The 33 taxonomies + `/fields` + `/statistics` move to Lab as one block.
- Hard constraints: don't rename `middleware.ts`; don't move `/embed`, `/claims/[id]`, `/settling-curve/[id]`;
  no `/lab/` prefix; exact-match the public route list; move listing pages, not prefixes.

## Working rules

One phase at a time, one branch + one PR per phase, stop for go-ahead between phases. Single agent, no subagents.
`npm run build` before every push; data-facing counts verified with a read-only query. Nothing writes to the DB.

## Environment facts (so a fresh agent needn't rediscover them)

- `.env.local` has `DATABASE_URL` → the OCI Postgres (self-signed cert, URL ends in `?sslmode=require`).
  `lib/prisma.ts` / `lib/v1/readClient.ts` strip that param and pass `ssl: { rejectUnauthorized: false }`;
  do the same in ad-hoc scripts. `DATABASE_URL_READ` is optional (falls back to `DATABASE_URL`).
- Read-only verification pattern (no writes, ever):
  `node -e 'require("dotenv").config({path:".env.local"}); const {Pool}=require("pg"); …pool.query("select …")'`.
- `npm run build` = `prisma generate && next build`; it prerenders 309 pages against the live DB (reads only).
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
  - [x] strip NARA key from `NARA-ROADMAP.md` — it was also in `HISTORY.md`, `ROADMAP.md`, `TASK_QUEUE.md`; all four
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
- [ ] **Phase 1 — honest numbers** · `corpusCount()` helper everywhere, delete 1.76M/1.7M+ literals;
      `/prereq-graph` header from the body's query + error state; `/api/corpus-stats` join fix;
      "N CURATED" label; topics/patterns/open-questions/retraction-wall filter alignment
- [ ] **Phase 2 — the Lab line** · nav to six links; Lab group behind admin cookie; `PUBLIC_ROUTES` edits
      (taxonomy block, /analysis, /stats, /globe, /legislation, /drug-arc, /historical-events, /pipelines,
      /meta-edges, /feed, /books; `DENY_EXACT` for /claims, /topics, /settling-curve/coverage|overview);
      retarget homepage tiles; retire edition scaffolding
- [ ] **Phase 3 — delete & consolidate** · `/edges`, `/globe/lab` (port deep-time slider first),
      `/analysis/corpus` (port transition matrix first), five page-less `data.ts` dirs, ~25 uncalled API routes,
      two of three pipeline registries, six scripts still importing the Neon driver
- [ ] **Phase 4 — guard** · route-link test in CI, extended to components/, lib/, template hrefs;
      public→Lab links fail; every `PUBLIC_ROUTES` entry must have a page
- [ ] **Phase 5 — content** · source the taxonomies, inline receipts in stories, claim links on Analyze pages

## Owner's side (not blocking)

- [ ] `grep -c error /tmp/restore-rest.log` on the server → expect 0 (then the empty tables above were empty on Neon)
- [ ] move `/var/lib/pgsql/dump/epistemic_receipts_backup.dump` (12 GB) off the root disk
- [ ] rotate the NARA API key when the new one arrives; put it in `.env.local` as `NARA_API_KEY` (the script reads
      that; no NARA var exists there today); then run the `git filter-repo` purge command from the Phase 0 chat report
      (mirror clone → `--replace-text` → force-push; collaborators re-clone)

## Next action

Owner says "go" → Phase 1.
