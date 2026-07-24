import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isPublicRoute } from "@/lib/publicEdition";

// Regression guard for the 2026-07-24 gap audit.
//
// The public edition gates pages deny-by-default against PUBLIC_ROUTES. Nav is safe
// by construction (it filters GROUPS against the same list), but hardcoded <Link>/<a>
// hrefs in page bodies and app/layout.tsx are NOT filtered. That is how /methodology
// — footer-linked from every page, and the sole render site for B15's measured error
// rate — shipped as a guaranteed 404 on the edition we intend to publish.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app");

/** Routes intentionally absent from PUBLIC_ROUTES. Adding one here is a decision. */
const LAB_ONLY: Record<string, string> = {
  "/login": "admin auth surface; public edition has no auth",
  "/review": "admin",
  "/admin": "admin",
  "/edges": "admin-gated until designed",
  "/labs": "experimental group",
  "/account": "session-authed",
  "/alerts": "session-authed",
  "/collections": "session-authed, robots:noindex",
  "/pricing": "commercial surface dark at launch (owner call 2026-07-24)",
  "/docs": "API docs follow /pricing; flip both together",
  "/auth": "Auth.js routes",
  "/api": "not a page route",
  "/globe/lab": "explicitly denied in DENY_EXACT",
};

const labOnlyReason = (href: string): string | undefined => {
  const hit = Object.keys(LAB_ONLY).find((p) => href === p || href.startsWith(p + "/"));
  return hit ? LAB_ONLY[hit] : undefined;
};

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** The route a file renders under: app/foo/bar/page.tsx -> /foo (route groups skipped). */
function owningRoute(file: string): string {
  const segs = path.relative(APP, file).split(path.sep).slice(0, -1)
    .filter((s) => !s.startsWith("(") && !s.startsWith("_"));
  return segs.length ? "/" + segs[0] : "/";
}

// Requires a closing delimiter, and excludes `$` — a dynamic template literal
// (href={`/claims/${id}`}) has no statically-checkable target, so skip it.
const HREF_RE = /href[=:]\s*\{?\s*["'`](\/[^"'`\s{}$]*)["'`]/g;

describe("public edition: no page reachable on the public edition links to a route it 404s", () => {
  const files = walk(APP).filter((f) => isPublicRoute(owningRoute(f)));

  it("finds pages to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  const offenders: string[] = [];
  for (const file of files) {
    const src = fs.readFileSync(file, "utf8");
    for (const m of src.matchAll(HREF_RE)) {
      const href = m[1].split(/[?#]/)[0].replace(/\/$/, "") || "/";
      if (isPublicRoute(href) || labOnlyReason(href)) continue;
      offenders.push(`${path.relative(ROOT, file)} -> ${href}`);
    }
  }

  it("has no link from a public page to a non-public route", () => {
    expect(offenders).toEqual([]);
  });
});

describe("public edition: the sitemap never advertises a URL the edition 404s", () => {
  const src = fs.readFileSync(path.join(APP, "sitemap.ts"), "utf8");

  it("filters STATIC_URLS through isPublicRoute", () => {
    expect(src).toMatch(/STATIC_URLS_ALL\.filter\(/);
    expect(src).toMatch(/isPublicRoute\(/);
  });

  it("documents every static URL that the public edition will drop", () => {
    const urls = [...src.matchAll(/\$\{SITE_URL\}(\/[^`"']*)/g)]
      .map((m) => m[1].replace(/\/$/, "") || "/");
    expect(urls.length).toBeGreaterThan(10);
    const undocumented = urls.filter((u) => !isPublicRoute(u) && !labOnlyReason(u));
    expect(undocumented).toEqual([]);
  });
});

describe("public edition: routes the gap audit fixed stay fixed", () => {
  it.each(["/methodology", "/communities", "/corrections", "/terms", "/privacy"])(
    "%s is reachable on the public edition", (r) => {
      expect(isPublicRoute(r)).toBe(true);
    },
  );

  it("/methodology is reachable — it renders B15's measured error rate", () => {
    expect(isPublicRoute("/methodology")).toBe(true);
  });
});
