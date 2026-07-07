/**
 * Spec 21: Usage reporting cron unit tests.
 *
 * Tests the double-report guard: running the cron twice for the same day
 * should only send one Meter Event to Stripe.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockApiUsageFindMany = vi.fn();
const mockApiUsageUpdateMany = vi.fn();
const mockOrgFindUnique = vi.fn();
const mockMeterEventsCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    apiUsage: {
      findMany: mockApiUsageFindMany,
      updateMany: mockApiUsageUpdateMany,
    },
    org: { findUnique: mockOrgFindUnique },
  },
}));

vi.mock("stripe", () => ({
  default: vi.fn().mockImplementation(() => ({
    billing: {
      meterEvents: { create: mockMeterEventsCreate },
    },
  })),
}));

vi.mock("server-only", () => ({}));

import { GET } from "@/app/api/cron/report-stripe-usage/route";

const CRON_SECRET = "test_secret";

function makeRequest() {
  return new NextRequest("http://localhost/api/cron/report-stripe-usage", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.STRIPE_SECRET_KEY = "sk_test_placeholder";
  process.env.STRIPE_METER_EVENT_NAME = "api_requests_overage";
});

describe("GET /api/cron/report-stripe-usage", () => {
  it("returns 401 when auth fails", async () => {
    const req = new NextRequest("http://localhost/api/cron/report-stripe-usage", {
      headers: { authorization: "Bearer wrong" },
    });
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("returns reported=0 when no un-reported rows exist", async () => {
    mockApiUsageFindMany.mockResolvedValue([]);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reported).toBe(0);
    expect(mockMeterEventsCreate).not.toHaveBeenCalled();
  });

  it("skips rows already marked reportedToStripeAt (double-run guard)", async () => {
    // Simulate: first run already marked everything
    mockApiUsageFindMany.mockResolvedValue([]); // no unreported rows
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockMeterEventsCreate).not.toHaveBeenCalled();
  });

  it("sends meter event for overage and marks rows as reported", async () => {
    const orgId = "org_1";
    const rowIds = ["row_1", "row_2"];

    // 1.5M requests on a pro plan (1M included → 500k overage)
    mockApiUsageFindMany.mockResolvedValue([
      { id: "row_1", count: 900_000, key: { orgId, tier: "pro" } },
      { id: "row_2", count: 600_000, key: { orgId, tier: "pro" } },
    ]);
    mockOrgFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      tier: "pro",
      enterpriseFlag: false,
    });
    mockMeterEventsCreate.mockResolvedValue({ identifier: `${orgId}:yesterday` });
    mockApiUsageUpdateMany.mockResolvedValue({ count: 2 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.reported).toBe(2);

    expect(mockMeterEventsCreate).toHaveBeenCalledOnce();
    const call = mockMeterEventsCreate.mock.calls[0][0];
    expect(call.payload.stripe_customer_id).toBe("cus_test");
    expect(Number(call.payload.value)).toBe(500_000); // 1.5M - 1M included

    expect(mockApiUsageUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reportedToStripeAt: expect.any(Date) } }),
    );
  });

  it("does not send meter event when usage is within included quota", async () => {
    const orgId = "org_1";

    // 500k requests on pro (1M included → 0 overage)
    mockApiUsageFindMany.mockResolvedValue([
      { id: "row_1", count: 500_000, key: { orgId, tier: "pro" } },
    ]);
    mockOrgFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_test",
      stripeSubscriptionId: "sub_test",
      tier: "pro",
      enterpriseFlag: false,
    });
    mockApiUsageUpdateMany.mockResolvedValue({ count: 1 });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    // No overage → no meter event, but row still marked reported
    expect(mockMeterEventsCreate).not.toHaveBeenCalled();
    expect(mockApiUsageUpdateMany).toHaveBeenCalled();
  });

  it("skips enterprise orgs (manual invoicing)", async () => {
    const orgId = "org_enterprise";
    mockApiUsageFindMany.mockResolvedValue([
      { id: "row_1", count: 10_000_000, key: { orgId, tier: "enterprise" } },
    ]);
    mockOrgFindUnique.mockResolvedValue({
      stripeCustomerId: "cus_enterprise",
      stripeSubscriptionId: "sub_enterprise",
      tier: "enterprise",
      enterpriseFlag: true,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    expect(mockMeterEventsCreate).not.toHaveBeenCalled();
  });
});
