-- Add a generated tsvector column on Claim.text for full-text search ranking.
-- The existing trgm GIN index stays as a fuzzy fallback.

-- 1. Add generated column
ALTER TABLE "Claim"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (to_tsvector('english', coalesce("text", ''))) STORED;

-- 2. GIN index for ts_rank / websearch_to_tsquery lookups
CREATE INDEX "Claim_searchVector_idx" ON "Claim" USING gin ("searchVector");
