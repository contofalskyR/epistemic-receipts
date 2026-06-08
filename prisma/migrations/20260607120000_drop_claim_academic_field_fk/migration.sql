-- Drop vestigial Claim→AcademicField FK.
-- The column was never populated (0 claims linked). Classification travels through
-- Claim → ClaimTopic → Topic → AcademicField instead.
-- The AcademicField table and Topic.academicFieldId are preserved.

DROP INDEX IF EXISTS "Claim_academicFieldId_idx";
ALTER TABLE "Claim" DROP COLUMN IF EXISTS "academicFieldId";
