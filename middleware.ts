import { NextRequest, NextResponse } from "next/server";
import { IS_PUBLIC_EDITION, isPublicRoute } from "@/lib/publicEdition";

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Best-effort in-memory rate limiting. Vercel Edge is stateless across instances,
// so this is per-isolate — it prevents trivial hammering rather than strict global limits.

type RateLimitEntry = { count: number; windowStart: number };

// Module-level map persists within a single Edge isolate instance
const rateLimitMap = new Map<string, RateLimitEntry>();

type RateRule = { pattern: RegExp; maxPerMin: number; methods?: string[] };

const RATE_LIMIT_RULES: RateRule[] = [
  // Read endpoints — generous limits
  { pattern: /^\/api\/search(\/|$|\?)/, maxPerMin: 30 },
  { pattern: /^\/api\/v1\/search(\/|$|\?)/, maxPerMin: 20 },
  { pattern: /^\/api\/v1\/verify(\/|$|\?)/, maxPerMin: 10 },
  { pattern: /^\/api\/stats(\/|$|\?)/, maxPerMin: 20 },
  { pattern: /^\/api\/claims(\/|$|\?)/, maxPerMin: 30 },
  { pattern: /^\/api\/globe(\/|$|\?)/, maxPerMin: 20 },
  { pattern: /^\/api\/v1\/manifest(\/|$|\?)/, maxPerMin: 30 },
  // Public write endpoints — tight limits (per IP, per isolate)
  { pattern: /^\/api\/login$/, maxPerMin: 10, methods: ["POST"] },
  { pattern: /^\/api\/feedback$/, maxPerMin: 5, methods: ["POST"] },
  { pattern: /^\/api\/search\/miss$/, maxPerMin: 5, methods: ["POST"] },
  { pattern: /^\/api\/subscribe(\/|$)/, maxPerMin: 5, methods: ["POST"] },
  { pattern: /^\/api\/bookmarks(\/|$)/, maxPerMin: 30, methods: ["POST", "DELETE"] },
  { pattern: /^\/api\/sentry-tunnel$/, maxPerMin: 60, methods: ["POST"] },
];

