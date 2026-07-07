# Spec 10 Design Note — Ingest Harness Consolidation

_Written before any code. Maps exactly to the "Design (decided)" items in specs/10-ingest-harness.md._

---

## (a) Interfaces

### `definePipeline<Raw, Transformed>` config shape

```ts
interface PipelineConfig<Raw, Transformed> {
  tag: string                              // matches ingestedBy / PipelineRun.pipelineTag
  adapter: Adapter<Raw>
  batchSize?: number                       // defaults to 100
  rateLimitMs?: number                     // ms to sleep between fetchBatch calls; default 0
  autoApproved?: boolean                   // per-pipeline; default false
  transform: (raw: Raw) => Transformed
  validate: (t: Transformed) => { ok: true } | { ok: false; reason: string }
}
```

`definePipeline` returns the config object with its type baked in — it is a typed factory, not a class. The runner consumes it.

### Adapter interface

```ts
interface Adapter<Raw> {
  fetchBatch(cursor: string | null): Promise<{
    items: Raw[]
    nextCursor: string | null
  }>
}
```

The adapter is the **only** pipeline-specific code. It owns HTTP/CDX/CSV fetch and translates the raw API/file response into items plus the next cursor token. The runner never touches transport.

### Runner contract

```ts
// Public entrypoint — the runner
async function runPipeline(
  config: PipelineConfig<unknown, TransformedRow>,
  opts: { full?: boolean; dryRun?: boolean }
): Promise<RunResult>

interface RunResult {
  runId: string
  status: 'done' | 'error'
  rowsWritten: number
  rowsSkipped: number
  rowsRejected: number
  dbCount: number          // from post-run count query
  error?: string
}
```

**Runner lifecycle (shared, written once):**

1. Create `PipelineRun` row (`status: 'running'`, `startedAt: now()`).
2. Load latest `cursor` from prior `done` PipelineRun for this tag (resume path).
3. Loop: `adapter.fetchBatch(cursor)` → validate each item → transform → validate transformed → write batch in `prisma.$transaction(fn, { timeout: 30000 })` → idempotent upsert on `externalId` → persist cursor to `PipelineRun.cursor` **after every batch** → sleep `rateLimitMs`.
4. Fetch failures: exponential backoff, 3 attempts (delays: 2 s, 4 s, 8 s). Exhaust → `status: 'error'`.
5. Structured logging via `lib/log.ts` `makeLogger(tag)` at `batch_start`, `batch_done`, `row_skipped`, `row_rejected`, `run_complete`.
6. Post-run verification: `prisma.claim.count({ where: { ingestedBy: tag } })` compared against runner's `rowsWritten`. Mismatch → `PipelineRun.status = 'error'`, `PipelineRun.error = "count mismatch: wrote N, db has M"`.
7. Update `PipelineRun` (`status`, `finishedAt`, `rowsWritten`, `cursor`, `error`).

**Dry-run mode:** fetches one batch, runs transform + validate on each item, prints results to stdout, writes nothing (no `PipelineRun` row, no DB writes).

**Idempotent upsert:** `prisma.claim.upsert({ where: { externalId }, create: {...}, update: {} })` — update is a no-op so re-runs never clobber existing rows.

**Invariants enforced by runner:**
- `humanReviewed: false` on every claim/source/edge (hardcoded in runner write path; not overridable by pipeline config).
- `autoApproved` from pipeline config (false by default).

---

## (b) Pilot Pipeline Selections

| # | Tag | Script | Fetch Archetype | Why picked |
|---|-----|--------|----------------|------------|
| 1 | `congress_v1` | `ingest-congress.ts` | Paginated JSON API with auth key | Mandatory per spec |
| 2 | `paclii_legislation_v1` | `ingest-paclii.ts` | Wayback/CDX enumeration + Wayback fetch | PacLII is the cleaner of the two CDX-based families — uniform CDX pattern across all 8 countries, no mixed direct-scrape strategies like Caribbean |
| 3 | `doj_fara_v1` | `ingest-doj-fara.ts` | Bulk CSV download (zip) | Mandatory per spec |

**Cursor design per archetype:**

