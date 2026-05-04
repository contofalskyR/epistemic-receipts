import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
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

  await prisma.feedback.create({
    data: {
      body: body.trim(),
      email: email?.trim() || null,
      pageContext: pageContext || null,
    },
  });

  return NextResponse.json({ ok: true });
}
