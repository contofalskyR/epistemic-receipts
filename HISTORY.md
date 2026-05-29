# HISTORY.md — How Things Were Built

A running log of non-obvious decisions, dead ends, and what actually worked. Read this before touching a pipeline.

---

## NARA Catalog Ingestion (`scripts/ingest-nara-catalog.ts`)

### What works (as of 2026-05-29)
- **Simple page-based pagination** — `page=1..N` with `limit=100`. No date filtering. Cursor saved to `.nara-cursor.json` per RG.
- **Resume** — `--resume` loads cursor and picks up from saved page. Safe to kill and restart.
- **Scoped runs** — `--record-group 59` to run one RG only. Flag is `--record-group`, NOT `--rg`.
- **Budget cap** — `--max-pages 50` to limit calls per run (50 pages = 5,000 records = 5,000 API calls).

### What was tried and failed

**searchAfter cursor pagination (May 28, 2026 — commit `3cac79f`)**
- Attempted Elasticsearch `search_after` parameter to bypass the 10k result cap.
- NARA API v2 silently ignores `searchAfter`. Returns same results regardless. Abandoned.

**Date-range slicing — decade windows (May 29, 2026 — commit `0b407aa`)**
- Attempted to split the full year range (1900–2026) into 10-year windows using `dateRangeStart`/`dateRangeEnd`.
- Assumption was each decade would have <10k records. Wrong — NARA's `total` field returns the full RG count regardless of date filter for RG59/RG263/RG330. Every window showed 76,870 (the full RG59 total). Abandoned.

**Adaptive slicing — 5-year windows expanding to 1-year (May 29, 2026 — commits `d99cf03`, then reverted)**
- Attempted to check slice size via `sliceTotal()` and expand dense windows to 1-year.
- Same root problem: `sliceTotal()` queries the API with date range and gets back the RG total regardless. Every slice looked "dense" (76k+) and was expanded to 1-year windows. This would burn 127 slices × 769 pages = ~97k API calls (10× monthly budget). Abandoned.

### The real constraint
- 10,000 API calls/month per key × 100 records/call = 1,000,000 records/month max in theory.
- But: 10k calls ÷ 100 pages/RG = 100 RG runs per month.
- RG59 has ~76k records = ~760 pages. At 10k calls/month, takes ~1 month per key for RG59 alone.
- RG330 has ~307k records = ~3,070 pages. Takes ~4 months per key.
- **Multi-key strategy**: Register 2–3 free keys at Catalog_API@nara.gov. Rotate keys per run to multiply monthly capacity.

### Cursor file format (`.nara-cursor.json`)
```json
{
  "59": { "nextPage": 101, "fetched": 10000, "total": 76870, "complete": false },
  "330": { "nextPage": 1, "fetched": 0, "total": 0, "complete": false }
}
```
Cursor key = RG number (plain string, e.g. `"59"`). Cursor saved after every page.

### Running a budget-capped RG59 run
```bash
# First run — pages 1–100 (10k records, 10k API calls)
ALLOW_EDITS=true npx ts-node -r dotenv/config scripts/ingest-nara-catalog.ts \
  --record-group 59 --full --max-pages 100 dotenv_config_path=.env.local

# Resume next month — pages 101–200
ALLOW_EDITS=true npx ts-node -r dotenv/config scripts/ingest-nara-catalog.ts \
  --record-group 59 --resume --max-pages 100 dotenv_config_path=.env.local
```

### API keys
- Key 1: `KSHVEuDXNd27xXkByehli5Eak8TvnKJi99Kiz7DK` (in `.env.local`)
- Keys 2–3: register at Catalog_API@nara.gov (free, ~1 week turnaround)

---

## Epistemic Receipts Performance Crisis (May 26, 2026)

At ~842k claims the site went down. Fixed with:
- 35 `CREATE INDEX CONCURRENTLY` indexes on hot query paths
- 7 API routes hardened with explicit field selection (no SELECT *)
- CSP rule: `next.config.ts` script-src MUST keep `'unsafe-inline'`. Removing it silently breaks React hydration/RSC streaming.

---

## NARA HistoricalEvent Linking (`scripts/link-nara-to-events.ts`)

- Keyword pattern matching, not embeddings. Fast, deterministic, auditable.
- 31,930 NARA claims → 1,478 event links (Cold War 774, Cuba 508, Vietnam 159, JFK 34, Church 3)
- Patterns defined as `{ keywords: string[], eventSlug: string }` arrays. Add new events here.

---

## Book Reader + Match Pipeline

**What works:**
- `scripts/ingest-book.ts` — chunks PDF/text, runs Haiku to extract `BookClaim` rows per chunk
- `scripts/match-book-to-graph.ts` — PostgreSQL full-text search for candidates, then Haiku verification
- `/reader/[bookId]` — BibleViz-style arc diagram, paragraph match badges, amber blockquote for verbatim quotes

**Dead end — self-referential matches (May 2026):**
- `scripts/analyze-book-connections.ts` was generating new `Claim` rows from book chunks AND linking them back to `BookClaimMatch` pointing at those same chunks.
- The book was citing itself. Removed the `BookClaimMatch` writes from that script.
- Correct model: `BookClaimMatch` links a book's extracted claims to *pre-existing external claims*, not to claims generated from the same passage.

**Bay of Pigs books — enrichment outcome (May 2026):**
- IG Survey (70 chunks) — mostly classification headers and OCR-garbled text. Enrichment returned NULL for all matches; all deleted. Not worth re-running.
- Congressional Statement (6 chunks, 16 claims) — good quality. Claims written to DB with Source + Edge wiring. Status: PROVISIONAL, `source_quality: ocr_scan`.
