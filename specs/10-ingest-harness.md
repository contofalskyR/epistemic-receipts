# Spec 10 — Ingest Harness Consolidation

Phase 1 · Depends on: 00 · Model: **Opus 4.8** · Scope: ~1 week of agent sessions

## Objective
Replace the pattern of 388 bespoke tsx scripts with one shared harness so any pipeline is resumable, idempotent, monitored, and verifiable without a human watching. Do NOT rewrite all scripts — build the harness, migrate 3 pilot pipelines, leave a migration checklist.

## Design (decided — do not revisit)
New module `lib/ingest/`:

- `definePipeline(config)` where config = `{ tag, adapter, batchSize?, rateLimitMs?, transform, validate }`.
- `adapter.fetchBatch(cursor: string | null) → { items: Raw[], nextCursor: string | null }` — the ONLY pipeline-specific fetching code.
- `transform(raw) → { claim: {...}, sources: [...], edges: [...] }` — pure function, unit-testable.
- `validate(transformed) → { ok: true } | { ok: false, reason }` — rejects rows with missing externalId, empty text, out-of-range dates. Rejected rows logged, counted, never written.
- Runner responsibilities (shared, written once): PipelineRun lifecycle (create `running` → update `done`/`error`, persist `cursor` after EVERY batch so a kill at any point resumes cleanly); idempotent upserts keyed on `externalId`; `prisma.$transaction(fn, { timeout: 30000 })` per batch; retry with exponential backoff (3 attempts) on fetch failures; rate limiting via `rateLimitMs` between fetches; structured logs via `lib/log.ts`; **post-run verification** — direct count query on `ingestedBy = tag` compared against the runner's own written-counter, mismatch → PipelineRun status `error` with both numbers in `error` field.
- All harness-written rows: `autoApproved` per pipeline config, `humanReviewed: false` always (invariant).
- CLI entry: `npx tsx scripts/run-pipeline.ts --tag <tag> [--full] [--dry-run]`. `--dry-run` fetches one batch, runs transform+validate, prints results, writes NOTHING.
- HTTP entry for scheduling: `POST /api/ingest/run` `{tag}`, gated by `CRON_SECRET` Bearer (fail closed), enqueue-and-return; add to middleware knowledge as appropriate (it is NOT in PUBLIC_WRITE_PATHS — cron auth only). Schedule via GitHub Actions cron workflows (pattern already exists in `.github/workflows/ingest-loc.yml`) — one workflow, matrix over tags, NOT one workflow per pipeline.

## Pilot migrations (exactly these three — they cover the three fetch archetypes)
1. `congress_v1` (`ingest-congress.ts`) — paginated JSON API with key.
2. One Wayback/CDX-based pipeline (pick the cleanest of the Caribbean/PacLII family) — flaky-source archetype; exercises retry + resume.
3. `doj_fara_v1` (`ingest-doj-fara.ts`) — bulk CSV download archetype.

Port them to `pipelines/<tag>.ts` (new dir) using the harness. Old scripts move to `scripts/legacy/` untouched. Behavior must be identical: run against staging, diff row counts and 20 sampled records against the legacy script's output.

## Migration checklist deliverable
`specs/10-migration-checklist.md`: table of remaining active pipelines (from AGENTS.md registry + ROADMAP.md), each with fetch archetype and est. effort. Rule going forward: new pipelines MUST use the harness; legacy pipelines migrate opportunistically when they next need a re-run (the partial-run backlog — Hungary, Slovenia, Czech, Latvia, MeSH — are the natural next candidates).

## Out of scope
Rewriting >3 pipelines. Touching curated/editorial scripts (`add-*.ts`, case-study scripts). New data sources. Changing any schema.

## Acceptance criteria
- Kill-resume test: start pilot #2 `--full` on staging, `kill -9` mid-run, restart — completes with zero duplicate rows (verify: `externalId` count = distinct count) and a second PipelineRun row that resumed from persisted cursor.
- Post-run verification catches a deliberately injected counter bug (temporarily double-count in a branch, confirm status `error`, revert).
- `--dry-run` writes nothing (row counts before/after identical).
- Pilot outputs match legacy outputs (counts + 20-record spot diff pasted in PR).
- Unit tests for each pilot's `transform` + the runner's cursor/resume logic in CI.

## Verification
Paste in PR: kill-resume log + count queries, dry-run output, legacy-vs-harness diff, CI run link.
