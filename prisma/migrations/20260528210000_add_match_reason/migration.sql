-- Add reason field to BookClaimMatch for LLM-powered match enrichment
ALTER TABLE "BookClaimMatch" ADD COLUMN IF NOT EXISTS "reason" TEXT;
