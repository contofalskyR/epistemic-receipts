-- Compound index for the hourly trajectory anti-join query
-- (WHERE ingestedBy = ? AND id > ? AND NOT EXISTS (...)) so it uses a
-- single index scan instead of two separate ones.
CREATE INDEX IF NOT EXISTS "Claim_ingestedBy_id_idx" ON "Claim"("ingestedBy", "id");
