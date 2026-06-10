-- Add generated tsvector column for full-text search on Claim.text
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "searchVector" tsvector GENERATED ALWAYS AS (to_tsvector('english', coalesce("text", ''))) STORED;

-- GIN index for websearch_to_tsquery / ts_rank lookups
CREATE INDEX IF NOT EXISTS "claim_search_vector_idx" ON "Claim" USING GIN ("searchVector");
