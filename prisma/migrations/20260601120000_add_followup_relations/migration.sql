-- Add followUpContext JSON column to ClaimRelation
-- This stores follow-up-specific metadata (confidence, heuristic used, notes)
-- for relation types: OUTCOME, STATUS_UPDATE, SUPERSEDED_BY, REVERSED, EXPANDED
-- Existing citation rows (cites, cited_by, related) leave this NULL.
ALTER TABLE "ClaimRelation" ADD COLUMN IF NOT EXISTS "followUpContext" JSONB;

-- Index for the UI query: "what follows this claim" (toClaimId + relationType filter)
DO $$ BEGIN
  CREATE INDEX "ClaimRelation_toClaimId_relationType_idx" ON "ClaimRelation"("toClaimId", "relationType");
EXCEPTION WHEN duplicate_table THEN NULL; END $$;
