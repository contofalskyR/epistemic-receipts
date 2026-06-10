-- Task 7: extend ClaimStatusHistory into a real trajectory model.
-- Additive only — no drops of live data. Existing table has 0 rows, so the
-- new NOT NULL columns (community, occurredAt) can be added without a backfill.

-- CreateEnum: which community ratified (or failed to ratify) a transition
CREATE TYPE "RatifyingCommunity" AS ENUM ('EXPERT_LITERATURE', 'INSTITUTIONAL', 'JUDICIAL', 'PUBLIC', 'MARKET');

-- CreateEnum: documented fact-status vocabulary, incl. failure modes
CREATE TYPE "FactStatus" AS ENUM ('RECORDED', 'SETTLED', 'CONTESTED', 'OPEN', 'UNRESOLVABLE', 'REVERSED', 'ABANDONED');

-- AlterTable: add trajectory fields
ALTER TABLE "ClaimStatusHistory"
  ADD COLUMN "community" "RatifyingCommunity" NOT NULL,
  ADD COLUMN "occurredAt" TIMESTAMP(3) NOT NULL,
  ADD COLUMN "datePrecision" TEXT;

-- Replace single-column index with the compound trajectory index
DROP INDEX IF EXISTS "ClaimStatusHistory_claimId_idx";
CREATE INDEX "ClaimStatusHistory_claimId_community_occurredAt_idx" ON "ClaimStatusHistory"("claimId", "community", "occurredAt");

-- Fix the dangling sourceId FK -> Source (the marker artifact recording the transition)
ALTER TABLE "ClaimStatusHistory"
  ADD CONSTRAINT "ClaimStatusHistory_sourceId_fkey"
  FOREIGN KEY ("sourceId") REFERENCES "Source"("id") ON DELETE SET NULL ON UPDATE CASCADE;
