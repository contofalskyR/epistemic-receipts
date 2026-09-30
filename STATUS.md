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
- `npm run build` = `prisma generate && next build`; it prerenders 288 pages against the live DB (reads only).
  `scripts/` is excluded from `tsconfig.json`, so build/`tsc` never type-check it.
- `gh` is not installed and git has no GitHub credential in this shell: agents commit locally, the owner pushes
  with `! git push -u origin <branch>` and opens the PR at
  `https://github.com/contofalskyR/epistemic-receipts/compare/main...<branch>?expand=1`.
- Vercel production = `main`. Homepage is ISR (`revalidate = 3600`); after data changes, Redeploy without build cache.
- Server: `ssh opc@…`, tmux session `restore`, PGDATA `/var/lib/pgsql/17/data`, dump at `/var/lib/pgsql/dump/`.
- Known false positive: `165,250` / `165,233` in the code are `rgba()` colour literals, not counts.

## Phases

- [x] **Phase -1 — pg driver** · branch `phase-minus-1/pg-driver` · PR #22 merged · build green · counts verified.
- [ ] **Phase 0 — stop the bleeding** · branch `fix/front-door-phase-0` (awaiting "go")
  - [ ] strip NARA key line from `NARA-ROADMAP.md`; give owner the `git filter-repo` purge command (owner runs it)
  - [ ] `/datasets/[tag]`: `await params` (un-404s every card linked from /about, /methodology)
  - [ ] delete redirect-shadowed pages + their API routes: `/stock-act`, `/foreign-legislation`, `/alerts`, `/bookmarks`;
        move `/timeline` and `/reader` redirect stubs into `next.config.ts`; alert emails → `/following`
  - [ ] add `/docs/api` to `PUBLIC_ROUTES`; hide "Collect" when there is no auth surface
  - [ ] commit `AUDIT.md` + `STATUS.md`
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
- [ ] rotate the NARA API key when the new one arrives; then run the purge command from the Phase 0 PR

## Next action

Owner says "go" → Phase 0.
