import { NextRequest, NextResponse } from "next/server";

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Best-effort in-memory rate limiting. Vercel Edge is stateless across instances,
// so this is per-isolate — it prevents trivial hammering rather than strict global limits.

type RateLimitEntry = { count: number; windowStart: number };

// Module-level map persists within a single Edge isolate instance
const rateLimitMap = new Map<string, RateLimitEntry>();

const RATE_LIMIT_RULES: { pattern: RegExp; maxPerMin: number }[] = [
  { pattern: /^\/api\/search(\/|$|\?)/, maxPerMin: 30 },
  { pattern: /^\/api\/stats(\/|$|\?)/, maxPerMin: 20 },
  { pattern: /^\/api\/claims(\/|$|\?)/, maxPerMin: 30 },
  { pattern: /^\/api\/globe(\/|$|\?)/, maxPerMin: 20 },
];

function checkRateLimit(ip: string, pathname: string): { limited: boolean; remaining: number } {
  const rule = RATE_LIMIT_RULES.find(r => r.pattern.test(pathname));
  if (!rule) return { limited: false, remaining: -1 };

  const key = `${ip}:${pathname.split("?")[0]}`;
  const now = Date.now();
  const windowMs = 60_000;

  const entry = rateLimitMap.get(key);
  if (!entry || now - entry.windowStart > windowMs) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { limited: false, remaining: rule.maxPerMin - 1 };
  }

  entry.count += 1;
  const remaining = Math.max(0, rule.maxPerMin - entry.count);
  if (entry.count > rule.maxPerMin) {
    return { limited: true, remaining: 0 };
  }
  return { limited: false, remaining };
}

// Prune stale entries occasionally to avoid unbounded growth
let lastPrune = Date.now();
function maybePrune() {
  const now = Date.now();
  if (now - lastPrune < 120_000) return;
  lastPrune = now;
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now - entry.windowStart > 60_000) rateLimitMap.delete(key);
  }
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rate limiting — applied before auth so bots can't even reach the auth check
  maybePrune();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { limited, remaining } = checkRateLimit(ip, pathname);
  if (limited) {
    return new NextResponse("Too Many Requests", {
      status: 429,
      headers: {
        "Retry-After": "60",
        "X-RateLimit-Remaining": "0",
        "Content-Type": "text/plain",
      },
    });
  }

  const sitePassword = process.env.SITE_PASSWORD;

  // No password configured — allow everything (local dev without the var)
  if (!sitePassword) {
    const res = NextResponse.next();
    if (remaining >= 0) res.headers.set("X-RateLimit-Remaining", String(remaining));
    return res;
  }

  // Always allow the login page, login API, and bookmark API through
  if (
    pathname === "/login" ||
    pathname === "/api/login" ||
    pathname.startsWith("/api/bookmarks")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get("site_auth")?.value;
  const expected = await sha256Hex(sitePassword);

  if (cookie === expected) {
    const res = NextResponse.next();
    if (remaining >= 0) res.headers.set("X-RateLimit-Remaining", String(remaining));
    return res;
  }

  const loginUrl = req.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
