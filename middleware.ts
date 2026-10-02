import { NextRequest, NextResponse } from "next/server";
import { isPublicRoute } from "@/lib/publicEdition";
import { isKnownRoute } from "@/lib/routeManifest";

// ─── Rate limiting ────────────────────────────────────────────────────────────
// Best-effort in-memory rate limiting. Vercel Edge is stateless across instances,
// so this is per-isolate — it prevents trivial hammering rather than strict global limits.

type RateLimitEntry = { count: number; windowStart: number };

// Module-level map persists within a single Edge isolate instance
const rateLimitMap = new Map<string, RateLimitEntry>();

type RateRule = { pattern: RegExp; maxPerMin: number; methods?: string[] };

// checkRateLimit takes the FIRST matching rule, so the exact write rules come
// before the broad read prefixes — /api/search used to give
// POST /api/search/miss 30/min instead of its 5 (front door phase 6).
const RATE_LIMIT_RULES: RateRule[] = [
  // Public write endpoints — tight limits (per IP, per isolate)
  { pattern: /^\/api\/login$/, maxPerMin: 10, methods: ["POST"] },
  { pattern: /^\/api\/feedback$/, maxPerMin: 5, methods: ["POST"] },
  { pattern: /^\/api\/search\/miss$/, maxPerMin: 5, methods: ["POST"] },
  // Read endpoints — generous limits
  { pattern: /^\/api\/search(\/|$|\?)/, maxPerMin: 30 },
  { pattern: /^\/api\/stats(\/|$|\?)/, maxPerMin: 20 },
  { pattern: /^\/api\/claims(\/|$|\?)/, maxPerMin: 30 },
  { pattern: /^\/api\/globe(\/|$|\?)/, maxPerMin: 20 },
  // Server-side fetch proxy — tighter, since each call makes an outbound fetch
  { pattern: /^\/api\/proxy\/reader/, maxPerMin: 20 },
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
];

// Pages and APIs that always require an admin session, even for reads.
// The Lab gate above already covers every non-public page; this list is the
// API side (/api/review) plus the page paths kept for defense in depth.
const ADMIN_PATHS: RegExp[] = [
  /^\/admin(\/|$)/,
  /^\/review(\/|$)/,
  /^\/api\/review(\/|$)/,
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

// ─── Path spellings ───────────────────────────────────────────────────────────
// req.nextUrl.pathname is still percent-encoded, while Next routes production
// requests on the decoded path (router-utils/filesystem.js "check decoded
// variant") and matches [id] segments on the raw one. So every gate below is
// judged on BOTH spellings: a request passes a gate only if both do
// (front door phase 6 — /settling-curve/%63overage served a Lab page).

/** The request path decoded once, or null for a malformed escape (%ZZ, bad UTF-8). */
function decodePath(raw: string): string | null {
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}

// A decoded path we 308 to: a leading "/" and no "//" anywhere (never a
// protocol-relative Location, nothing Next would normalise again, and new
// URL() below cannot throw), and only RFC 3986 unreserved characters, "/" and
// ":" — characters no browser or proxy re-encodes, so the redirect cannot
// loop (Chromium re-encodes "|", for one).
const CANONICAL_PATH = /^(?!.*\/\/)\/[A-Za-z0-9\-._~:/]*$/;

/** A page's prefetch segment files (/history.segments/_full.segment[.rsc]) are
 *  judged as the page itself. */
const pagePath = (p: string) => p.replace(/\.segments\/.*$/, "").replace(/\.rsc$/, "");

// ─── Middleware ───────────────────────────────────────────────────────────────

export async function middleware(req: NextRequest) {
  const rawPath = req.nextUrl.pathname;
  const pathname = decodePath(rawPath);
  if (pathname === null) {
    return new NextResponse("Bad Request", { status: 400, headers: { "Content-Type": "text/plain" } });
  }
  const spellings = pathname === rawPath ? [pathname] : [pathname, rawPath];
  const method = req.method;
  // Auth gates are enforced in production. `next dev` keeps the local
  // editing workflow available without configuring ADMIN_TOKEN.
  const isDev = process.env.NODE_ENV === "development";

  // One URL per page: an encoded ASCII alias (/%68istory,
  // /settling-curve/%63overage) gets a 308 to its decoded spelling — admins
  // too, so an alias never renders (or writes an ISR entry for) a page under a
  // second URL. /api/ is left alone. The target must be exactly the path it
  // names: dot segments resolve ("/.//evil.example" would become the
  // protocol-relative "//evil.example"), so those, "//", "%" and non-ASCII
  // never redirect.
  if (
    pathname !== rawPath &&
    !pathname.startsWith("/api/") &&
    CANONICAL_PATH.test(pathname) &&
    new URL(pathname, req.nextUrl.origin).pathname === pathname
  ) {
    const url = req.nextUrl.clone();
    url.pathname = pathname;
    return NextResponse.redirect(url, 308);
  }

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

  // ── The Lab gate: deny-by-default page routes (lib/publicEdition.ts) ──
  // One deployment (STATUS.md, locked 2026-09-30): every page route that is
  // not on the exact public list needs the admin session and gets the same
  // gate as /admin — a redirect to /login?from=…. /login itself stays open so
  // the owner can sign in; API routes keep their own gates (reads public,
  // writes admin below). A page is whatever lib/routeManifest.ts (generated
  // from app/**/page.tsx at build time) knows, dots or not — /votes/x.y is a
  // page. Files and metadata routes (robots.txt, sitemap.xml, public/) are not
  // in it and pass through, and so does a path with no page file at all, to
  // Next's real 404 — the gate is for Lab pages, not for typos. from= carries
  // the path as requested, so signing in returns to the same URL.
  const isLabPage = (p: string) => p !== "/login" && isKnownRoute(p) && !isPublicRoute(p);
  if (!isDev && !pathname.startsWith("/api/") && spellings.some(p => isLabPage(pagePath(p)))) {
    if (!(await isAdminRequest(req))) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("from", rawPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Admin-only areas (pages and APIs) ──
  if (!isDev && spellings.some(s => ADMIN_PATHS.some(p => p.test(s)))) {
    if (!(await isAdminRequest(req))) {
      if (pathname.startsWith("/api/")) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/login";
      loginUrl.search = "";
      loginUrl.searchParams.set("from", rawPath);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── Global write gate: mutations require admin unless explicitly public ──
  if (
    !isDev &&
    pathname.startsWith("/api/") &&
    isMutation(method) &&
    !spellings.every(s => PUBLIC_WRITE_PATHS.some(p => p.test(s)))
  ) {
    if (!(await isAdminRequest(req))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  // ── Optional private mode: if SITE_PASSWORD is set, gate page reads too. ──
  // Leave SITE_PASSWORD unset in production to run the site public read-only.
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword) {
    const allowedThrough = spellings.every(
      p => p === "/login" || p === "/api/login" || p.startsWith("/embed/") || p.startsWith("/api/badge/"),
    );

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
        loginUrl.search = "";
        loginUrl.searchParams.set("from", rawPath);
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
