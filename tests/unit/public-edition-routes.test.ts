import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { isPublicRoute, PUBLIC_ROUTES, DENY_EXACT } from "@/lib/publicEdition";

// Regression guard for the 2026-07-24 gap audit, extended for front door
// phase 2 (2026-09-30): one deployment, page routes deny-by-default against
// an EXACT public list (lib/publicEdition.ts), Lab behind the admin session.
//
// Links are guarded by tests/unit/link-integrity.test.ts (phase 4): every
// href an anonymous visitor can render — pages, layouts, app/components/,
// components/, lib/ — must stay public, and every href must exist. This file
// keeps the list itself honest: each entry is a real page, the matcher is
// exact, and the sitemap never advertises a Lab URL.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app");

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
    const dropped = urls.filter((u) => !isPublicRoute(u));
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
    "/", "/methodology", "/communities", "/corrections", "/terms", "/privacy",
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
