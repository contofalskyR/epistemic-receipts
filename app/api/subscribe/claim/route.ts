import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL as SITE_BASE } from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST { email, claimId } — follow a single claim's trajectory.
 * Mirrors /api/subscribe/topic: idempotent upsert, Resend confirmation when
 * configured, unsubscribe via the shared /api/unsubscribe token endpoint.
 * Delivery: /api/cron/claim-alerts diffs ClaimStatusHistory since lastAlertAt.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().slice(0, 254) : "";
  const claimId = typeof raw.claimId === "string" ? raw.claimId.trim().slice(0, 64) : "";

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!claimId) {
    return NextResponse.json({ error: "claimId is required" }, { status: 400 });
  }

  const claim = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true, text: true } });
  if (!claim) {
    return NextResponse.json({ error: "Unknown claim" }, { status: 404 });
  }

  const sub = await prisma.claimSubscription.upsert({
    where: { email_claimId: { email, claimId } },
    create: { email, claimId },
    update: {},
  });

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
      const unsubUrl = `${SITE_BASE}/api/unsubscribe?token=${sub.unsubscribeToken}`;
      const claimUrl = `${SITE_BASE}/claims/${claim.id}`;
      await resend.emails.send({
        from,
        to: email,
        subject: "You're following a claim on Epistemic Receipts",
        text: [
          `Hi,`,
          ``,
          `You're now following this claim's trajectory:`,
          `"${claim.text.slice(0, 200)}"`,
          claimUrl,
          ``,
          `We'll email you when its status moves (a new transition lands on its settling curve).`,
          ``,
          `To unfollow at any time, visit:`,
          unsubUrl,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[subscribe/claim] Resend error:", err);
    }
  } else {
    console.log(`[subscribe/claim] No RESEND_API_KEY — skipping confirmation email for ${email} -> ${claimId}`);
  }

  return NextResponse.json({ success: true, message: "Following" });
}
