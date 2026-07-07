/**
 * Spec 21: Webhook handler unit tests.
 *
 * Tests signature verification, idempotency, and all handled event types.
 * Uses a fake stripe.webhooks.constructEvent to avoid needing real Stripe keys.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mock stripe module ───────────────────────────────────────────────────────
const mockConstructEvent = vi.fn();
const mockOrgUpsert = vi.fn();
const mockOrgFindUnique = vi.fn();
const mockOrgUpdate = vi.fn();
const mockOrgUpdateMany = vi.fn();
const mockApiKeyUpdateMany = vi.fn();
const mockMembershipFindFirst = vi.fn();
const mockSubscriptionsRetrieve = vi.fn();
const mockSendPaymentFailedEmail = vi.fn();

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: { constructEvent: mockConstructEvent },
    subscriptions: { retrieve: mockSubscriptionsRetrieve },
  })),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    org: {
      upsert: mockOrgUpsert,
      findUnique: mockOrgFindUnique,
      update: mockOrgUpdate,
      updateMany: mockOrgUpdateMany,
    },
    apiKey: {
      updateMany: mockApiKeyUpdateMany,
    },
    membership: {
      findFirst: mockMembershipFindFirst,
    },
  },
}));

vi.mock("@/lib/billing/email", () => ({
  sendPaymentFailedEmail: mockSendPaymentFailedEmail,
}));

vi.mock("server-only", () => ({}));

// We test the route handler directly
import { POST } from "@/app/api/stripe/webhook/route";
import { NextRequest } from "next/server";

function makeRequest(body: string, sig: string): NextRequest {
  return new NextRequest("http://localhost/api/stripe/webhook", {
    method: "POST",
    headers: {
      "stripe-signature": sig,
      "content-type": "application/json",
    },
    body,
  });
}

const WEBHOOK_SECRET = "whsec_test_secret";

beforeEach(() => {
  vi.resetAllMocks();
  process.env.STRIPE_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe("POST /api/stripe/webhook", () => {
  it("returns 400 when stripe-signature header is missing", async () => {
    const req = new NextRequest("http://localhost/api/stripe/webhook", {
      method: "POST",
      body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/stripe-signature/i);
  });

  it("returns 400 when signature verification fails (tampered payload)", async () => {
    mockConstructEvent.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature for payload");
    });

    const req = makeRequest('{"tampered":"true"}', "t=123,v1=badhash");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid/i);

    // Verify no DB writes happened
    expect(mockOrgUpsert).not.toHaveBeenCalled();
    expect(mockOrgUpdate).not.toHaveBeenCalled();
    expect(mockApiKeyUpdateMany).not.toHaveBeenCalled();
  });

  it("returns 500 when STRIPE_WEBHOOK_SECRET is not set", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const req = makeRequest("{}", "t=123,v1=abc");
    const res = await POST(req);
    expect(res.status).toBe(500);
  });

  it("handles checkout.session.completed and provisions org+key", async () => {
    const customerId = "cus_test123";
    const subscriptionId = "sub_test123";

    const event = {
      type: "checkout.session.completed",
      data: {
        object: {
          customer: customerId,
          subscription: subscriptionId,
          customer_email: "test@example.com",
          customer_details: null,
        },
      },
    };

    mockConstructEvent.mockReturnValue(event);
    mockSubscriptionsRetrieve.mockResolvedValue({
      items: {
        data: [{ price: { product: { metadata: { tier: "pro" } } } }],
      },
    });
    mockOrgUpsert.mockResolvedValue({ id: "org_1", tier: "pro" });
    mockApiKeyUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest(JSON.stringify(event), "t=1,v1=valid");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockOrgUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeCustomerId: customerId },
        update: expect.objectContaining({ tier: "pro", stripeSubscriptionId: subscriptionId }),
        create: expect.objectContaining({ stripeCustomerId: customerId, tier: "pro" }),
      }),
    );
    expect(mockApiKeyUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { tier: "pro" } }),
    );
  });

  it("handles customer.subscription.deleted and downgrades to free (key not revoked)", async () => {
    const customerId = "cus_test123";
    const event = {
      type: "customer.subscription.deleted",
      data: {
        object: { customer: customerId, id: "sub_123" },
      },
    };

    mockConstructEvent.mockReturnValue(event);
    mockOrgFindUnique.mockResolvedValue({ id: "org_1" });
    mockOrgUpdate.mockResolvedValue({ id: "org_1", tier: "free" });
    mockApiKeyUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest(JSON.stringify(event), "t=1,v1=valid");
    const res = await POST(req);

    expect(res.status).toBe(200);
    // Key updated to free, NOT revokedAt set
    expect(mockApiKeyUpdateMany).toHaveBeenCalledWith({
      where: { orgId: "org_1" },
      data: { tier: "free" },
    });
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ tier: "free", stripeSubscriptionId: null }),
      }),
    );
  });

  it("handles invoice.payment_failed — flags org past_due and sends email", async () => {
    const customerId = "cus_test123";
    const event = {
      type: "invoice.payment_failed",
      data: { object: { customer: customerId } },
    };

    mockConstructEvent.mockReturnValue(event);
    mockOrgFindUnique.mockResolvedValue({ id: "org_1", pastDueSince: null });
    mockOrgUpdate.mockResolvedValue({ id: "org_1" });
    mockMembershipFindFirst.mockResolvedValue({
      user: { email: "owner@example.com" },
    });
    mockSendPaymentFailedEmail.mockResolvedValue(undefined);

    const req = makeRequest(JSON.stringify(event), "t=1,v1=valid");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockOrgUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ pastDueSince: expect.any(Date) }),
      }),
    );
    expect(mockSendPaymentFailedEmail).toHaveBeenCalledWith("owner@example.com", expect.any(String));
  });

  it("invoice.payment_failed is idempotent — does not double-flag past_due", async () => {
    const customerId = "cus_test123";
    const event = {
      type: "invoice.payment_failed",
      data: { object: { customer: customerId } },
    };

    mockConstructEvent.mockReturnValue(event);
    mockOrgFindUnique.mockResolvedValue({ id: "org_1", pastDueSince: new Date("2026-07-01") });
    mockMembershipFindFirst.mockResolvedValue({ user: { email: "owner@example.com" } });
    mockSendPaymentFailedEmail.mockResolvedValue(undefined);

    const req = makeRequest(JSON.stringify(event), "t=1,v1=valid");
    const res = await POST(req);

    expect(res.status).toBe(200);
    // pastDueSince already set — should NOT update
    expect(mockOrgUpdate).not.toHaveBeenCalled();
  });

  it("handles invoice.paid — clears past_due flag", async () => {
    const customerId = "cus_paid";
    const event = {
      type: "invoice.paid",
      data: { object: { customer: customerId } },
    };

    mockConstructEvent.mockReturnValue(event);
    mockOrgUpdateMany.mockResolvedValue({ count: 1 });

    const req = makeRequest(JSON.stringify(event), "t=1,v1=valid");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockOrgUpdateMany).toHaveBeenCalledWith({
      where: { stripeCustomerId: customerId, pastDueSince: { not: null } },
      data: { pastDueSince: null },
    });
  });

  it("returns 200 for unhandled event types without writing to DB", async () => {
    mockConstructEvent.mockReturnValue({ type: "charge.succeeded", data: { object: {} } });

    const req = makeRequest("{}", "t=1,v1=valid");
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(mockOrgUpsert).not.toHaveBeenCalled();
    expect(mockOrgUpdate).not.toHaveBeenCalled();
  });
});
