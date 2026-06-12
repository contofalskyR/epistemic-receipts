import crypto from "node:crypto";
import { NextResponse } from "next/server";

function sha256Hex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && crypto.timingSafeEqual(ab, bb);
}

/**
 * True if the request carries admin credentials:
 *  - `Authorization: Bearer <ADMIN_TOKEN>` header (API clients / scripts), or
 *  - `admin_auth` cookie equal to sha256(ADMIN_TOKEN) (browser session via /login).
 *
 * Fails closed: returns false when ADMIN_TOKEN is not configured.
 */
export function isAdminRequest(req: Request): boolean {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && safeEqual(auth.slice(7), adminToken)) {
    return true;
  }

  const cookieHeader = req.headers.get("cookie") ?? "";
  const pair = cookieHeader
    .split(";")
    .map(c => c.trim())
    .find(c => c.startsWith("admin_auth="));
  if (!pair) return false;

  let value: string;
  try {
    value = decodeURIComponent(pair.slice("admin_auth=".length));
  } catch {
    return false;
  }
  return safeEqual(value, sha256Hex(adminToken));
}

/**
 * Guard for route handlers. Returns a 401 response when the request is not
 * an authenticated admin request, or null when it is allowed to proceed.
 *
 * Usage:
 *   const denied = requireAdmin(req);
 *   if (denied) return denied;
 */
export function requireAdmin(req: Request): NextResponse | null {
  if (isAdminRequest(req)) return null;
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/**
 * Like requireAdmin, but open during `next dev` so local editing workflows
 * keep working without an ADMIN_TOKEN configured. Always enforced in
 * production builds.
 */
export function requireAdminOrDev(req: Request): NextResponse | null {
  if (process.env.NODE_ENV === "development") return null;
  return requireAdmin(req);
}
