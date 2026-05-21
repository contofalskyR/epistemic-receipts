# Epistemic Receipts — Task Queue

The autonomous worker picks the **first unchecked item** every 5 hours and works it.
Add tasks here anytime. Robert reviews commits; never auto-pushes.

---

## Queue

---

## Completed

<!-- Worker appends completed tasks here with date -->
- [x] **Wikidata cross-reference enrichment** — After Uruguay (`uruguay_legislation_v1`) finishes ingestion, write and run a script to link existing Source records to Wikidata Q-numbers via the Wikidata SPARQL endpoint. Scope: legislative sources first (match by title + jurisdiction), then expand. This is enrichment only — do NOT ingest Wikidata claims as HARD_FACT. See ROADMAP.md Tier 3 for context. (completed 2026-05-21 06:35 EDT)
- [x] Run dry-run for ICD-11 pipeline via `npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icd11.ts --dry-run` and report candidate count + sample records (completed 2026-05-19 00:10 EDT)
- [x] Review Pipeline 10 (Nobel Prizes) script for production-readiness: verify Nobel Foundation API endpoints are live, spot-check 3 laureates, report findings (completed 2026-05-18 23:35 EDT)
- [x] Review Pipeline 9 (SEC Edgar) script for production-readiness: verify all URLs are fetchable, spot-check 3 anchor filings against canonical SEC URLs, report findings (completed 2026-05-18 22:39 EDT)
- [x] Audit the claims list UI — check for any date fields displaying as raw ISO strings instead of human-readable format; fix any found (completed 2026-05-18 22:36 EDT)
- [x] Run dry-run for Pipeline 13 (CrossRef retractions) via `npx tsx scripts/ingest-retractions.ts --dry-run` and report candidate count + sample records (completed 2026-05-18 22:34 EDT)
- [x] Run dry-run for Pipeline 12 (USGS earthquakes M6.5+) via `npx tsx scripts/ingest-usgs-earthquakes.ts --dry-run` and report candidate count + sample records (completed 2026-05-18 22:34 EDT)
