# Search Runbook

Covers: re-embedding, index rebuild, cost notes, and the eval-before-ship rule.

---

## Architecture overview

```
query
  │
  ├─► tsvector (PostgreSQL full-text, searchVector column)  ─────────────► top-100
  │
  └─► vector (ClaimEmbedding, text-embedding-3-small 1536d) ─────────────► top-100
              │
              └─► HNSW cosine ANN index
                                                       │
                                                       ▼
                                              RRF fusion (k=60)
                                                       │
                                                       ▼
                                              final ranked results
```

**Model:** `text-embedding-3-small` (OpenAI, 1536 dim)  
**Index:** HNSW (m=16, ef_construction=64, cosine) on `ClaimEmbedding.embedding`  
**Table:** `ClaimEmbedding` — one row per non-deleted claim  
**Fallback index:** IVFFlat (lists=1000) if HNSW build fails on Neon plan limits  

---

## Eval-before-ship rule

**Never ship a search change without running the eval first.**

```
SEARCH_BASE=https://epistemicreceipts.com npx tsx tests/search-eval/run-eval.ts --mode all
```

Ship only if:
1. Hybrid nDCG@10 overall ≥ baseline overall
2. Hybrid nDCG@10 navigational ≥ baseline navigational (semantic search can break exact-title lookups)

Record the eval table in the PR. If the eval shows a regression, do not merge.

---

## Initial backfill

Run from your local machine (or a Hetzner VPS with DB access):

```bash
# Dry run first — confirms counts without spending money
OPENAI_API_KEY=... DATABASE_URL=... npx tsx scripts/backfill-embeddings.ts --dry-run

# Full backfill (~1M claims, est. $1 at $0.02/1M tokens)
# Set a per-run cap for safety: 50M tokens ≈ full corpus
OPENAI_API_KEY=... DATABASE_URL=... EMBEDDING_MAX_TOKENS_PER_RUN=50000000 \
  npx tsx scripts/backfill-embeddings.ts

# Resume after kill (contentHash dedup prevents duplicate spend)
OPENAI_API_KEY=... DATABASE_URL=... npx tsx scripts/backfill-embeddings.ts
```

The script outputs progress (`%`) and a summary on exit. Verify coverage:

```sql
-- Should be 0 (or very close) after full backfill
SELECT count(*) FROM "Claim" c
LEFT JOIN "ClaimEmbedding" ce ON ce."claimId" = c."id"
WHERE c."deleted" = false AND (ce."embedding" IS NULL OR ce."id" IS NULL);
```

---

## HNSW index build

Build the index **after** backfill is complete:

```bash
DATABASE_URL=... psql "$DATABASE_URL" -f prisma/migrations/20260707010000_add_embedding_hnsw_index/migration.sql
```

Or mark the migration applied in Prisma if you ran it directly:

```bash
npx prisma migrate resolve --applied 20260707010000_add_embedding_hnsw_index
```

**HNSW build time:** ~5-15 minutes for 1M rows on a Neon Pro instance.

**If the build fails (OOM on Neon free tier):**

Edit the migration file and swap HNSW for IVFFlat:

```sql
-- IVFFlat fallback (comment out HNSW block, uncomment this)
CREATE INDEX "ClaimEmbedding_embedding_ivfflat_idx"
    ON "ClaimEmbedding"
    USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 1000);
```

IVFFlat has ~20-30% lower QPS than HNSW but builds with far less RAM.
Document which index is running in this file.

**Current index type:** `HNSW` (or update here if swapped)

---

## Nightly incremental job

Runs daily at 02:00 UTC via `/api/cron/embed-incremental`.  
Covers claims updated/created in the last 25 hours.  
Kill-restart safe — contentHash dedup prevents double-spend.

Monitor in Vercel logs:
- `ok: true` — success
- `ok: false, message: "Spend guard triggered"` — hit EMBEDDING_MAX_TOKENS_PER_RUN cap
- Any error in `errors` field — check Sentry

---

## Model swap procedure

To change the embedding model (e.g., text-embedding-3-large):

1. **Write the eval baseline** with the current model before making any changes.
2. Update `MODEL_ID` and `DIMS` in `lib/embeddings.ts`.
3. **New migration** to change the vector dimension (`ALTER TABLE "ClaimEmbedding" ALTER COLUMN "embedding" TYPE vector(N)`). This requires dropping the HNSW index first:
   ```sql
   DROP INDEX "ClaimEmbedding_embedding_hnsw_idx";
   ALTER TABLE "ClaimEmbedding" ALTER COLUMN "embedding" TYPE vector(N);
   -- Then rebuild with new dims after backfill
   ```
4. Re-run the full backfill (old embeddings are dimension-incompatible — all rows get re-embedded).
5. Rebuild the HNSW index.
6. Run the eval and compare. Ship only if hybrid beats old baseline on nDCG@10.

---

## Index rebuild after bulk pipeline run

When a large pipeline adds >100k claims:

```bash
# 1. Wait for nightly incremental job to catch up (or run manually)
curl -H "Authorization: Bearer $CRON_SECRET" https://epistemicreceipts.com/api/cron/embed-incremental

# 2. If coverage drops significantly, run targeted backfill
DATABASE_URL=... OPENAI_API_KEY=... npx tsx scripts/backfill-embeddings.ts

# 3. Optionally rebuild HNSW for best recall (DROP + recreate)
# Only needed if recall metrics degrade — incremental inserts also work but slower
psql "$DATABASE_URL" -c 'DROP INDEX "ClaimEmbedding_embedding_hnsw_idx"'
psql "$DATABASE_URL" -f prisma/migrations/20260707010000_add_embedding_hnsw_index/migration.sql
```

---

## Cost notes

| Operation | Tokens | Est. cost |
|-----------|--------|-----------|
| Full 1M-claim backfill (~50 tok/claim avg) | 50M | $1.00 |
| Daily incremental (500 new claims) | 25k | $0.0005 |
| Query embedding (1 search) | ~15 | $0.0000003 |

Token estimate: `text.length / 4` (rough). Actual billing from OpenAI API.

Spend cap: set `EMBEDDING_MAX_TOKENS_PER_RUN` in Vercel env vars to hard-cap daily incremental spend. Recommended: `500000` (500k tokens ≈ $0.01/day).

---

## p95 latency benchmark

Run against staging with full backfill to measure hybrid query latency.

```bash
# 20 queries × 5 reps; requires Apache Bench or hey
hey -n 100 -c 5 "https://staging.epistemicreceipts.com/api/search?q=semaglutide&search_mode=hybrid"
```

Target: p95 < 500ms.

**Without HNSW index** (sequential scan, 1M rows):
```
# Example (to be filled in after benchmarking):
# p50: ~1800ms  p95: ~4200ms  — sequential scan confirms index is needed
```

**With HNSW index:**
```
# Example (to be filled in after benchmarking):
# p50: ~85ms  p95: ~180ms  — index provides ~23× speedup
```

Paste actual numbers here and in the PR when spec/50 is benchmarked.
