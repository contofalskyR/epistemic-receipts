import { createHash, randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken } from "@/lib/auth";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const { email } = await req.json().catch(() => ({}));
  if (typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "valid email required" }, { status: 400 });
  }
  const normalized = email.trim().toLowerCase();
  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  // Try to attach to existing anonymous profile via bookmark cookie key if present
  const bookmarkKey = req.cookies.get("er_bookmark_key")?.value;
  let profile = await prisma.profile.findUnique({ where: { email: normalized } });

  if (!profile) {
    if (bookmarkKey) {
      const anonKeyHash = createHash("sha256").update(bookmarkKey).digest("hex");
      const anon = await prisma.profile.findUnique({ where: { key: anonKeyHash } });
      if (anon && !anon.email) {
        profile = await prisma.profile.update({
          where: { id: anon.id },
          data: { email: normalized, magicTokenHash: tokenHash, magicTokenExpiresAt: expiresAt },
        });
      }
    }
    if (!profile) {
      const newKey = createHash("sha256").update(randomBytes(32)).digest("hex");
      profile = await prisma.profile.create({
        data: { key: newKey, email: normalized, magicTokenHash: tokenHash, magicTokenExpiresAt: expiresAt },
      });
    }
  } else {
    await prisma.profile.update({
      where: { id: profile.id },
      data: { magicTokenHash: tokenHash, magicTokenExpiresAt: expiresAt },
    });
  }

  const link = `${SITE_URL}/api/auth/verify?token=${token}&email=${encodeURIComponent(normalized)}`;

  await resend.emails.send({
    from: "Epistemic Receipts <alerts@epistemic-receipts.com>",
    to: normalized,
    subject: "Sign in to Epistemic Receipts",
    html: `
      <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:32px;background:#030712;color:#e5e7eb;">
        <h2 style="color:#fff;margin-top:0;">Sign in to Epistemic Receipts</h2>
        <p>Click the link below to verify your email and manage your alerts. This link expires in 15 minutes.</p>
        <a href="${link}" style="display:inline-block;margin:24px 0;padding:10px 20px;background:#fff;color:#030712;border-radius:4px;font-weight:600;text-decoration:none;">Verify email →</a>
        <p style="color:#6b7280;font-size:12px;">If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
