import "server-only";
import Stripe from "stripe";

// Stripe client — initialized once per cold start.
// STRIPE_SECRET_KEY must be set in Vercel env (test key on staging, live key on production).
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey && process.env.NODE_ENV === "production") {
  throw new Error("STRIPE_SECRET_KEY is required in production");
}

export const stripe = new Stripe(stripeSecretKey ?? "sk_test_placeholder", {
  apiVersion: "2026-06-24.dahlia",
  typescript: true,
});

// ─── Plan config ─────────────────────────────────────────────────────────────
// Price IDs are created by scripts/stripe-setup.ts and stored in env vars.
// Never hardcode Stripe IDs in source.

export type BillingTier = "free" | "pro" | "team" | "enterprise";

export interface PlanConfig {
  name: string;
  monthlyPriceId: string | undefined; // flat monthly base price
  includedRequests: number;           // requests/month in base price (overage charged via meter)
}

// Shared overage price ID (meter-based, same for all paid tiers)
export const OVERAGE_PRICE_ID = process.env.STRIPE_PRICE_OVERAGE;
export const METER_EVENT_NAME = process.env.STRIPE_METER_EVENT_NAME ?? "api_requests_overage";

export const PLAN_CONFIG: Record<Exclude<BillingTier, "free" | "enterprise">, PlanConfig> = {
  pro: {
    name: "API Pro",
    monthlyPriceId: process.env.STRIPE_PRICE_PRO_MONTHLY,
    includedRequests: 1_000_000,
  },
  team: {
    name: "API Team",
    monthlyPriceId: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    includedRequests: 5_000_000,
  },
};

// Days past-due before enforcing free-tier rate limits
export const PAST_DUE_GRACE_DAYS = 7;
