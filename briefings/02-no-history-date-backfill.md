# Briefing 02 — Fold the No-History Claims into Layer 1 (date backfill)

## The problem

363,607 claims (count from the 2026-07-03 briefing; re-verify) have NO ClaimStatusHistory rows at all. They are invisible to the settling-curve product and to every completeness number in `lib/corpus-completeness.ts` / `scripts/corpus-completeness-report.ts`.

Root cause (verified in source): `ingest-auto-trajectories.ts` requires `claimEmergedAt: { not: null }` — claims without an emergence date never got a baseline row. This is correct behavior (never fabricate dates); the fix is to backfill real dates where they exist, then let Layer 1 rescan.

## Current state

- Layer-1's cursor mechanism already handles the rescan: when a pipeline drains, its cursor resets to null and the next run rescans from the start, catching claims updated in place. So the pipeline is: backfill dates → run `ingest-auto-trajectories.ts` → done. No Layer-1 changes needed.
- Date-backfill precedents exist in `scripts/`: `backfill-openalex-dates.ts`, `backfill-chebi-dates.ts`, `backfill-claim-dates*.sh`, and (best recent pattern) `backfill-retraction-pub-dates.ts` — CrossRef sweep, indexed `externalId` matching, batched `UPDATE ... FROM (VALUES ...)`, dry-run default.

## Tasks

### 1. Preflight: where are the dateless claims?

Read-only script or extension of `corpus-completeness-report.ts`:

```sql
SELECT c."ingestedBy", COUNT(*) FILTER (WHERE c."claimEmergedAt" IS NULL)::int AS dateless, COUNT(*)::int AS total
FROM "Claim" c
LEFT JOIN "ClaimStatusHistory" h ON h."claimId" = c.id
WHERE c.deleted = false AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED' AND h.id IS NULL
GROUP BY 1 ORDER BY 2 DESC
```

Also sample each top pipeline's `metadata` (jsonb_object_keys + a few rows) for date-bearing fields. Deliver the table before writing any backfill.

### 2. Per-pipeline date backfills, biggest first

For each top pipeline, in order of dateless count:
- **Metadata already has a date** → one batched UPDATE, `claimEmergedPrecision` set honestly (DAY/MONTH/YEAR by what the field contains). Follow the `backfill-retraction-pub-dates.ts` UPDATE pattern.
- **Source API has the date** (e.g. NARA catalog, OpenAlex works) → sweep script in the `backfill-retraction-pub-dates.ts` style: bulk/cursor fetch, map by externalId, batched UPDATE. Respect rate-limit notes in AGENTS.md if the API is listed there.
- **No source available** → leave NULL and report. These stay history-less on purpose.

One script per pipeline family, dry-run default, `--execute` gated, DB-verified counts after.

### 3. Re-run Layer 1

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-auto-trajectories.ts [--pipeline <tag>] [--dry-run]
```

Dry-run first per pipeline; confirm projected adds ≈ newly-dated claims. NOTE from that script's header: run with full type-check where possible; also note any pipeline that got dates but has NO Layer-1 template — add the template (with an honest toAxis per the born-settled/born-recorded logic in `lib/corpus-completeness.ts`) AND add the pipeline to the classification, or the completeness report will flag it UNCLASSIFIED.

### 4. Refresh the numbers

Run `scripts/corpus-completeness-report.ts` and update the counts in `CORPUS-PROMOTER-BULK-PLAN.md` §3 (and anywhere the 790,611 / 363,607 figures were recorded). Single source of truth discipline: derive, don't hand-edit twice.

## Constraints

- NEVER guess a date. Ambiguous metadata (e.g. a bare "date" field of unknown semantics) → investigate the ingester source first; if still ambiguous, skip.
- New baselines are Layer 1's job — do not insert ClaimStatusHistory rows directly from the backfill scripts.
- If briefing 01's unique constraint has landed, Layer-1 rescans are double-guarded; if not, rely on its baseline guard as-is.

## Verification

- Post-run: no-history count per pipeline drops by exactly the number of claims that received dates (query, don't trust logs).
- Spot-check 5 claims per backfilled pipeline: `claimEmergedAt` matches the source record (fetch the canonical URL).
- Completeness report shows no new UNCLASSIFIED pipelines.
