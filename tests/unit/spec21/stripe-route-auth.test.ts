/**
 * F4 (SECURITY-ASSESSMENT-2026-07-09 finding #5): /api/stripe/checkout and
 * /api/stripe/portal must require a signed-in session AND verify the session
 * user is a member of the org they're purchasing/managing billing for.
 *
 * The IDOR these tests document: both routes take a client-supplied orgId
 * (app/account/AccountClient.tsx, app/pricing/page.tsx), so without the
 * membership check user A could checkout against — or open the billing
 * portal of — org B by guessing B's orgId. Cross-tenant requests must get
 * 403 and must not create any Stripe session.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// vi.mock factories are hoisted above top-level const declarations, so mocks
// they reference must be created with vi.hoisted() to avoid a TDZ crash.
const { mockCheckoutCreate, mockPortalCreate } = vi.hoisted(() => ({
  mockCheckoutCreate: vi.fn(),
  mockPortalCreate: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    membership: { findUnique: vi.fn() },
    org: { findUnique: vi.fn() },
  },
}));

// Fake Stripe client — no keys, no network.
vi.mock("@/lib/billing/stripe", () => ({
  stripe: {
    checkout: { sessions: { create: mockCheckoutCreate } },
    billingPortal: { sessions: { create: mockPortalCreate } },
  },
  PLAN_CONFIG: {
    pro: { name: "API Pro", monthlyPriceId: "price_pro_monthly", includedRequests: 1_000_000 },
    team: { name: "API Team", monthlyPriceId: "price_team_monthly", includedRequests: 5_000_000 },
  },
  OVERAGE_PRICE_ID: "price_overage",
}));

vi.mock("server-only", () => ({}));

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST as checkoutPOST } from "@/app/api/stripe/checkout/route";
import { POST as portalPOST } from "@/app/api/stripe/portal/route";

const mockAuth = auth as ReturnType<typeof vi.fn>;
const mockMembershipFindUnique = prisma.membership.findUnique as ReturnType<typeof vi.fn>;
const mockOrgFindUnique = prisma.org.findUnique as ReturnType<typeof vi.fn>;

function post(path: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCheckoutCreate.mockResolvedValue({ url: "https://checkout.stripe.test/cs_123" });
  mockPortalCreate.mockResolvedValue({ url: "https://portal.stripe.test/bps_123" });
});

describe("POST /api/stripe/checkout — session gate", () => {
  it("returns 401 when not authenticated (no orgId — new-subscriber flow)", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await checkoutPOST(post("/api/stripe/checkout", { plan: "pro" }));
    expect(res.status).toBe(401);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated (orgId supplied)", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await checkoutPOST(post("/api/stripe/checkout", { plan: "pro", orgId: "org-B" }));
    expect(res.status).toBe(401);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });

  it("still returns 400 for an invalid plan", async () => {
    const res = await checkoutPOST(post("/api/stripe/checkout", { plan: "enterprise" }));
    expect(res.status).toBe(400);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/checkout — org membership (IDOR)", () => {
  it("returns 403 when user A supplies org B's orgId, without creating a Stripe session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    mockMembershipFindUnique.mockResolvedValue(null); // user-A has no membership in org-B

    const res = await checkoutPOST(post("/api/stripe/checkout", { plan: "pro", orgId: "org-B" }));
    expect(res.status).toBe(403);
    expect(mockCheckoutCreate).not.toHaveBeenCalled();

    // Membership was checked against the DB, keyed by BOTH the session user
    // and the client-supplied orgId — this is what closes the IDOR.
    expect(mockMembershipFindUnique).toHaveBeenCalledWith({
      where: { userId_orgId: { userId: "user-A", orgId: "org-B" } },
    });
  });

  it("creates a checkout session for a member of the org, linked to the org's Stripe customer", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    mockMembershipFindUnique.mockResolvedValue({ userId: "user-A", orgId: "org-A", role: "member" });
    mockOrgFindUnique.mockResolvedValue({ stripeCustomerId: "cus_orgA" });

    const res = await checkoutPOST(post("/api/stripe/checkout", { plan: "pro", orgId: "org-A" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.test/cs_123");
    expect(mockCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "subscription", customer: "cus_orgA" }),
    );
  });

  it("allows an authenticated user with no orgId (new-subscriber flow from /pricing)", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });

    const res = await checkoutPOST(post("/api/stripe/checkout", { plan: "team" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://checkout.stripe.test/cs_123");
    // No org targeted → no membership lookup needed
    expect(mockMembershipFindUnique).not.toHaveBeenCalled();
  });
});

describe("POST /api/stripe/portal — session gate + org membership (IDOR)", () => {
  it("returns 400 when orgId is missing", async () => {
    const res = await portalPOST(post("/api/stripe/portal", {}));
    expect(res.status).toBe(400);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns 401 when not authenticated", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await portalPOST(post("/api/stripe/portal", { orgId: "org-B" }));
    expect(res.status).toBe(401);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns 403 when user A supplies org B's orgId, without creating a portal session", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    mockMembershipFindUnique.mockResolvedValue(null); // user-A is not a member of org-B

    const res = await portalPOST(post("/api/stripe/portal", { orgId: "org-B" }));
    expect(res.status).toBe(403);
    expect(mockPortalCreate).not.toHaveBeenCalled();
    expect(mockOrgFindUnique).not.toHaveBeenCalled(); // rejected before any org data is touched

    expect(mockMembershipFindUnique).toHaveBeenCalledWith({
      where: { userId_orgId: { userId: "user-A", orgId: "org-B" } },
    });
  });

  it("returns 404 for a member whose org has no Stripe customer yet", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    mockMembershipFindUnique.mockResolvedValue({ userId: "user-A", orgId: "org-A", role: "member" });
    mockOrgFindUnique.mockResolvedValue({ stripeCustomerId: null });

    const res = await portalPOST(post("/api/stripe/portal", { orgId: "org-A" }));
    expect(res.status).toBe(404);
    expect(mockPortalCreate).not.toHaveBeenCalled();
  });

  it("returns the portal URL for a member of the org", async () => {
    mockAuth.mockResolvedValue({ user: { id: "user-A" } });
    mockMembershipFindUnique.mockResolvedValue({ userId: "user-A", orgId: "org-A", role: "member" });
    mockOrgFindUnique.mockResolvedValue({ stripeCustomerId: "cus_orgA" });

    const res = await portalPOST(post("/api/stripe/portal", { orgId: "org-A" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://portal.stripe.test/bps_123");
    expect(mockPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({ customer: "cus_orgA" }),
    );
  });
});
