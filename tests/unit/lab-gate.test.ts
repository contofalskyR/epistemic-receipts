import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createHash } from "node:crypto";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

// Front door phase 2 (STATUS.md, locked 2026-09-30): one deployment; every
// page route not on the exact public list needs the admin session and gets the
// admin gate (redirect to /login?from=…). Public [id]/[slug] pages stay open.
// `next dev` bypasses every gate, so this runs the middleware as production.

const TOKEN = "ci-test-admin-token-not-secret";
const adminCookie = createHash("sha256").update(TOKEN).digest("hex");

function req(path: string, init?: { cookie?: string }): NextRequest {
  const headers = new Headers();
  if (init?.cookie) headers.set("cookie", init.cookie);
  return new NextRequest(`http://localhost${path}`, { headers });
}

const passedThrough = (res: Response) => res.status === 200 && res.headers.get("x-middleware-next") === "1";
const gate = (res: Response) => {
  const loc = res.headers.get("location");
  return res.status >= 300 && res.status < 400 && !!loc && new URL(loc).pathname === "/login" ? new URL(loc) : null;
};

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

  it.each(["/", "/search", "/settling-curve", "/opinions", "/methodology", "/docs/api", "/start-here"])(
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

  it("an unknown path gets the gate too — deny-by-default cannot tell 'not listed' from 'does not exist'", async () => {
    expect(gate(await middleware(req("/no-such-page")))).not.toBeNull();
  });

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
    "%s (file extension) is not page-gated",
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
});
