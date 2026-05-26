-- Homepage perf: composite indexes covering the per-claimType section query.
-- The existing (deleted, parentClaimId, claimType) index filtered but PG still
-- had to sort 100k+ rows by createdAt and re-filter by verificationStatus.
-- These two append the sort/filter columns so the planner can skip both.
--
-- Applied to the live DB via CREATE INDEX CONCURRENTLY in
-- scripts/apply-perf-indexes.ts (CONCURRENTLY cannot run inside a transaction,
-- and Prisma migrate wraps each migration in one). The statements below use
-- IF NOT EXISTS so `prisma migrate deploy` is a no-op on environments where
-- the script already ran.

CREATE INDEX IF NOT EXISTS "Claim_deleted_parentClaimId_claimType_createdAt_idx" ON "Claim"("deleted", "parentClaimId", "claimType", "createdAt");
CREATE INDEX IF NOT EXISTS "Claim_deleted_parentClaimId_claimType_verificationStatus_idx" ON "Claim"("deleted", "parentClaimId", "claimType", "verificationStatus");
