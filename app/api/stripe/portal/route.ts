import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

/**
 * POST /api/stripe/portal
 * Body: { orgId: string }
 * Returns a short-lived Stripe Customer Portal URL for the org.
 * Requires admin auth (middleware enforces this).
 */
export async function POST(req: NextRequest) {
  let orgId: string;
  try {
    const body = await req.json();
    orgId = body?.orgId;
    if (!orgId || typeof orgId !== "string") throw new Error("Missing orgId");
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const org = await prisma.org.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true },
  });

  if (!org?.stripeCustomerId) {
    return NextResponse.json(
      { error: "No Stripe customer found for this org" },
      { status: 404 },
    );
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://epistemic-receipts.app"}/account`,
  });

  return NextResponse.json({ url: session.url });
}
