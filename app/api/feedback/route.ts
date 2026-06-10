import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

const OWNER_CHAT_ID = "7688025079";

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function notifyTelegram(body: string, email: string | null, pageContext: string | null) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return;
  const from = email ? ` (${email})` : "";
  const page = pageContext ? `\n📍 ${pageContext}` : "";
  const text = `💬 New feedback${from}${page}\n\n${body}`;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: OWNER_CHAT_ID, text }),
  }).catch(() => {});
}

export async function GET(req: NextRequest) {
  const adminToken = process.env.ADMIN_TOKEN;

  // Accept Authorization: Bearer <ADMIN_TOKEN> (for API clients)
  // or valid admin_auth cookie (for browser sessions logged in via ADMIN_TOKEN)
  const authHeader = req.headers.get("authorization");
  const adminCookie = req.cookies.get("admin_auth")?.value;
  const expectedAdmin = adminToken ? sha256Hex(adminToken) : null;

  const isAuthorized =
    (adminToken && authHeader === `Bearer ${adminToken}`) ||
    (expectedAdmin !== null && adminCookie === expectedAdmin);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rows = await prisma.feedback.findMany({
    orderBy: { submittedAt: "desc" },
  });
  return NextResponse.json(rows);
}

// In-memory rate limiter: max 5 submissions per IP per hour
const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const hits = (rateLimitMap.get(ip) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= 5) return true;
  rateLimitMap.set(ip, [...hits, now]);
  return false;
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many submissions. Try again later." }, { status: 429 });
  }

  const { body, email, pageContext } = await req.json();

  if (!body?.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Cap body length, consistent with /api/search/miss capping its query at 300 chars.
  const trimmedBody = body.trim().slice(0, 300);
  const trimmedEmail = email?.trim() || null;

  await prisma.feedback.create({
    data: {
      body: trimmedBody,
      email: trimmedEmail,
      pageContext: pageContext || null,
    },
  });

  void notifyTelegram(trimmedBody, trimmedEmail, pageContext || null);

  return NextResponse.json({ ok: true });
}
