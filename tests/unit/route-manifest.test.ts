import { describe, it, expect } from "vitest";
import path from "node:path";
import { isKnownRoute, ROUTE_MANIFEST } from "@/lib/routeManifest";
import { PUBLIC_ROUTES, DENY_EXACT } from "@/lib/publicEdition";
// The generator is plain ESM so `npm run build` can run it without a TS step.
import { buildManifest } from "../../scripts/gen-route-manifest.mjs";

// Front door phase 3: middleware.ts answers unknown paths with Next's real 404
// and Lab pages with the login gate, using lib/route-manifest.json generated
// at build time from app/**/page.tsx. This guards the committed copy.

describe("route manifest", () => {
  it("is fresh — regenerate with `node scripts/gen-route-manifest.mjs`", () => {
    const fresh = buildManifest(path.resolve(__dirname, "../../app"));
    expect(ROUTE_MANIFEST.routes).toEqual(fresh.routes);
    expect(ROUTE_MANIFEST.patterns).toEqual(fresh.patterns);
  });

  it("knows every public route and every carve-out (they are real pages)", () => {
    for (const r of [...PUBLIC_ROUTES, ...DENY_EXACT]) expect(isKnownRoute(r), r).toBe(true);
  });

  it.each(["/claims/cmq4mvgxk005rsapo2iqcpl03", "/settling-curve/h-pylori", "/topics/medicine", "/claims/abc/edit", "/embed/trajectory/h-pylori", "/votes/123", "/history", "/login", "/admin/feedback"])(
    "%s is a known route",
    (p) => {
      expect(isKnownRoute(p)).toBe(true);
    },
  );

  it.each(["/no-such-page", "/claims/a/b", "/api/anything", "/embed", "/embed/trajectory", "/topics/a/b", "/history/x", "/following", "/docs/api", "/pricing", "/account", "/org/x/usage", "/auth/signin", "/collections", "/edges", "/globe/lab", "/analysis/corpus"])(
    "%s is not a route (deleted or never existed)",
    (p) => {
      expect(isKnownRoute(p)).toBe(false);
    },
  );

  it("ignores query, hash and trailing slash", () => {
    expect(isKnownRoute("/history/")).toBe(true);
    expect(isKnownRoute("/search?q=x")).toBe(true);
    expect(isKnownRoute("/methodology#deprecation")).toBe(true);
  });
});
