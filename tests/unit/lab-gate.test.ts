import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { isKnownRoute } from "@/lib/routeManifest";
import { safeRedirectPath } from "@/lib/safeRedirect";

// Front door phase 2 (STATUS.md, locked 2026-09-30): one deployment; every
// page route not on the exact public list needs the admin session and gets the
// admin gate (redirect to /login?from=…). Public [id]/[slug] pages stay open.
// `next dev` bypasses every gate, so this runs the middleware as production.

const TOKEN = "ci-test-admin-token-not-secret";
const adminCookie = createHash("sha256").update(TOKEN).digest("hex");

function req(p: string, init?: { cookie?: string; method?: string; ip?: string }): NextRequest {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  if (init?.ip) headers.set("x-forwarded-for", init.ip);
  return new NextRequest(`http://localhost${p}`, { headers, method: init?.method ?? "GET" });
}

const passedThrough = (res: Response) => res.status === 200 && res.headers.get("x-middleware-next") === "1";
/** The login redirect (307 + /login), or null. A 308 to /login is a canonical alias, not the gate. */
const gate = (res: Response) => {
  const loc = res.headers.get("location");
  return res.status === 307 && !!loc && new URL(loc).pathname === "/login" ? new URL(loc) : null;
};
/** The 308 target, or null when the response is not a canonical redirect. */
const canonical = (res: Response) => (res.status === 308 ? new URL(res.headers.get("location")!) : null);
// Must stay identical to CANONICAL_PATH in middleware.ts.
const CANONICAL_PATH = /^(?!.*\/\/)\/[A-Za-z0-9\-._~:/]*$/;
const PUBLIC_DIR = path.resolve(__dirname, "../../public");

