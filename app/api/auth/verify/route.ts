import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashToken, makeSessionCookie, sessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const token = searchParams.get("token");
  const email = searchParams.get("email");

  if (!token || !email) {
    return NextResponse.redirect(`${SITE_URL}/alerts/signup?error=invalid`);
  }

  const profile = await prisma.profile.findUnique({ where: { email: email.toLowerCase() } });
  if (!profile || !profile.magicTokenHash || !profile.magicTokenExpiresAt) {
    return NextResponse.redirect(`${SITE_URL}/alerts/signup?error=invalid`);
  }

  if (new Date() > profile.magicTokenExpiresAt) {
    return NextResponse.redirect(`${SITE_URL}/alerts/signup?error=expired`);
  }

  const tokenHash = hashToken(token);
  if (tokenHash !== profile.magicTokenHash) {
    return NextResponse.redirect(`${SITE_URL}/alerts/signup?error=invalid`);
  }

  await prisma.profile.update({
    where: { id: profile.id },
    data: { emailVerifiedAt: new Date(), magicTokenHash: null, magicTokenExpiresAt: null },
  });

  const cookieValue = makeSessionCookie(profile.id);
  const opts = sessionCookieOptions();
  const res = NextResponse.redirect(`${SITE_URL}/alerts`);
  res.cookies.set(opts.name, cookieValue, opts);
  return res;
}
