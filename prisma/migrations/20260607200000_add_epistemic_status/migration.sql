-- Add epistemicStatus to Claim.
-- Nullable String; set by backfill-epistemic-status.ts from pipeline-native data.
-- Values: confirmed | candidate | retracted | contested | active_trial | completed_trial
--         | registered_trial | approved | settled_judgment | contested_dissent | false_positive

ALTER TABLE "Claim" ADD COLUMN "epistemicStatus" TEXT;

CREATE INDEX "Claim_epistemicStatus_idx" ON "Claim"("epistemicStatus");