describe("Lab gate (middleware.ts)", () => {
  beforeAll(() => {
    process.env.ADMIN_TOKEN = TOKEN;
    Object.assign(process.env, { NODE_ENV: "production" });
    delete process.env.SITE_PASSWORD;
  });
  afterAll(() => {
    Object.assign(process.env, { NODE_ENV: "test" });
    delete process.env.ADMIN_TOKEN;
  });

  it.each(["/", "/search", "/settling-curve", "/opinions", "/methodology", "/start-here"])(
    "%s (public) passes through anonymously",
    async (p) => {
      expect(passedThrough(await middleware(req(p)))).toBe(true);
    },
  );

  it.each(["/claims/cmplzmytq03hvsat0rn14mubm", "/settling-curve/h-pylori", "/topics/medicine", "/datasets/openalex_v1", "/embed/trajectory/h-pylori"])(
    "%s ([id]/[slug] page) passes through anonymously",
    async (p) => {
      expect(passedThrough(await middleware(req(p)))).toBe(true);
    },
  );

  it.each(["/history", "/fields", "/statistics", "/stats", "/analysis/settling-rate", "/globe", "/claims", "/topics", "/settling-curve/coverage", "/settling-curve/overview", "/feed", "/books"])(
    "%s (Lab) gets the admin gate anonymously",
    async (p) => {
      const g = gate(await middleware(req(p)));
      expect(g).not.toBeNull();
      expect(g!.searchParams.get("from")).toBe(p);
    },
  );

  it.each(["/no-such-page", "/docs/api", "/following", "/pricing", "/collections", "/globe/lab", "/analysis/corpus"])(
    "%s has no page file → passes through to Next's real 404, not the gate (phase 3 route manifest)",
    async (p) => {
      expect(passedThrough(await middleware(req(p)))).toBe(true);
    },
  );

  it("the gate does not leak the request's query string into /login", async () => {
    const g = gate(await middleware(req("/history?utm_source=x&token=y")));
    expect(g).not.toBeNull();
    expect([...g!.searchParams.keys()]).toEqual(["from"]);
  });

  it("/login itself stays open (no redirect loop)", async () => {
    expect(passedThrough(await middleware(req("/login")))).toBe(true);
    expect(passedThrough(await middleware(req("/login?from=%2Fhistory")))).toBe(true);
  });

  it.each(["/history", "/claims", "/settling-curve/coverage", "/admin/feedback"])(
    "%s passes with the admin cookie",
    async (p) => {
      expect(passedThrough(await middleware(req(p, { cookie: `admin_auth=${adminCookie}` })))).toBe(true);
    },
  );

  it("a wrong admin cookie is still gated", async () => {
    expect(gate(await middleware(req("/history", { cookie: "admin_auth=deadbeef" })))).not.toBeNull();
  });

  it.each(["/robots.txt", "/sitemap.xml", "/sitemap/claims-0.xml", "/favicon.ico"])(
    "%s (not a page route) is not page-gated",
    async (p) => {
      expect(passedThrough(await middleware(req(p)))).toBe(true);
    },
  );

  it.each(["/api/claims", "/api/trajectories", "/api/login"])(
    "GET %s is not page-gated (APIs keep their own gates)",
    async (p) => {
      expect(passedThrough(await middleware(req(p)))).toBe(true);
    },
  );

  it("GET /api/review still needs admin (ADMIN_PATHS)", async () => {
    expect((await middleware(req("/api/review"))).status).toBe(401);
  });

  // ── Front door phase 6 (2026-10-01): one decoded path ──────────────────────
  // nextUrl.pathname is percent-encoded, but Next routes production requests
  // on the decoded path, so /settling-curve/%63overage served a Lab page
  // anonymously, dotted Lab paths (/votes/x.y) skipped the gate, and
  // /claims/%ZZ was a bare 500.

  it.each([
    ["/settling-curve/%63overage", "/settling-curve/coverage"],
    ["/settling-curve/%6Fverview", "/settling-curve/overview"],
    ["/settling-curve/%6fverview", "/settling-curve/overview"],
    ["/datasets/%73napshots", "/datasets/snapshots"],
    ["/%68istory", "/history"],
    ["/%63laims", "/claims"],
    ["/%61dmin/feedback", "/admin/feedback"],
    ["/settling-curve%2Fcoverage", "/settling-curve/coverage"],
    ["/claims/%61bc", "/claims/abc"],
    ["/%6Cogin", "/login"],
    ["/votes/a%2Fb", "/votes/a/b"],
    ["/receipts/csh%3Atrajectory%3Ahiv-causes-aids%3A1", "/receipts/csh:trajectory:hiv-causes-aids:1"],
  ])("%s is an encoded alias → 308 %s", async (from, to) => {
    expect(canonical(await middleware(req(from)))?.pathname).toBe(to);
  });

  it("the 308 keeps the query string", async () => {
    expect(canonical(await middleware(req("/settling-curve/%6Fverview?x=1")))?.search).toBe("?x=1");
  });

  it("an alias requested with the admin cookie still gets the 308", async () => {
    const res = await middleware(req("/settling-curve/%63overage", { cookie: `admin_auth=${adminCookie}` }));
    expect(canonical(res)?.pathname).toBe("/settling-curve/coverage");
  });

  it.each(["/topics/%E2%82%AC", "/topics/caf%C3%A9", "/claims/%25", "/claims/%2541", "/claims/a%7Cb", "/claims/a%27b", "/claims/%2E%2E%2Fhistory"])(
    "%s is not canonicalised (non-ASCII, %%, a character some client re-encodes, or a dot segment) and passes",
    async (p) => {
      expect(passedThrough(await middleware(req(p)))).toBe(true);
    },
  );

  it.each(["/%2F", "/%5C", "/%2Fhistory", "/%2F%2Fevil.example", "/%5Cevil.example", "/.%2F%2Fevil.example", "/%2E%2E%2F%2Fevil.example", "/claims/a%2F/edit"])(
    "%s never yields a 308 to a path with \"//\" (protocol-relative or re-normalised) and never throws",
    async (p) => {
      expect((await middleware(req(p))).status).not.toBe(308);
    },
  );

  it("every 308 target is plain ASCII with one leading slash, and requesting it again does not redirect (no loop)", async () => {
    let redirects = 0;
    for (const shape of ["/claims/a%XXb", "/%XX", "/%XX%XXevil.example", "/history%XX", "/settling-curve/%XXoverage", "/receipts/a%XXb"]) {
      for (let b = 0; b < 256; b++) {
        const p = shape.replaceAll("%XX", "%" + b.toString(16).toUpperCase().padStart(2, "0"));
        const loc = canonical(await middleware(req(p)));
        if (!loc) continue;
        redirects++;
        expect(loc.pathname, p).toMatch(CANONICAL_PATH);
        expect((await middleware(req(loc.pathname + loc.search))).status, `${p} → ${loc.pathname}`).not.toBe(308);
      }
    }
    expect(redirects).toBeGreaterThan(300); // the sweep really exercised the redirect
  });

  it.each(["/claims/%ZZ", "/settling-curve/%E0%A4%A", "/claims/%C0%AF", "/api/claims/%ZZ"])("%s (malformed escape) → 400", async (p) => {
    expect((await middleware(req(p))).status).toBe(400);
  });

  it.each([
    "/members/%E2%82%AC",
    "/votes/%E2%82%AC%2Fb",
    "/votes/x.y",
    "/members/A.B",
    "/historical-events/a.b",
    "/fields/x.y",
    "/receipts/a.b",
    "/settling-curve/coverage%3Fx",
    "/claims/a%2F/edit",
    "/history.segments/_full.segment.rsc",
    "/settling-curve/coverage.segments/_tree.segment",
  ])("%s (a Lab page in its decoded or raw spelling, dots and prefetch segments included) is gated", async (p) => {
    expect(gate(await middleware(req(p)))).not.toBeNull();
  });

  it.each(["/votes/%E2%82%AC%2Fb", "/members/%25"])("%s: from= is the path as requested, so signing in returns to it", async (p) => {
    expect(gate(await middleware(req(p)))?.searchParams.get("from")).toBe(p);
  });

  it.each(["/members/%2F..%2F..%2F%2Fevil.example", "/votes/%5C..%5C..%5C%5Cevil.example", "/members/%25"])(
    "%s: /login's redirect back to from= stays on this origin",
    async (p) => {
      const g = gate(await middleware(req(p)));
      expect(g).not.toBeNull();
      const dest = safeRedirectPath(g!.searchParams.get("from"), "http://localhost");
      expect(new URL(dest, "http://localhost/login").origin).toBe("http://localhost");
    },
  );

  it.each([
    "/settling-curve/cdc-blood-lead-reference-value-3.5-2021",
    "/claims/a.b",
    "/claims/abc.segments/_tree.segment.rsc",
    "/geo/historical/world_100.geojson",
    "/file.svg",
    "/sitemap-index.xml",
  ])("%s (a dotted public page, a public page's segment, or a file) passes", async (p) => {
    expect(passedThrough(await middleware(req(p)))).toBe(true);
  });

  it("ADMIN_PATHS and the write gate judge the decoded spelling", async () => {
    expect((await middleware(req("/api/%72eview/claims"))).status).toBe(401);
    expect((await middleware(req("/%61pi/claims", { method: "POST" }))).status).toBe(401);
  });

  it("a public write path counts only when both spellings are that path", async () => {
    expect((await middleware(req("/api/search%2Fmiss", { method: "POST", ip: "198.51.100.7" }))).status).toBe(401);
  });

  it("no public/ file is a page route (it would be gated instead of served)", () => {
    const files: string[] = [];
    const walk = (d: string) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else files.push("/" + path.relative(PUBLIC_DIR, p).split(path.sep).join("/"));
      }
    };
    walk(PUBLIC_DIR);
    expect(files.length).toBeGreaterThan(50);
    expect(files.filter((f) => isKnownRoute(f))).toEqual([]);
  });

  // Rate-limit state is module-level: this ip is used by no other case.
  it("POST /api/search/miss is limited to 5/min per ip (the write rules precede /api/search)", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      statuses.push((await middleware(req("/api/search/miss", { method: "POST", ip: "203.0.113.9" }))).status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});

