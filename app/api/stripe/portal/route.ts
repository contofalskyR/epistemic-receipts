import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, isOrgContext } from "@/lib/orgAuth";

export const runtime = "nodejs";

/**
 * POST /api/stripe/portal
 * Body: { orgId: string }
 * Returns a short-lived Stripe Customer Portal URL for the org.
 *
 * Auth (F4 — SECURITY-ASSESSMENT-2026-07-09 finding #5): requires a signed-in
 * session AND membership in `orgId` (401/403 otherwise). `orgId` is
 * client-controlled and the portal grants full control of the org's Stripe
 * subscription, so without the membership check any signed-in user could open
 * another org's billing portal by guessing its orgId (cross-tenant IDOR).
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

  // F4 fix: session-gate + org-membership check against the DB.
  const ctx = await requireOrgRole(orgId, "member");
  if (!isOrgContext(ctx)) return ctx; // 401 not signed in / 403 not a member

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
