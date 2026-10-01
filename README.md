# Epistemic Receipts

Epistemic Receipts is a public record of how claims change status over time. Each of its ~1.76M claims (2026-09-30) — drawn from scientific papers, legislation, court opinions, regulatory records and declassified archives — carries an epistemic axis (`SETTLED`, `CONTESTED`, `RECORDED`, `OPEN`, `REVERSED`, `ABANDONED`, `UNRESOLVABLE`), the dated transitions between those states, and a primary source for every transition. The flagship view is the **settling curve**: how long "settled" stays settled, computed live from thousands of traced trajectories, with a receipt page for every claim.

![Homepage — the settling curve, live corpus count](docs/screenshots/homepage.png)

![The settling-curve explorer — continental drift, 1915 → 1963](docs/screenshots/settling-curve.png)

![A claim receipt — Wegener 1912, six sources, three transitions](docs/screenshots/claim-receipt.png)

*Screenshots captured with Playwright against a local production build: `node scripts/screenshots.mjs`.*

## Run locally

```bash
npm install

# .env.local — one variable. PostgreSQL 16+ with pgvector; dev only reads.
echo 'DATABASE_URL=postgresql://user:pass@host:5432/epistemic_receipts' > .env.local

npx prisma generate
npx prisma migrate deploy        # on an empty database
npm run dev                      # http://localhost:3000 — every gate is open in dev
```

Production build and the screenshots:

```bash
CIRCLE_NODE_TOTAL=2 npm run build   # one prerender worker — the default saturates the database
npm start
node scripts/screenshots.mjs        # needs: npx playwright install chromium
```

Tests: `npm test` runs the unit suite (no database; the front-door guards live here), `npm run test:integration` needs a Postgres with the migrations applied — CI provides one.

## Data

- **Dataset:** the corpus is archived on Zenodo — DOI [10.5281/zenodo.23049991](https://doi.org/10.5281/zenodo.23049991).
- **Live database:** PostgreSQL 17 + pgvector, self-hosted. `prisma/schema.prisma` is the schema. The core tables are `Claim`, `ClaimStatusHistory` (one row per dated transition, ordered by `seq` — see `docs/ORDERING-SEMANTICS-2026-07-08.md`), `Source` and `Edge` (claim ↔ source evidence links), `ClaimRelation`, `Topic`.
- **Provenance:** every ingestion pipeline is listed with live counts at `/sources`; `lib/pipelines/registry.ts` is the one registry; `/methodology` documents the axis and the transition contract; `/corrections` is the audit log.
- **Sources include:** OpenAlex · CrossRef retractions · Congress.gov · CourtListener (SCOTUS, circuits, state supreme courts) · Federal Register · UN Security Council · openFDA · ClinicalTrials.gov · NIH RePORTER · NARA · V-Dem · World Bank · SIPRI · UCDP · Nobel Prize · PubChem · 60+ national legislative corpora.

## Architecture

- **App:** Next.js 16 (App Router), one Vercel deployment. The public site is an exact route list (`lib/publicEdition.ts`); `middleware.ts` puts every other page behind the admin session, and `lib/route-manifest.json` (generated at build) lets unknown paths reach a real 404.
- **Database access:** Prisma with `@prisma/adapter-pg`. Server components read directly; the handful of client-fetched views call `app/api/*`.
- **Caching:** the homepage is ISR; the data behind the six nav pages (`/settling-curve`, `/search`, `/opinions`, `/retraction-explorer`, `/split-ledger`, `/reversals`) is cached for an hour with `unstable_cache`, so anonymous visits do not reach Postgres. Claim and curve detail pages are rendered on first hit and kept for a day (on-demand ISR).
- **Honest states:** `components/DataState.tsx` is the one loading / empty / error component; a failed request renders as an error with Retry, never as zero results (`app/error.tsx` for server-rendered pages).
- **Link previews:** `/api/og/trajectory` and `/api/og/claim` draw the settling curve; `/api/og/default` is the card for everything else (`lib/og.ts`).
- **Guards in CI:** link integrity (no anonymous page links into the Lab; every href exists), the Lab gate run as production, route-manifest freshness, no hand-typed corpus figures (`tests/unit/`).
- **Operations:** `STATUS.md` is the live tracker; `AGENTS.md` the agent rules and pipeline principles; `docs/` the referenced docs; `docs/archive/` the rest.

## Pipeline Scripts

Ingest scripts live in `scripts/`. Each targets a single source and writes to the `Claim` table via Prisma.

```bash
# Run any pipeline script
npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-<source>.ts

# Generate pipeline registry markdown table (for AGENTS.md)
npx dotenv-cli -e .env.local -- npx tsx scripts/sync-registry.ts
```

See `AGENTS.md` for the full active pipeline registry and ingestion notes.
