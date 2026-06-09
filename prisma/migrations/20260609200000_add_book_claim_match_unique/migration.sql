-- Add unique constraint on (bookClaimId, claimId) to prevent duplicate matches
ALTER TABLE "BookClaimMatch" ADD CONSTRAINT "BookClaimMatch_bookClaimId_claimId_key" UNIQUE ("bookClaimId", "claimId");
