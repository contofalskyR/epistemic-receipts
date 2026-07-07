import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe, PLAN_CONFIG, OVERAGE_PRICE_ID } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

type CheckoutPlan = "pro" | "team";

/**
 * POST /api/stripe/checkout
 * Body: { plan: "pro" | "team", orgId?: string, email?: string }
 *
 * Creates a Stripe Checkout Session for the given plan.
 * If orgId is provided, links checkout to existing org/customer.
 * On success, redirects to /account?checkout=success.
 */
export async function POST(req: NextRequest) {
  let plan: CheckoutPlan;
  let orgId: string | undefined;
  let email: string | undefined;

  try {
    const body = await req.json();
    plan = body?.plan;
    orgId = body?.orgId;
    email = body?.email;
    if (plan !== "pro" && plan !== "team") throw new Error("Invalid plan");
  } catch {
    return NextResponse.json({ error: "Invalid request body: plan must be pro or team" }, { status: 400 });
  }

  const planCfg = PLAN_CONFIG[plan];
  if (!planCfg.monthlyPriceId || !OVERAGE_PRICE_ID) {
    return NextResponse.json(
      { error: "Stripe price IDs not configured. Run scripts/stripe-setup.ts first." },
      { status: 503 },
    );
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ?? "https://epistemic-receipts.app";

  // Resolve existing Stripe customer if org already has one
  let stripeCustomerId: string | undefined;
  if (orgId) {
    const org = await prisma.org.findUnique({
      where: { id: orgId },
      select: { stripeCustomerId: true },
    });
    stripeCustomerId = org?.stripeCustomerId ?? undefined;
  }

  // Base flat price + shared meter-based overage price
  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    { price: planCfg.monthlyPriceId, quantity: 1 },
    { price: OVERAGE_PRICE_ID }, // meter-based, no quantity
  ];

  const params: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    line_items: lineItems,
    success_url: `${baseUrl}/account?checkout=success`,
    cancel_url: `${baseUrl}/pricing`,
    ...(stripeCustomerId ? { customer: stripeCustomerId } : {}),
    ...(email && !stripeCustomerId ? { customer_email: email } : {}),
    subscription_data: {
      metadata: { orgId: orgId ?? "", plan },
    },
    allow_promotion_codes: true,
  };

  const session = await stripe.checkout.sessions.create(params);
  return NextResponse.json({ url: session.url });
}
