-- Add epistemicAxis field to Claim
-- RECORDED | SETTLED | CONTESTED | OPEN | UNRESOLVABLE
-- Replaces currentStatus (kept for backwards compatibility; see deprecation comment in schema)
ALTER TABLE "Claim" ADD COLUMN "epistemicAxis" TEXT;

-- Index for axis queries
CREATE INDEX "Claim_epistemicAxis_idx" ON "Claim"("epistemicAxis");
