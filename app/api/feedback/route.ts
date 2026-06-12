import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrDev } from "@/lib/adminAuth";

const OWNER_CHAT_ID = "7688025079";

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
  // Accepts Authorization: Bearer <ADMIN_TOKEN> (API clients) or a valid
  // admin_auth cookie (browser sessions logged in via ADMIN_TOKEN).
  const denied = requireAdminOrDev(req);
  if (denied) return denied;

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

  const parsed: unknown = await req.json().catch(() => null);
  if (!parsed || typeof parsed !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { body, email, pageContext } = parsed as {
    body?: unknown;
    email?: unknown;
    pageContext?: unknown;
  };

  if (typeof body !== "string" || !body.trim()) {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }

  // Cap all field lengths, consistent with /api/search/miss capping its query at 300 chars.
  const trimmedBody = body.trim().slice(0, 300);
  const trimmedEmail =
    typeof email === "string" && email.trim() ? email.trim().slice(0, 254) : null;
  const trimmedPageContext =
    typeof pageContext === "string" && pageContext.trim()
      ? pageContext.trim().slice(0, 300)
      : null;

  await prisma.feedback.create({
    data: {
      body: trimmedBody,
      email: trimmedEmail,
      pageContext: trimmedPageContext,
    },
  });

  void notifyTelegram(trimmedBody, trimmedEmail, trimmedPageContext);

  return NextResponse.json({ ok: true });
}
