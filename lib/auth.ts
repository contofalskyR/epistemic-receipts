import { createHash, createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

const SESSION_SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";
const COOKIE_NAME = "er_session";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function sign(value: string): string {
  const mac = createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
  return `${value}.${mac}`;
}

function verify(signed: string): string | null {
  const last = signed.lastIndexOf(".");
  if (last === -1) return null;
  const value = signed.slice(0, last);
  const mac = signed.slice(last + 1);
  const expected = createHmac("sha256", SESSION_SECRET).update(value).digest("hex");
  try {
    if (!timingSafeEqual(Buffer.from(mac, "hex"), Buffer.from(expected, "hex"))) return null;
  } catch {
    return null;
  }
  return value;
}

export function makeSessionCookie(profileId: string): string {
  return sign(profileId);
}

export async function getSessionProfile() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  const profileId = verify(raw);
  if (!profileId) return null;
  return prisma.profile.findUnique({ where: { id: profileId } });
}

export function sessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 days
  };
}
