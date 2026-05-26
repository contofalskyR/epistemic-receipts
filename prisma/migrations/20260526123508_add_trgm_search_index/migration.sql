-- Enable pg_trgm extension for fast ILIKE / LIKE / trigram-similarity search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on Claim.text so /api/search ILIKE queries don't seq-scan
-- the 842K-row Claim table. Built CONCURRENTLY so it doesn't block concurrent
-- writes from ingest scripts.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_text_trgm_idx"
  ON "Claim" USING gin ("text" gin_trgm_ops);
