-- HNSW index on ClaimEmbedding.embedding (cosine similarity).
--
-- IMPORTANT: run this migration AFTER the backfill script completes.
-- Building HNSW on a fully-populated table is much faster and produces
-- a better-quality graph than incremental inserts into an existing index.
--
-- Parameters:
--   m=16            — max connections per layer (quality vs memory trade-off)
--   ef_construction=64 — build-time candidate list size (quality vs build speed)
--   vector_cosine_ops — cosine distance operator class (matches text-embedding-3-small)
--
-- Neon plan limits: if the build OOMs on the Neon free/launch tier,
-- fall back to the IVFFlat index below (comment out HNSW, uncomment IVFFlat).
-- IVFFlat is slower at query time (~20-30% lower QPS) but builds with much
-- less RAM (~O(lists × dim × 4 bytes) vs HNSW's O(n × m × dim × 4 bytes)).

-- Primary: HNSW (comment out if Neon plan limits block build)
CREATE INDEX "ClaimEmbedding_embedding_hnsw_idx"
    ON "ClaimEmbedding"
    USING hnsw ("embedding" vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Fallback: IVFFlat — uncomment if HNSW build fails on plan memory limits
-- lists=1000 is appropriate for ~1M vectors (rule of thumb: sqrt(n))
-- CREATE INDEX "ClaimEmbedding_embedding_ivfflat_idx"
--     ON "ClaimEmbedding"
--     USING ivfflat ("embedding" vector_cosine_ops)
--     WITH (lists = 1000);
