import { NextRequest, NextResponse } from "next/server";
import { stripe, PLAN_CONFIG, METER_EVENT_NAME } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * GET /api/cron/report-stripe-usage
 * Nightly cron: reads yesterday's ApiUsage rows and reports metered usage to Stripe
 * via the Billing Meter Events API (Stripe 2026 / dahlia API).
 *
 * Idempotency: rows with reportedToStripeAt set are skipped.
 * Run twice in a day → Stripe deduplicates via the `identifier` field.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRETE;
  if (cronSecret && req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Report for yesterday (UTC) — today's flush may still be in progress
  const yesterday = new Date();
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10);

  // Fetch un-reported usage rows where key belongs to an org
  const rows = await prisma.apiUsage.findMany({
    where: {
      date: dateStr,
      reportedToStripeAt: null,
      key: { orgId: { not: null } },
    },
    include: {
      key: {
        select: { orgId: true, tier: true },
      },
    },
  });

  if (rows.length === 0) {
    return NextResponse.json({ date: dateStr, reported: 0 });
  }

  // Aggregate total requests per org for the day
  const usageByOrg = new Map<string, { total: number; rowIds: string[] }>();
  for (const row of rows) {
    const orgId = row.key.orgId!;
    const existing = usageByOrg.get(orgId) ?? { total: 0, rowIds: [] };
    existing.total += row.count;
    existing.rowIds.push(row.id);
    usageByOrg.set(orgId, existing);
  }

  let reported = 0;
  const errors: string[] = [];

  for (const [orgId, { total, rowIds }] of usageByOrg) {
    try {
      const org = await prisma.org.findUnique({
        where: { id: orgId },
        select: {
          stripeCustomerId: true,
          stripeSubscriptionId: true,
          tier: true,
          enterpriseFlag: true,
        },
      });

      // Enterprise orgs are manually invoiced; skip free-tier (no metered price)
      if (!org?.stripeCustomerId || !org.stripeSubscriptionId || org.enterpriseFlag) {
        continue;
      }

      const tierKey = org.tier as keyof typeof PLAN_CONFIG;
      const planCfg = PLAN_CONFIG[tierKey];
      if (!planCfg) continue;

      // Overage requests = total above included threshold (floor at 0)
      const overageRequests = Math.max(0, total - planCfg.includedRequests);

      if (overageRequests > 0) {
        // Idempotency key: orgId + date — Stripe deduplicates MeterEvents within 24h
        await stripe.billing.meterEvents.create({
          event_name: METER_EVENT_NAME,
          payload: {
            stripe_customer_id: org.stripeCustomerId,
            value: String(overageRequests),
          },
          identifier: `${orgId}:${dateStr}`,
          timestamp: Math.floor(yesterday.getTime() / 1000),
        });
      }

      // Mark rows as reported (whether or not there was overage)
      await prisma.apiUsage.updateMany({
        where: { id: { in: rowIds } },
        data: { reportedToStripeAt: new Date() },
      });

      reported += rowIds.length;
    } catch (err) {
      console.error(`[report-stripe-usage] Failed for org ${orgId}:`, err);
      errors.push(orgId);
    }
  }

  return NextResponse.json({ date: dateStr, reported, errors });
}
