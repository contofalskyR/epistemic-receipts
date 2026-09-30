import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isPublicRoute, PUBLIC_ROUTES, DENY_EXACT } from "@/lib/publicEdition";

// Regression guard for the 2026-07-24 gap audit, extended for front door
// phase 2 (2026-09-30): one deployment, page routes deny-by-default against
// an EXACT public list (lib/publicEdition.ts), Lab behind the admin session.
//
// Nav is safe by construction (the ⚗ Lab group renders only for the admin
// session and filters itself through isPublicRoute), but hardcoded <Link>/<a>
// hrefs in page bodies and app/layout.tsx are NOT filtered. A public page
// linking into the Lab sends an anonymous visitor to the login gate — that is
// how /methodology, footer-linked from every page, once shipped as a 404.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app");

/** Routes intentionally absent from the public list that public pages may still
 *  reference. Adding one here is a decision — write the reason. */
const LAB_ONLY: Record<string, string> = {
  "/api": "not a page route (v1 API links from /methodology and /datasets)",
  "/pricing": "commercial surface dark at launch (owner call 2026-07-24); /docs/api describes the tiers",
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

/** The route a file renders under, as a concrete path isPublicRoute can judge:
 *  app/foo/bar/page.tsx -> /foo/bar, app/claims/[id]/X.tsx -> /claims/_id (route
 *  groups skipped). Matching is exact, so the full path matters — the old
 *  first-segment answer would have judged /claims/[id] by the Lab listing /claims. */
function owningRoute(file: string): string {
  const segs = path.relative(APP, file).split(path.sep).slice(0, -1)
    .filter((s) => !s.startsWith("(") && !s.startsWith("_"))
    .map((s) => s.replace(/^\[\.{0,3}(\w+)\]$/, "_$1"));
  return segs.length ? "/" + segs.join("/") : "/";
}

/** Commented-out code is not a link. */
function stripComments(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:\\"'`])\/\/.*$/gm, "$1");
}

// Requires a closing delimiter, and excludes `$` — a dynamic template literal
// (href={`/claims/${id}`}) has no statically-checkable target, so skip it.
const HREF_RE = /href[=:]\s*\{?\s*["'`](\/[^"'`\s{}$]*)["'`]/g;

describe("front door: no public page links to a route the Lab gate would intercept", () => {
  const files = walk(APP).filter((f) => isPublicRoute(owningRoute(f)));

  it("finds pages to check", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  const offenders: string[] = [];
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, "utf8"));
    for (const m of src.matchAll(HREF_RE)) {
      const href = m[1].split(/[?#]/)[0].replace(/\/$/, "") || "/";
      if (isPublicRoute(href) || labOnlyReason(href)) continue;
      offenders.push(`${path.relative(ROOT, file)} -> ${href}`);
    }
  }

  it("has no link from a public page to a Lab route", () => {
    expect(offenders).toEqual([]);
  });
});

describe("front door: the sitemap never advertises a URL the Lab gate intercepts", () => {
  const src = fs.readFileSync(path.join(APP, "sitemap.ts"), "utf8");

  it("filters every list through isPublicRoute (onlyPublic)", () => {
    expect(src).toMatch(/const onlyPublic = /);
    expect(src).toMatch(/onlyPublic\(STATIC_URLS_ALL\)/);
    expect(src).toMatch(/onlyPublic\(\[\.\.\.STATIC_URLS, \.\.\.curatedUrls\]\)/);
    expect(src).toMatch(/onlyPublic\(\[\.\.\.topicUrls, \.\.\.explorerUrls\]\)/);
  });

  it("lists no static URL that would be dropped", () => {
    // Literal static URLs only; templated ones (`/topics/${slug}`) are judged at
    // runtime by onlyPublic() above.
    const urls = [...src.matchAll(/\$\{SITE_URL\}(\/[^`"'$]*)`/g)]
      .map((m) => m[1].replace(/\/$/, "") || "/");
    expect(urls.length).toBeGreaterThan(10);
    const dropped = urls.filter((u) => !isPublicRoute(u) && !labOnlyReason(u));
    expect(dropped).toEqual([]);
  });
});

describe("front door: every listed public route has a page", () => {
  const pages = new Set(
    walk(APP)
      .filter((f) => path.basename(f) === "page.tsx")
      .map((f) => owningRoute(f)),
  );

  it.each(PUBLIC_ROUTES)("%s has an app/**/page.tsx", (r) => {
    expect(pages.has(r)).toBe(true);
  });

  it.each(DENY_EXACT)("%s (denied) has an app/**/page.tsx — a stale carve-out is a bug", (r) => {
    expect(pages.has(r)).toBe(true);
  });
});

describe("isPublicRoute — exact match, patterns for dynamic pages, carve-outs", () => {
  it.each([
    "/", "/methodology", "/communities", "/corrections", "/terms", "/privacy", "/docs/api",
    "/settling-curve", "/search", "/opinions", "/retraction-explorer", "/split-ledger", "/reversals",
  ])("%s is public", (r) => {
    expect(isPublicRoute(r)).toBe(true);
  });

  it.each([
    "/claims/cmplzmytq03hvsat0rn14mubm",
    "/settling-curve/h-pylori",
    "/topics/academic-literature",
    "/datasets/openalex_v1",
    "/embed/trajectory/h-pylori",
    "/stories/continental-drift",
  ])("%s (a [id]/[slug] page) is public", (r) => {
    expect(isPublicRoute(r)).toBe(true);
  });

  it.each([
    "/claims", "/topics", "/settling-curve/coverage", "/settling-curve/overview", "/datasets/snapshots",
    "/claims/abc/edit",
  ])("%s is carved out of a public pattern (Lab)", (r) => {
    expect(isPublicRoute(r)).toBe(false);
  });

  it.each([
    "/history", "/physics", "/fields", "/statistics", "/analysis/settling-rate", "/stats", "/globe",
    "/legislation", "/drug-arc", "/historical-events", "/pipelines", "/meta-edges", "/feed", "/books",
    "/reader/some-book", "/congress-trades", "/votes", "/members", "/financial", "/domains/economics",
    "/prereq-graph", "/retraction-wall", "/retractions", "/login", "/admin", "/review", "/receipts/x",
    "/stock-act", "/foreign-legislation", "/timeline",
  ])("%s is Lab", (r) => {
    expect(isPublicRoute(r)).toBe(false);
  });

  it("never prefix-matches: a public listing does not admit unknown children", () => {
    expect(isPublicRoute("/about/anything")).toBe(false);
    expect(isPublicRoute("/searchx")).toBe(false);
    expect(isPublicRoute("/claims/abc/def")).toBe(false);
    expect(isPublicRoute("/settling-curve/coverage/x")).toBe(false);
    expect(isPublicRoute("/embed")).toBe(false);
  });

  it("ignores query, hash and trailing slash", () => {
    expect(isPublicRoute("/search?q=x")).toBe(true);
    expect(isPublicRoute("/claims/abc/")).toBe(true);
    expect(isPublicRoute("/methodology#deprecation")).toBe(true);
    expect(isPublicRoute("/history/")).toBe(false);
  });
});