- **congress_v1**: cursor = `"CONGRESS:N:OFFSET:M"` (encodes congress number + page offset). On resume, skip congresses already completed and continue from offset M.
- **paclii_legislation_v1**: cursor = `"CC:slug-last-ingested"` (country code + last slug processed). On resume, skip fully-processed countries and continue mid-country list.
- **doj_fara_v1**: cursor = `"ROW:N"` (CSV row index). The CSV is fetched once and processed row-by-row; cursor allows resume from row N on kill.

---

## (c) Line-item mapping to "Design (decided)" items

| Spec item | How implemented |
|-----------|----------------|
| `definePipeline(config)` with `{ tag, adapter, batchSize?, rateLimitMs?, transform, validate }` | Exactly this shape in `lib/ingest/definePipeline.ts`; `autoApproved` added as the only config-level extension |
| `adapter.fetchBatch(cursor) → { items, nextCursor }` — ONLY pipeline-specific fetch code | Each pilot exports an object implementing `Adapter<Raw>`; nothing else touches HTTP/CSV in pipeline files |
| `transform(raw) → { claim, sources, edges }` — pure, unit-testable | Pure function in each `pipelines/<tag>.ts`; no Prisma/IO |
| `validate(transformed) → { ok } | { ok, reason }` — rejects rows missing externalId/empty text/out-of-range dates | Pure function in each `pipelines/<tag>.ts`; rejected rows logged + counted, never written |
| Runner: PipelineRun lifecycle (`running` → `done`/`error`), cursor persisted after every batch | `lib/ingest/runner.ts`, step 1–3 above |
| Idempotent upserts by `externalId` | `claim.upsert` with no-op `update:{}` in runner write path |
| `prisma.$transaction(fn, { timeout: 30000 })` per batch | Runner wraps each batch in a single transaction |
| Retry with exponential backoff (3 attempts) on fetch failures | Runner fetchBatch wrapper: delays 2s/4s/8s |
| Rate limiting via `rateLimitMs` between fetches | Runner sleeps `rateLimitMs` after each batch |
| Structured logs via `lib/log.ts` | Runner uses `makeLogger(tag)` throughout |
| Post-run verification: count mismatch → `error` status | Step 6 of runner lifecycle above |
| `humanReviewed: false` always | Hardcoded in runner write path, not in pipeline config |
| `autoApproved` per pipeline config | Pipeline config field; runner reads it for every write |
| CLI: `npx tsx scripts/run-pipeline.ts --tag <tag> [--full] [--dry-run]` | `scripts/run-pipeline.ts` — thin wrapper that imports registry and calls `runPipeline()` |
| HTTP: `POST /api/ingest/run {tag}` gated by `CRON_SECRET` Bearer, enqueue-and-return | `app/api/ingest/run/route.ts` — `CRON_SECRET` fail-closed check, NOT in `PUBLIC_WRITE_PATHS`, route-level `requireAdminOrDev` is NOT used (cron secret is the gate per spec); runs pipeline async and returns `{ ok: true, runId }` |
| Schedule via GitHub Actions, matrix over tags | `.github/workflows/ingest-pipeline.yml` — matrix strategy over tag list, no per-pipeline workflows |
| Pilot ports to `pipelines/<tag>.ts`; old scripts to `scripts/legacy/` | New `pipelines/` dir; old scripts moved (not deleted) per "deprecate, never delete" |
| Migration checklist | `specs/10-migration-checklist.md` |

---

## Open questions (to be recorded in PR, not resolved here)

1. **`ingest-congress.ts` has topic-management side-effects** (`ensureTopic`) that are not pure fetch/transform — these topic IDs are needed in the write path. Should the runner accept an optional `beforeRun` hook for one-time setup like topic seeding, or should topic upserts move into the transform output (`topicSlugs: string[]`) and the runner resolve them? **Blocking — spec does not specify.**

2. **PipelineRun cursor schema for `doj_fara_v1`**: The bulk CSV is re-downloaded on each run. If killed mid-CSV, the restart must re-download (the URL is stable). Is a full re-download on resume acceptable, or should the CSV be cached to a temp file? **Not blocking — will note in PR.**

3. **`POST /api/ingest/run` — "enqueue-and-return"**: The spec says enqueue-and-return but there is no queue infrastructure (no BullMQ, no Upstash). Does this mean: fire `runPipeline()` without `await` and return immediately (runs in the same serverless function, no guarantee of completion), or does it require a real queue? Pre-approved vendors include Upstash Redis. **Will note as open question in PR; implement as detached async for now.**
