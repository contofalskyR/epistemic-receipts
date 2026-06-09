# Epistemic Receipts

A Next.js knowledge graph that transforms raw data from 50+ authoritative sources into 1.6M+ verifiable, cross-referenced claims — each one traceable to a primary source.

## What It Is

Epistemic Receipts ingests structured records from government archives, scientific databases, international bodies, and legislative systems, then organizes them as a navigable graph of facts. Every claim carries:

- **A source** — the authoritative record it came from (NARA, OpenAlex, Congress.gov, WHO, FDA, UN, CourtListener, etc.)
- **An epistemic axis** — `SETTLED`, `CONTESTED`, `RECORDED`, or `OPEN`, classifying the claim's evidentiary status
- **Cross-references** — edges to related claims across datasets (e.g., a clinical trial linked to its published paper, linked to its FDA approval)

## Key Features

- **Interactive 3D globe** — explore claims by geography
- **Citation graph** — navigate cross-dataset relationships visually
- **Epistemic axis classification** — browse claims by confidence level
- **Full-text search** — across 1.6M+ records
- **Topic alerts** — subscribe to claim categories (watched topics)
- **Book reader** — arc-diagram view linking books to supporting/contradicting claims

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router) |
| Database | Neon Postgres (serverless) |
| ORM | Prisma |
| Hosting | Vercel |
| Data pipelines | TypeScript (130+ `scripts/ingest-*.ts`) |

## Data Sources (sample)

NARA declassified records · OpenAlex academic papers · Congress.gov bills & votes · WHO GHO · FDA openFDA · UN Security Council & GA resolutions · UN Treaties · CourtListener (SCOTUS, circuits, state supreme courts) · DOJ FARA · SEC EDGAR · NIH Reporter · ClinicalTrials.gov · SIPRI military expenditure · UCDP conflict data · V-Dem · CrossRef retractions · Nobel Prize · PubChem · MeSH · 60+ national legislative corpora

## Development

```bash
# Install dependencies
npm install

# Pull environment variables (requires Vercel CLI)
vercel env pull .env.local

# Run database migrations
npx prisma migrate dev

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pipeline Scripts

Ingest scripts live in `scripts/`. Each targets a single source and writes to the `Claim` table via Prisma.

```bash
# Run any pipeline script
npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-<source>.ts

# Generate pipeline registry markdown table (for AGENTS.md)
npx dotenv-cli -e .env.local -- npx tsx scripts/sync-registry.ts
```

See `AGENTS.md` for the full active pipeline registry and ingestion notes.
