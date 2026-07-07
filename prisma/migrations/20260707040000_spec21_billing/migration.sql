-- Spec 21: Billing & Metering (Stripe)
-- Additive on top of spec30 which owns the Org base table and ApiKey.orgId.

-- Org: add enterpriseFlag for manual tier-override (no Stripe subscription required)
ALTER TABLE "Org" ADD COLUMN IF NOT EXISTS "enterpriseFlag" BOOLEAN NOT NULL DEFAULT false;

-- ApiUsage: track which rows have been reported to Stripe to prevent double-reporting
ALTER TABLE "ApiUsage" ADD COLUMN IF NOT EXISTS "reportedToStripeAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ApiUsage_reportedToStripeAt_idx" ON "ApiUsage"("reportedToStripeAt");