// SITE_PASSWORD (optional private mode, unset in production) gets the same
// phase 6 rules: both spellings must be on its allow-list, the request's query
// is not forwarded to /login, and from= is the path as requested.
describe("SITE_PASSWORD private mode (middleware.ts)", () => {
  const SITE = "ci-test-site-password-not-secret";
  const siteCookie = createHash("sha256").update(SITE).digest("hex");

  beforeAll(() => {
    process.env.ADMIN_TOKEN = TOKEN;
    Object.assign(process.env, { NODE_ENV: "production" });
    process.env.SITE_PASSWORD = SITE;
  });
  afterAll(() => {
    delete process.env.SITE_PASSWORD;
    Object.assign(process.env, { NODE_ENV: "test" });
    delete process.env.ADMIN_TOKEN;
  });

  it("an anonymous page request goes to /login with only from= (the query is not forwarded)", async () => {
    const g = gate(await middleware(req("/opinions?utm_source=x&token=y")));
    expect(g).not.toBeNull();
    expect([...g!.searchParams.keys()]).toEqual(["from"]);
    expect(g!.searchParams.get("from")).toBe("/opinions");
  });

  it.each(["/login", "/embed/trajectory/h-pylori", "/api/badge/x"])("%s stays open", async (p) => {
    expect(passedThrough(await middleware(req(p)))).toBe(true);
  });

  it("a path on the allow-list in only one spelling is gated", async () => {
    expect(gate(await middleware(req("/embed%2F%E2%82%AC")))).not.toBeNull();
  });

  it("the site cookie passes; an API read without it is 401", async () => {
    expect(passedThrough(await middleware(req("/opinions", { cookie: `site_auth=${siteCookie}` })))).toBe(true);
    expect((await middleware(req("/api/claims"))).status).toBe(401);
  });
});