function checkRateLimit(
  ip: string,
  pathname: string,
  method: string,
): { limited: boolean; remaining: number } {
  const rule = RATE_LIMIT_RULES.find(
    r => r.pattern.test(pathname) && (!r.methods || r.methods.includes(method)),
  );
  if (!rule) return { limited: false, remaining: -1 };

  const key = `${ip}:${method}:${pathname.split("?")[0]}`;
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

// ─── Write protection policy ─────────────────────────────────────────────────
// The site is public read-only. Any mutating API request (non-GET/HEAD/OPTIONS)
// is denied unless it is an explicitly public write endpoint or the request
// carries admin credentials. Route handlers keep their own checks (isReadOnly,
// passphrases, CRON_SECRET) as a second layer — this gate is defense in depth.

const PUBLIC_WRITE_PATHS: RegExp[] = [
  /^\/api\/login$/, // password login
  /^\/api\/feedback$/, // visitor feedback (rate limited, in-route caps)
  /^\/api\/search\/miss$/, // zero-result search reports (rate limited)
  /^\/api\/subscribe(\/|$)/, // topic email subscriptions (rate limited)
  /^\/api\/bookmarks(\/|$)/, // anonymous client-key bookmarks (rate limited)
  /^\/api\/sentry-tunnel$/, // Sentry error tunnel (browser → our proxy → Sentry)
  /^\/api\/auth(\/|$)/, // Auth.js (next-auth) sign-in/callback/signout POSTs — CSRF-protected by Auth.js
  /^\/api\/stripe\/webhook$/, // Stripe webhooks — verified in-route via stripe-signature
  /^\/api\/mcp$/, // hosted MCP endpoint — authenticated in-route via er_live_ API key
  // Session-authenticated user features (spec/30, spec/31, spec/40).
  // Every handler checks `await auth()` and object ownership itself; the
  // admin key is not the auth mechanism for these.
  /^\/api\/collections(\/|$)/, // researcher collections CRUD (session auth in-route)
  /^\/api\/alerts(\/|$)/, // topic alert subscriptions CRUD (session auth in-route)
  /^\/api\/litigation(\/|$)/, // litigation matters CRUD/export (session + org membership in-route)
];

// Pages and APIs that always require an admin session, even for reads.
// /edges (raw editing surface), /labs/* (unfinished experiments), and the
// per-claim /edit form are internal tooling — gated like /review until they
// are designed as public pages (PUBLISH-CHECKLIST.md).
const ADMIN_PATHS: RegExp[] = [
  /^\/admin(\/|$)/,
  /^\/review(\/|$)/,
  /^\/api\/review(\/|$)/,
  /^\/edges(\/|$)/,
  /^\/labs(\/|$)/,
  /^\/claims\/[^/]+\/edit(\/|$)/,
];

function isMutation(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

async function isAdminRequest(req: NextRequest): Promise<boolean> {
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;

  const expectedHash = await sha256Hex(adminToken);

  // Hash-then-compare: comparing digests neutralizes timing side channels,
  // since Edge runtime has no timingSafeEqual.
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ") && (await sha256Hex(auth.slice(7))) === expectedHash) {
    return true;
  }

  const adminCookie = req.cookies.get("admin_auth")?.value;
  return adminCookie === expectedHash;
}

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const method = req.method;
  // Auth gates are enforced in production. `next dev` keeps the local
  // editing workflow available without configuring ADMIN_TOKEN.
  const isDev = process.env.NODE_ENV === "development";

  // Rate limiting — applied before auth so bots can't even reach the auth check
  maybePrune();
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const { limited, remaining } = checkRateLimit(ip, pathname, method);
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

  // ── Public edition: deny-by-default page gate (lib/publicEdition.ts) ──
  // Active only when NEXT_PUBLIC_EDITION=public (the second Vercel project).
  // API routes keep their own gates (reads public, writes admin below);
  // paths with a file extension (robots.txt, assets) pass through.
  if (
    IS_PUBLIC_EDITION &&
    !isDev &&
    !pathname.startsWith("/api/") &&
    !pathname.includes(".") &&
    !isPublicRoute(pathname)
  ) {
    return new NextResponse("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // ── Admin-only areas (pages and APIs) ──
  if (!isDev && ADMIN_PATHS.some(p => p.test(pathname))) {
    if (!(await isAdminRequest(req))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Global write gate: mutations require admin unless explicitly public ──
  if (
    !isDev &&
    pathname.startsWith("/api/") &&
    isMutation(method) &&
    !PUBLIC_WRITE_PATHS.some(p => p.test(pathname))
  ) {
    if (!(await isAdminRequest(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Optional private mode: if SITE_PASSWORD is set, gate page reads too. ──
  // Leave SITE_PASSWORD unset in production to run the site public read-only.
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const allowedThrough =
      pathname === "/login" ||
      pathname === "/api/login" ||
      pathname.startsWith("/api/bookmarks");

    if (!allowedThrough) {
      const cookie = req.cookies.get("site_auth")?.value;
      const expectedSite = await sha256Hex(sitePassword);
      const adminToken = process.env.ADMIN_TOKEN;
      const expectedAdmin = adminToken ? await sha256Hex(adminToken) : null;

      const hasValidAuth =
        cookie === expectedSite || (expectedAdmin !== null && cookie === expectedAdmin);

      if (!hasValidAuth) {
        if (pathname.startsWith("/api/")) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const loginUrl = req.nextUrl.clone();
        loginUrl.pathname = "/login";
        loginUrl.searchParams.set("from", pathname);
        return NextResponse.redirect(loginUrl);
      }
    }
  }

  const res = NextResponse.next();
  if (remaining >= 0) res.headers.set("X-RateLimit-Remaining", String(remaining));
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon\\.ico).*)"],
};
