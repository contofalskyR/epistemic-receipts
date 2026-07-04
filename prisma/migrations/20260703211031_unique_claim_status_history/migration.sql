-- Add unique constraint on ClaimStatusHistory to prevent duplicate transitions.
-- Duplicates were cleaned (191,105 rows) before this migration.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "ClaimStatusHistory_claimId_toAxis_occurredAt_key"
  ON "ClaimStatusHistory" ("claimId", "toAxis", "occurredAt");
