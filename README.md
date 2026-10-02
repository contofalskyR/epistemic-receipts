# Epistemic Receipts

Epistemic Receipts is a public record of how claims change status over time. Its ~1.76M claims — drawn from scientific papers, legislation, court opinions, regulatory records and declassified archives — carry an epistemic axis (`SETTLED`, `CONTESTED`, `RECORDED`, `OPEN`, `REVERSED`, `ABANDONED`, `UNRESOLVABLE`; about 99% are classified), and about 97% link to at least one source record. Most (about 90%) also carry the dated transitions between those states; a transition names the source that marks it where one was recorded (30,068 of 1.82M transitions). Figures as of 2026-10-01. The flagship view is the **settling curve**: how long "settled" stays settled, computed live from thousands of traced trajectories, with a receipt page for every claim.

![Homepage — the settling curve, live corpus count](docs/screenshots/homepage.png)

![The settling-curve explorer — continental drift, 1915 → 1963](docs/screenshots/settling-curve.png)

![A claim receipt — Wegener 1912, six sources, three transitions](docs/screenshots/claim-receipt.png)

*Screenshots captured with Playwright against a local production build: `node scripts/screenshots.mjs`.*

## Run locally

```bash
npm install

# .env.local — PostgreSQL 16+ with pgvector. The Prisma CLI (migrate, validate) also reads
# DIRECT_URL, the non-pooled URL; for a single database it is the same URL.
# `next dev` opens the admin and read-only gates and CAN WRITE: point it at a copy, never at production.
cat > .env.local <<'EOF'
DATABASE_URL=postgresql://user:pass@host:5432/epistemic_receipts
DIRECT_URL=postgresql://user:pass@host:5432/epistemic_receipts
EOF

npx prisma generate
npx prisma migrate deploy        # on an empty database (reads DIRECT_URL)
npm run dev                      # http://localhost:3000 — the admin gates are open in dev
```

Production build and the screenshots:

```bash
CIRCLE_NODE_TOTAL=2 npm run build   # one prerender worker — the default saturates the database
npm start
node scripts/screenshots.mjs        # needs: npx playwright install chromium
```

Tests: `npm test` runs the unit suite (no database; the front-door guards live here). `npm run test:integration` needs a Postgres with the migrations applied and **deletes every row** of `ClaimStatusHistory`, `ClaimTopic`, `EdgeRevision`, `MetaEdge`, `Edge`, `Claim` and `Source` in the database `DATABASE_URL` names (`tests/seed.ts`) — run it only against a throwaway database such as CI's service container (`epistemic_test`). It refuses a database whose name does not end in `_test` unless `ALLOW_DESTRUCTIVE_SEED=1`.

## Data

- **Dataset:** the corpus is archived on Zenodo — DOI [10.5281/zenodo.23049991](https://doi.org/10.5281/zenodo.23049991).
- **Live database:** PostgreSQL 17 + pgvector, self-hosted. `prisma/schema.prisma` is the schema. The core tables are `Claim`, `ClaimStatusHistory` (one row per dated transition, ordered by `seq` — see `docs/ORDERING-SEMANTICS-2026-07-08.md`), `Source` and `Edge` (claim ↔ source evidence links), `ClaimRelation`, `Topic`.
- **Provenance:** every ingestion pipeline is listed with live counts at `/sources`; `lib/pipelines/registry.ts` is the one registry; `/methodology` documents the axis and the transition contract; `/corrections` is the audit log.
- **Sources include:** OpenAlex · CrossRef retractions · Congress.gov · CourtListener (SCOTUS, circuits, state supreme courts) · Federal Register · UN Security Council · openFDA · ClinicalTrials.gov · NIH RePORTER · NARA · V-Dem · World Bank · SIPRI · UCDP · Nobel Prize · PubChem · 60+ national legislative corpora.

## Architecture

- **App:** Next.js 16 (App Router), one Vercel deployment. The public site is an exact route list (`lib/publicEdition.ts`); `middleware.ts` puts every other page behind the admin session, and `lib/route-manifest.json` (generated at build) lets unknown paths reach a real 404.
- **Database access:** Prisma with `@prisma/adapter-pg`. Server components read directly; the handful of client-fetched views call `app/api/*`.
- **Caching:** the homepage is ISR; the data behind the six nav pages (`/settling-curve`, `/search`, `/opinions`, `/retraction-explorer`, `/split-ledger`, `/reversals`) is cached for an hour (ISR or `unstable_cache`, with cache keys bounded to whitelisted, clamped values), except typed searches (`/api/search`, CDN 30 s), free-text retraction searches (`/api/retractions?q=`, CDN 5 min) and date-filtered opinion lists (CDN 1 h), which reach Postgres. A few other public views still query per request (e.g. `/law-settler`, `/embed/trajectory/[slug]`). Claim and curve detail pages render on first hit and are kept for up to an hour (on-demand ISR — the root layout's hourly corpus count lowers their one-day `revalidate`).
- **Honest states:** `components/DataState.tsx` is the one loading / empty / error component; a failed request renders as an error with Retry, never as zero results (`app/error.tsx` for server-rendered pages).
- **Link previews:** `/api/og/trajectory` and `/api/og/claim` draw the settling curve; `/api/og/default` is the card for everything else (`lib/og.ts`).
- **Guards in CI:** link integrity (no anonymous page links into the Lab; every href exists), the Lab gate run as production (encoded, dotted and malformed paths included), route-manifest freshness, no hand-typed corpus figures, real 404s (no loading boundary above a `notFound()` page), one robots.txt, bounded cache keys, same-origin login redirects (`tests/unit/`).
- **Operations:** `STATUS.md` is the live tracker; `AGENTS.md` the agent rules and pipeline principles; `docs/` the referenced docs; `docs/archive/` the rest.

## Pipeline Scripts

Ingest scripts live in `scripts/`. Each targets a single source and writes to the `Claim` table via Prisma.

```bash
# Run any pipeline script
npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-<source>.ts

# Print live claim counts per pipeline (a markdown table)
npx dotenv-cli -e .env.local -- npx tsx scripts/sync-registry.ts
```

`lib/pipelines/registry.ts` is the pipeline registry (`/sources` renders it). `AGENTS.md` holds the ingestion principles; its registry table is a 2026-05-21 snapshot.
