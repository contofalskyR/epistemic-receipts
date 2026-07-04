# Briefing 01 — Data-Layer Hardening (dup audit → unique constraint → axis sync → deploy)

## Why now

The openalex promoter loop is about to write ClaimStatusHistory rows unattended. Today the ONLY duplicate guard is the deterministic-id convention — the table has no unique constraint beyond the PK, and `ingest-auto-trajectories.ts` itself documents that its `skipDuplicates` is a no-op. Add the real guard before the loop restarts. Two smaller decisions ride along.

## Current state (verified 2026-07-03)

- `ClaimStatusHistory`: PK `id` (TEXT), no other unique constraint. Compound index `[claimId, community, occurredAt]` exists for reads.
- Rows come from four writers with different id schemes: Layer-1 baselines (cuid), `bulk-promote-corpus.ts` waves (`${claimId}-${toAxis}-${YYYY-MM-DD}`), `populate-retraction-curves.ts` (`${claimId}:retraction:0/:1`), and hand/LLM enrichment scripts (slug convention).
- **Known dup risk:** claims curved by `populate-retraction-curves.ts` (Phase A) may carry BOTH the Layer-1 baseline (`null→REVERSED` @ retraction date) AND the retraction script's Row 1 (`RECORDED→REVERSED` @ same date) — same `(claimId, toAxis, occurredAt)`, different ids. The `cleanup-dup-*` scripts in `scripts/` are precedents for how past dups were handled.
- ~205,679 wave-1 and ~18,280×2 wave-2 rows exist with `Claim.epistemicAxis` still at its pre-promotion value (`--sync-axis` was not run).
- The orderBy tiebreak patch (`[{ occurredAt: "asc" }, { createdAt: "asc" }]`) is applied in 8 app files but may not be committed/deployed: `app/page.tsx`, `app/law-settler/page.tsx`, `app/api/{trajectories,trajectories/[id],trajectories/search,history,labs/claim-diff,og/trajectory}`.

## Tasks

### 1. Duplicate audit (read-only first)

Write `scripts/audit-status-history-dups.ts` (preflight style):

```sql
SELECT "claimId", "toAxis", "occurredAt", COUNT(*) n, array_agg(id ORDER BY "createdAt") ids
FROM "ClaimStatusHistory"
GROUP BY 1,2,3 HAVING COUNT(*) > 1
```

Report count, breakdown by pipeline (`join Claim on ingestedBy`), and sample rows. Expected cluster: crossref claims with baseline+retraction-script overlap (see above). Propose a resolution policy in the report before deleting anything. Sensible default: keep the row that carries chain information (`fromAxis IS NOT NULL`) or a `sourceId`; drop the redundant cuid baseline. Deletion behind `--execute`, logged to `logs/` with the deleted rows serialized (JSONL) for rollback.

### 2. Unique constraint migration

After dups are zero:

```prisma
@@unique([claimId, toAxis, occurredAt])
```

via `prisma migrate` (name it clearly, e.g. `claim_status_history_unique_transition`). Notes:
- Run against DIRECT_URL. Creating a unique index on a multi-million-row table takes a moment; prefer a `CREATE UNIQUE INDEX CONCURRENTLY` migration (Prisma supports raw SQL migrations) to avoid locking reads.
- This also turns Layer-1's `skipDuplicates: true` from a no-op into a real guard (its own comment anticipates this).
- After migrating, re-run the fixture test in the bulk-promote style against a local Postgres to confirm waves' `ON CONFLICT (id)` still behaves (the new constraint adds a second conflict target — verify inserts that collide on it fail loudly rather than silently, and decide whether wave SQL should switch to `ON CONFLICT DO NOTHING` without a target. Document the choice.)

### 3. Axis sync (owner has approved running it — do it after 1+2)

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/bulk-promote-corpus.ts --execute --direct --sync-axis
```

This is idempotent and keyed off the deterministic promo-row ids. Before/after, capture `SELECT "epistemicAxis", COUNT(*) FROM "Claim" GROUP BY 1` and record the delta in the commit message — it will move ~200k claims RECORDED→SETTLED and site-wide stats will shift. If any dashboard/stat page hardcodes expectations, flag rather than fix (that's briefing 05 territory).

Wave 2 note: `--sync-axis` only covers wave-1 rules. Retraction claims' terminal axis is already REVERSED from ingest — verify with one query, don't assume:
`SELECT "epistemicAxis", COUNT(*) FROM "Claim" WHERE "ingestedBy"='crossref_retractions_v1' GROUP BY 1`.

### 4. Commit + deploy the orderBy patch

Verify the 8 files above are committed and deployed to Vercel before or with the axis sync. Same-date transitions render nondeterministically until this ships.

## Constraints

- No schema changes beyond the single `@@unique`. (Source/Edge metadata fields are queued separately per AGENTS.md — out of scope.)
- Dup deletion must be reversible: serialized rows to a log file first.
- Everything preflight-first, `--execute` gated, DB-verified after.

## Verification

- Dup query returns 0 rows post-cleanup; migration applies cleanly on a shadow/local DB first.
- Fixture test (embedded Postgres, pattern in the outputs of the 2026-07-03 session) passes with the new constraint in place.
- `epistemicAxis` distribution delta matches the promo-row count exactly.
- A claim page with a same-date curve renders RECORDED before SETTLED after deploy.
