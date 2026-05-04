import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

const rateLimitMap = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const hits = (rateLimitMap.get(ip) ?? []).filter(t => now - t < windowMs);
  if (hits.length >= 5) return true;
  rateLimitMap.set(ip, [...hits, now]);
  return false;
}

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json({ error: "No password configured" }, { status: 500 });
  }

  const { password } = await req.json();
  const inputHash = Buffer.from(sha256Hex(password ?? ""));
  const expectedHash = Buffer.from(sha256Hex(sitePassword));

  const match =
    inputHash.length === expectedHash.length &&
    crypto.timingSafeEqual(inputHash, expectedHash);

  if (!match) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set("site_auth", expectedHash.toString(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return res;
}
