# Epistemic Receipts — Task Queue

The autonomous worker picks the **first unchecked item** every 5 hours and works it.
Add tasks here anytime. Robert reviews commits; never auto-pushes.

---

## Queue

### Stage 2 — P1 data model: relations + constraints
- [x] Uppercase all lowercase `ClaimRelation.relationType` values in DB + update query sites (completed 2026-06-09)
- [x] Add `@@unique([bookClaimId, claimId])` to BookClaimMatch in schema + dedupe existing rows + migrate (completed 2026-06-09)
- [x] Fix duplicate migration timestamp: rename `20260608000000_add_watched_topic` to `20260608010000_add_watched_topic`, then `prisma migrate resolve --applied` (completed 2026-06-09)

### Stage 3 — P1 data model: freshness infrastructure
- [x] Add `PipelineRun` model (pipelineTag, startedAt, finishedAt, rowsWritten, cursor, status, error) to Prisma schema + migrate (2026-06-09)
- [x] Add `ClaimStatusHistory` model (claimId, fromAxis, toAxis, reason, sourceId, createdAt) to Prisma schema + migrate (2026-06-09)

### Stage 4 — P1 docs & repo hygiene
- [x] Build `scripts/sync-registry.ts` to auto-generate AGENTS.md pipeline registry table from `GROUP BY "ingestedBy"` query (2026-06-09)
- [x] `git rm --cached` all ~150 log/dry-run files at root, add patterns to `.gitignore` (2026-06-09)
- [x] Rewrite `README.md` — replace stock create-next-app with project description (use investor memo §2 as base) (2026-06-09)

### Stage 5 — P1 CI quality gate
- [x] Add GitHub Actions workflow: `tsc --noEmit` + `eslint` + gitleaks on PR (2026-06-09)

### Stage 6 — P2 book pipeline fixes
- [x] Replace `claude --print` shell-outs in `match-book-to-graph.ts` with `@anthropic-ai/sdk` + pin `claude-haiku-4-5-20251001` (2026-06-09)
- [x] Fix silent judge failures: log error with bookClaim ID, increment error counter, return JUDGMENT_ERROR sentinel (2026-06-09)

### Stage 7 — P2 search + integrity
- [x] Add generated tsvector column + GIN index to Claim, query with `websearch_to_tsquery` + `ts_rank`
- [x] Build data integrity invariant checks script (source URL coverage, orphaned edges, status vocabulary, dupes) + schedule as nightly cron

### Blocked — needs Robert
- [ ] ⏸ Rotate NYT + Azure keys at provider dashboards — **dashboard rotation is human-only; remains open for Robert.** Code-side prep done by worker 2026-06-09: removed the live NYT key hardcoded as a fallback in `scripts/populate-bill-coverage.ts` (now requires `NYT_API_KEY` from env). Step-by-step rotation runbook: [`docs/key-rotation-runbook.md`](docs/key-rotation-runbook.md). No Azure key is referenced in tracked code — confirm it exists before rotating. Check this box once the NYT key is regenerated at developer.nytimes.com and the old key is confirmed dead.
- [ ] ⏸ Set CRON_SECRET, TELEGRAM_CHAT_ID, NYT_API_KEY, COLOMBIA_SEARCH_KEY in Vercel env vars

---

## Completed

<!-- Worker appends completed tasks here with date -->
- [x] ⏸ Collapse 4 status fields → `epistemicAxis` only (needs Robert's 4-way vs 5-way decision) — **analysis done 2026-06-09, awaiting decision.** See [`docs/axis-collapse-decision-2026-06-09.md`](docs/axis-collapse-decision-2026-06-09.md). Backfilled last 1,965 null-axis rows (now 0-null); mapped 210 query-site refs; staged (unapplied) drop migration. Two questions for Robert: (1) 4-way vs 5-way — recommend **5-way**; (2) drop `verificationStatus` too or keep for DEPRECATED/PROVISIONAL — recommend **keep**. Column drop is irreversible and stays unexecuted until answered. (completed 2026-06-09 20:52 EDT — *worker portion only; schema migration still gated on Robert's 2 answers + a supervised read-path swap. No columns dropped.*)
- [x] Redact Neon pooler hostname from `AUDIT-2026-05-21.md` (completed 2026-06-09 16:05 EDT)
- [x] Gate `app/api/books/upload/route.ts` and `app/api/books/[bookId]/ingest/route.ts` with `isReadOnly()` check + reject uploads >20MB (completed 2026-06-09 16:04 EDT)
- [x] **Wikidata cross-reference enrichment** — After Uruguay (`uruguay_legislation_v1`) finishes ingestion, write and run a script to link existing Source records to Wikidata Q-numbers via the Wikidata SPARQL endpoint. Scope: legislative sources first (match by title + jurisdiction), then expand. This is enrichment only — do NOT ingest Wikidata claims as HARD_FACT. See ROADMAP.md Tier 3 for context. (completed 2026-05-21 06:35 EDT)
- [x] Run dry-run for ICD-11 pipeline via `npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icd11.ts --dry-run` and report candidate count + sample records (completed 2026-05-19 00:10 EDT)
- [x] Review Pipeline 10 (Nobel Prizes) script for production-readiness: verify Nobel Foundation API endpoints are live, spot-check 3 laureates, report findings (completed 2026-05-18 23:35 EDT)
- [x] Review Pipeline 9 (SEC Edgar) script for production-readiness: verify all URLs are fetchable, spot-check 3 anchor filings against canonical SEC URLs, report findings (completed 2026-05-18 22:39 EDT)
- [x] Audit the claims list UI — check for any date fields displaying as raw ISO strings instead of human-readable format; fix any found (completed 2026-05-18 22:36 EDT)
- [x] Run dry-run for Pipeline 13 (CrossRef retractions) via `npx tsx scripts/ingest-retractions.ts --dry-run` and report candidate count + sample records (completed 2026-05-18 22:34 EDT)
- [x] Run dry-run for Pipeline 12 (USGS earthquakes M6.5+) via `npx tsx scripts/ingest-usgs-earthquakes.ts --dry-run` and report candidate count + sample records (completed 2026-05-18 22:34 EDT)
