import "server-only";
import { prisma } from "@/lib/prisma";
import { type BillingTier, PAST_DUE_GRACE_DAYS } from "./stripe";

export interface EntitlementResult {
  effectiveTier: BillingTier;
  pastDue: boolean;
}

/**
 * Resolve the effective billing tier for an ApiKey, accounting for past-due
 * enforcement (downgrade to free after PAST_DUE_GRACE_DAYS).
 *
 * Returns the tier to use for rate-limit checks — callers should pass this
 * to checkRateLimit instead of the raw ApiKey.tier.
 */
export async function resolveEffectiveTier(keyId: string): Promise<EntitlementResult> {
  const key = await prisma.apiKey.findUnique({
    where: { id: keyId },
    select: { tier: true, orgId: true },
  });

  if (!key) return { effectiveTier: "free", pastDue: false };

  const tier = key.tier as BillingTier;

  if (!key.orgId || tier === "free" || tier === "enterprise") {
    return { effectiveTier: tier, pastDue: false };
  }

  const org = await prisma.org.findUnique({
    where: { id: key.orgId },
    select: { pastDueSince: true, enterpriseFlag: true, tier: true },
  });

  if (!org) return { effectiveTier: tier, pastDue: false };
  if (org.enterpriseFlag) return { effectiveTier: "enterprise", pastDue: false };

  if (org.pastDueSince) {
    const daysPastDue =
      (Date.now() - org.pastDueSince.getTime()) / (1000 * 60 * 60 * 24);
    if (daysPastDue > PAST_DUE_GRACE_DAYS) {
      return { effectiveTier: "free", pastDue: true };
    }
    return { effectiveTier: tier, pastDue: true };
  }

  return { effectiveTier: tier, pastDue: false };
}

/**
 * Check that the key's effective tier is at least `required`.
 * Returns true if access is granted.
 */
export function tierAtLeast(effective: BillingTier, required: BillingTier): boolean {
  const ORDER: BillingTier[] = ["free", "pro", "team", "enterprise"];
  return ORDER.indexOf(effective) >= ORDER.indexOf(required);
}
