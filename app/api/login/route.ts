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

  // In public read-only mode SITE_PASSWORD is unset; login still works for
  // ADMIN_TOKEN so the owner can reach /admin and /review.
  const sitePassword = process.env.SITE_PASSWORD;
  const adminToken = process.env.ADMIN_TOKEN;
  if (!sitePassword && !adminToken) {
    return NextResponse.json({ error: "No password configured" }, { status: 500 });
  }

  const parsed: unknown = await req.json().catch(() => null);
  const password =
    parsed && typeof parsed === "object" && typeof (parsed as { password?: unknown }).password === "string"
      ? (parsed as { password: string }).password
      : "";
  const inputHash = Buffer.from(sha256Hex(password));
  const siteHash = sitePassword ? Buffer.from(sha256Hex(sitePassword)) : null;
  const adminHash = adminToken ? Buffer.from(sha256Hex(adminToken)) : null;

  const siteMatch =
    !!siteHash &&
    inputHash.length === siteHash.length &&
    crypto.timingSafeEqual(inputHash, siteHash);
  const adminMatch =
    !!adminHash &&
    inputHash.length === adminHash.length &&
    crypto.timingSafeEqual(inputHash, adminHash);

  if (!siteMatch && !adminMatch) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, admin: adminMatch });

  // site_auth grants general site access; keyed to whichever credential matched
  const authValue = siteMatch ? siteHash!.toString() : adminHash!.toString();
  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  };
  res.cookies.set("site_auth", authValue, cookieOpts);

  // admin_auth is a separate cookie granted only with ADMIN_TOKEN.
  // Shorter-lived than the site cookie to limit exposure if it leaks.
  if (adminMatch) {
    res.cookies.set("admin_auth", adminHash!.toString(), {
      ...cookieOpts,
      maxAge: 7 * 24 * 60 * 60,
    });
  }

  return res;
}
