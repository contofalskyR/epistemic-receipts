import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_BASE = "https://epistemic-receipts.vercel.app";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, topicKeyword, topicLabel } = body as Record<string, string>;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }
  if (!topicKeyword || !topicLabel) {
    return NextResponse.json({ error: "topicKeyword and topicLabel are required" }, { status: 400 });
  }

  // Upsert — idempotent if they subscribe again
  const sub = await prisma.topicSubscription.upsert({
    where: { email_topicKeyword: { email, topicKeyword } },
    create: { email, topicKeyword, topicLabel },
    update: {},
  });

  if (process.env.RESEND_API_KEY) {
    try {
      const { Resend } = await import("resend");
      const resend = new Resend(process.env.RESEND_API_KEY);
      const from = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";
      const unsubUrl = `${SITE_BASE}/api/unsubscribe?token=${sub.unsubscribeToken}`;
      await resend.emails.send({
        from,
        to: email,
        subject: `You're watching "${topicLabel}" on Epistemic Receipts`,
        text: [
          `Hi,`,
          ``,
          `You've subscribed to weekly updates for the topic "${topicLabel}" on Epistemic Receipts.`,
          ``,
          `Each week we'll email you when new claims are added to this topic.`,
          ``,
          `To unsubscribe at any time, visit:`,
          unsubUrl,
        ].join("\n"),
      });
    } catch (err) {
      console.error("[subscribe/topic] Resend error:", err);
    }
  } else {
    console.log(`[subscribe/topic] No RESEND_API_KEY — skipping confirmation email for ${email} → ${topicKeyword}`);
  }

  return NextResponse.json({ success: true, message: "Subscribed" });
}
