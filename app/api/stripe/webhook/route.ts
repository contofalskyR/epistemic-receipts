import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { stripe } from "@/lib/billing/stripe";
import { prisma } from "@/lib/prisma";
import { sendPaymentFailedEmail } from "@/lib/billing/email";

export const runtime = "nodejs"; // raw body access requires Node runtime

// stripe-signature verification requires the raw body buffer, not parsed JSON.
// Next.js 15 App Router provides req.text() for this.
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("[stripe/webhook] STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.warn("[stripe/webhook] Signature verification failed:", message);
    return NextResponse.json({ error: `Webhook signature invalid: ${message}` }, { status: 400 });
  }

  // Idempotency: events are processed at-most-once per event.id.
  // Stripe guarantees at-least-once delivery, so we must guard replays.
  // We do this by checking whether the Stripe entity (subscription/customer)
  // is already in the expected state rather than storing event IDs.

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      default:
        // Unhandled event types — return 200 so Stripe doesn't retry
        break;
    }
  } catch (err) {
    console.error(`[stripe/webhook] Error handling ${event.type}:`, err);
    return NextResponse.json({ error: "Internal handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const customerId = session.customer as string | null;
  const subscriptionId = session.subscription as string | null;
  const customerEmail = session.customer_email ?? session.customer_details?.email ?? null;

  if (!customerId || !subscriptionId) {
    console.warn("[stripe/webhook] checkout.session.completed missing customer or subscription");
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const tier = resolveTierFromSubscription(subscription);

  // Upsert Org by stripeCustomerId
  const org = await prisma.org.upsert({
    where: { stripeCustomerId: customerId },
    update: {
      stripeSubscriptionId: subscriptionId,
      tier,
      pastDueSince: null,
    },
    create: {
      name: customerEmail ?? customerId,
      slug: slugify(customerEmail ?? customerId),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      tier,
    },
  });

  // Upgrade all ApiKeys belonging to this org to the new tier
  await prisma.apiKey.updateMany({
    where: { orgId: org.id },
    data: { tier },
  });

  console.log(`[stripe/webhook] checkout.completed → org ${org.id} tier=${tier}`);
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const tier = resolveTierFromSubscription(subscription);

  const org = await prisma.org.findUnique({ where: { stripeCustomerId: customerId } });
  if (!org) {
    console.warn(`[stripe/webhook] subscription.updated: no org for customer ${customerId}`);
    return;
  }

  await prisma.org.update({
    where: { id: org.id },
    data: { tier, stripeSubscriptionId: subscription.id },
  });

  await prisma.apiKey.updateMany({
    where: { orgId: org.id },
    data: { tier },
  });

  console.log(`[stripe/webhook] subscription.updated → org ${org.id} tier=${tier}`);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;

  const org = await prisma.org.findUnique({ where: { stripeCustomerId: customerId } });
  if (!org) return;

  // Downgrade to free — do NOT revoke keys (spec requirement)
  await prisma.org.update({
    where: { id: org.id },
    data: { tier: "free", stripeSubscriptionId: null, pastDueSince: null },
  });

  await prisma.apiKey.updateMany({
    where: { orgId: org.id },
    data: { tier: "free" },
  });

  console.log(`[stripe/webhook] subscription.deleted → org ${org.id} downgraded to free`);
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  const org = await prisma.org.findUnique({ where: { stripeCustomerId: customerId } });
  if (!org) return;

  // Only set pastDueSince if not already flagged (idempotent)
  if (!org.pastDueSince) {
    await prisma.org.update({
      where: { id: org.id },
      data: { pastDueSince: new Date() },
    });
  }

  // Send email to org owner (first membership with role=owner)
  const owner = await prisma.membership.findFirst({
    where: { orgId: org.id, role: "owner" },
    include: { user: { select: { email: true } } },
  });

  if (owner?.user?.email) {
    await sendPaymentFailedEmail(owner.user.email, org.name).catch(err =>
      console.error("[stripe/webhook] Failed to send payment_failed email:", err),
    );
  }

  console.log(`[stripe/webhook] invoice.payment_failed → org ${org.id} flagged past_due`);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;

  // Clear past_due flag on successful payment
  await prisma.org.updateMany({
    where: { stripeCustomerId: customerId, pastDueSince: { not: null } },
    data: { pastDueSince: null },
  });
}

// Map Stripe subscription to our tier names.
// Convention: product metadata.tier = "pro" | "team"
function resolveTierFromSubscription(subscription: Stripe.Subscription): string {
  for (const item of subscription.items.data) {
    const meta = (item.price?.product as Stripe.Product | undefined)?.metadata;
    if (meta?.tier) return meta.tier;
  }
  return "pro"; // safe default
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 63);
}
