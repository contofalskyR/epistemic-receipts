# Epistemic Receipts — Task Queue

The autonomous worker picks the **first unchecked item** every 5 hours and works it.
Add tasks here anytime. Robert reviews commits; never auto-pushes.

---

## Queue

### Stage 1 — P0 security (remaining)
- [ ] Redact Neon pooler hostname from `AUDIT-2026-05-21.md`

### Stage 2 — P1 data model: relations + constraints
- [ ] Uppercase all lowercase `ClaimRelation.relationType` values in DB + update query sites
- [ ] Add `@@unique([bookClaimId, claimId])` to BookClaimMatch in schema + dedupe existing rows + migrate
- [ ] Fix duplicate migration timestamp: rename `20260608000000_add_watched_topic` to `20260608010000_add_watched_topic`, then `prisma migrate resolve --applied`

### Stage 3 — P1 data model: freshness infrastructure
- [ ] Add `PipelineRun` model (pipelineTag, startedAt, finishedAt, rowsWritten, cursor, status, error) to Prisma schema + migrate
- [ ] Add `ClaimStatusHistory` model (claimId, fromAxis, toAxis, reason, sourceId, createdAt) to Prisma schema + migrate

### Stage 4 — P1 docs & repo hygiene
- [ ] Build `scripts/sync-registry.ts` to auto-generate AGENTS.md pipeline registry table from `GROUP BY "ingestedBy"` query
- [ ] `git rm --cached` all ~150 log/dry-run files at root, add patterns to `.gitignore`
- [ ] Rewrite `README.md` — replace stock create-next-app with project description (use investor memo §2 as base)

### Stage 5 — P1 CI quality gate
- [ ] Add GitHub Actions workflow: `tsc --noEmit` + `eslint` + gitleaks on PR

### Stage 6 — P2 book pipeline fixes
- [ ] Replace `claude --print` shell-outs in `match-book-to-graph.ts` with `@anthropic-ai/sdk` + pin `claude-haiku-4-5-20251001`
- [ ] Fix silent judge failures: resolve `{error: true}` not `[]` on exec error/parse failure, increment error counter

### Stage 7 — P2 search + integrity
- [ ] Add generated tsvector column + GIN index to Claim, query with `websearch_to_tsquery` + `ts_rank`
- [ ] Build data integrity invariant checks script (source URL coverage, orphaned edges, status vocabulary, dupes) + schedule as nightly cron

### Blocked — needs Robert
- [ ] ⏸ Collapse 4 status fields → `epistemicAxis` only (needs Robert's 4-way vs 5-way decision)
- [ ] ⏸ Rotate NYT + Azure keys at provider dashboards
- [ ] ⏸ Set CRON_SECRET, TELEGRAM_CHAT_ID, NYT_API_KEY, COLOMBIA_SEARCH_KEY in Vercel env vars

---

## Completed

<!-- Worker appends completed tasks here with date -->
- [x] Gate `app/api/books/upload/route.ts` and `app/api/books/[bookId]/ingest/route.ts` with `isReadOnly()` check + reject uploads >20MB (completed 2026-06-09 16:04 EDT)
- [x] **Wikidata cross-reference enrichment** — After Uruguay (`uruguay_legislation_v1`) finishes ingestion, write and run a script to link existing Source records to Wikidata Q-numbers via the Wikidata SPARQL endpoint. Scope: legislative sources first (match by title + jurisdiction), then expand. This is enrichment only — do NOT ingest Wikidata claims as HARD_FACT. See ROADMAP.md Tier 3 for context. (completed 2026-05-21 06:35 EDT)
- [x] Run dry-run for ICD-11 pipeline via `npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-icd11.ts --dry-run` and report candidate count + sample records (completed 2026-05-19 00:10 EDT)
- [x] Review Pipeline 10 (Nobel Prizes) script for production-readiness: verify Nobel Foundation API endpoints are live, spot-check 3 laureates, report findings (completed 2026-05-18 23:35 EDT)
- [x] Review Pipeline 9 (SEC Edgar) script for production-readiness: verify all URLs are fetchable, spot-check 3 anchor filings against canonical SEC URLs, report findings (completed 2026-05-18 22:39 EDT)
- [x] Audit the claims list UI — check for any date fields displaying as raw ISO strings instead of human-readable format; fix any found (completed 2026-05-18 22:36 EDT)
- [x] Run dry-run for Pipeline 13 (CrossRef retractions) via `npx tsx scripts/ingest-retractions.ts --dry-run` and report candidate count + sample records (completed 2026-05-18 22:34 EDT)
- [x] Run dry-run for Pipeline 12 (USGS earthquakes M6.5+) via `npx tsx scripts/ingest-usgs-earthquakes.ts --dry-run` and report candidate count + sample records (completed 2026-05-18 22:34 EDT)
