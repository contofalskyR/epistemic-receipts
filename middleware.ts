import { NextRequest, NextResponse } from "next/server";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function middleware(req: NextRequest) {
  const sitePassword = process.env.SITE_PASSWORD;

  // No password configured — allow everything (local dev without the var)
  if (!sitePassword) return NextResponse.next();

  const { pathname } = req.nextUrl;

  // Always allow the login page and login API through
  if (pathname === "/login" || pathname === "/api/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("site_auth")?.value;
  const expected = await sha256Hex(sitePassword);

  if (cookie === expected) return NextResponse.next();

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
