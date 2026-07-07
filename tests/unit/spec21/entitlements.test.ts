/**
 * Spec 21: Entitlement and tier-enforcement unit tests.
 *
 * Tests resolveEffectiveTier (past-due grace period) and tierAtLeast ordering.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockApiKeyFindUnique = vi.fn();
const mockOrgFindUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiKey: { findUnique: mockApiKeyFindUnique },
    org: { findUnique: mockOrgFindUnique },
  },
}));

vi.mock("server-only", () => ({}));

import { resolveEffectiveTier, tierAtLeast } from "@/lib/billing/entitlements";
import { PAST_DUE_GRACE_DAYS } from "@/lib/billing/stripe";

beforeEach(() => {
  vi.resetAllMocks();
});

describe("tierAtLeast", () => {
  it("free >= free", () => expect(tierAtLeast("free", "free")).toBe(true));
  it("pro >= free", () => expect(tierAtLeast("pro", "free")).toBe(true));
  it("pro >= pro", () => expect(tierAtLeast("pro", "pro")).toBe(true));
  it("pro < team", () => expect(tierAtLeast("pro", "team")).toBe(false));
  it("team >= pro", () => expect(tierAtLeast("team", "pro")).toBe(true));
  it("enterprise >= team", () => expect(tierAtLeast("enterprise", "team")).toBe(true));
  it("free < pro", () => expect(tierAtLeast("free", "pro")).toBe(false));
});

describe("resolveEffectiveTier", () => {
  it("returns free when key not found", async () => {
    mockApiKeyFindUnique.mockResolvedValue(null);
    const result = await resolveEffectiveTier("nonexistent");
    expect(result).toEqual({ effectiveTier: "free", pastDue: false });
  });

  it("returns tier as-is for free keys (no org lookup)", async () => {
    mockApiKeyFindUnique.mockResolvedValue({ tier: "free", orgId: null });
    const result = await resolveEffectiveTier("key1");
    expect(result).toEqual({ effectiveTier: "free", pastDue: false });
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });

  it("returns tier as-is for pro keys when org not past_due", async () => {
    mockApiKeyFindUnique.mockResolvedValue({ tier: "pro", orgId: "org_1" });
    mockOrgFindUnique.mockResolvedValue({ pastDueSince: null, enterpriseFlag: false, tier: "pro" });
    const result = await resolveEffectiveTier("key1");
    expect(result).toEqual({ effectiveTier: "pro", pastDue: false });
  });

  it("returns tier=pro with pastDue=true within grace period", async () => {
    const recentlyPastDue = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    mockApiKeyFindUnique.mockResolvedValue({ tier: "pro", orgId: "org_1" });
    mockOrgFindUnique.mockResolvedValue({
      pastDueSince: recentlyPastDue,
      enterpriseFlag: false,
      tier: "pro",
    });
    const result = await resolveEffectiveTier("key1");
    // Within grace: full rate limits but flagged
    expect(result.effectiveTier).toBe("pro");
    expect(result.pastDue).toBe(true);
  });

  it(`downgrades to free after ${PAST_DUE_GRACE_DAYS} days past_due`, async () => {
    const longPastDue = new Date(Date.now() - (PAST_DUE_GRACE_DAYS + 1) * 24 * 60 * 60 * 1000);
    mockApiKeyFindUnique.mockResolvedValue({ tier: "pro", orgId: "org_1" });
    mockOrgFindUnique.mockResolvedValue({
      pastDueSince: longPastDue,
      enterpriseFlag: false,
      tier: "pro",
    });
    const result = await resolveEffectiveTier("key1");
    expect(result.effectiveTier).toBe("free");
    expect(result.pastDue).toBe(true);
  });

  it("enterprise flag overrides everything (no downgrade ever)", async () => {
    const longPastDue = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    mockApiKeyFindUnique.mockResolvedValue({ tier: "enterprise", orgId: "org_1" });
    mockOrgFindUnique.mockResolvedValue({
      pastDueSince: longPastDue,
      enterpriseFlag: true,
      tier: "enterprise",
    });
    const result = await resolveEffectiveTier("key1");
    expect(result.effectiveTier).toBe("enterprise");
    expect(result.pastDue).toBe(false);
  });

  it("enterprise key without orgId returns enterprise (no org lookup)", async () => {
    mockApiKeyFindUnique.mockResolvedValue({ tier: "enterprise", orgId: null });
    const result = await resolveEffectiveTier("key1");
    expect(result).toEqual({ effectiveTier: "enterprise", pastDue: false });
    expect(mockOrgFindUnique).not.toHaveBeenCalled();
  });
});
