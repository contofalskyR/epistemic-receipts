import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { IS_PUBLIC_EDITION } from "@/lib/publicEdition";
import { SITE_URL as SITE_BASE } from "@/lib/site";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  // Email subscriptions are lab-only: er_scoped_writes has NO access to
  // "TopicSubscription"/"ClaimSubscription" (they hold email addresses — see
  // docs/runbooks/er_scoped_writes.sql). Fail closed and legibly rather than
  // 500-ing on a permission error the visitor cannot act on.
  if (IS_PUBLIC_EDITION) {
    return NextResponse.json({ error: "Not available on this edition" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = body as Record<string, unknown>;
  const email = typeof raw.email === "string" ? raw.email.trim().slice(0, 254) : "";
  // Cap lengths and strip control characters — topicLabel flows into the
  // confirmation email subject line.
  const clean = (v: unknown, max: number): string =>
    typeof v === "string"
      ? v
          .trim()
          .replace(/[\u0000-\u001f\u007f]/g, " ")
          .slice(0, max)
      : "";
  const topicKeyword = clean(raw.topicKeyword, 100);
  const topicLabel = clean(raw.topicLabel, 150);

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
