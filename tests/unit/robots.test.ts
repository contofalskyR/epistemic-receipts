import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { resolveRobots } from "next/dist/build/webpack/loaders/metadata/resolve-route-data";
import robots from "@/app/robots";

// One robots.txt (front door phase 6, 2026-10-01). Under `next start` a file in
// public/ is served before an app route, so a stale public/robots.txt
// (re-added 2026-07-13) shadowed app/robots.ts in production: no /api/ rule,
// rules for deleted /api/v1 routes, and a sitemap on another host. app/robots.ts
// is the only source now, and it keeps /api/og/ open for link-preview bots.

const ROOT = path.resolve(__dirname, "../..");
const TXT = resolveRobots(robots());

/** RFC 9309 for the `User-agent: *` group: the longest matching pattern wins,
 *  an equally long Allow beats Disallow, no match means allowed; `*` matches
 *  any run of characters and a final `$` anchors the pattern. */
function allowed(txt: string, urlPath: string): boolean {
  const rules = txt
    .split("\n")
    .map((l) => /^(Allow|Disallow):\s*(\S*)\s*$/i.exec(l.trim()))
    .filter((m): m is RegExpExecArray => !!m && m[2] !== "")
    .map((m) => ({ allow: m[1].toLowerCase() === "allow", pattern: m[2] }));
  let best: { len: number; allow: boolean } | null = null;
  for (const r of rules) {
    const anchored = r.pattern.endsWith("$");
    const body = anchored ? r.pattern.slice(0, -1) : r.pattern;
    const re = new RegExp(
      "^" + body.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*") + (anchored ? "$" : ""),
    );
    if (!re.test(urlPath)) continue;
    if (!best || r.pattern.length > best.len || (r.pattern.length === best.len && r.allow)) {
      best = { len: r.pattern.length, allow: r.allow };
    }
  }
  return best ? best.allow : true;
}

describe("robots.txt", () => {
  it("has no public/ file shadowing an app metadata route", () => {
    for (const f of ["robots.txt", "sitemap.xml", "sitemap-index.xml", "favicon.ico", "sitemap"]) {
      expect(fs.existsSync(path.join(ROOT, "public", f)), `public/${f}`).toBe(false);
    }
    for (const f of ["robots.ts", "sitemap.ts", "sitemap-index.xml/route.ts", "favicon.ico"]) {
      expect(fs.existsSync(path.join(ROOT, "app", f)), `app/${f}`).toBe(true);
    }
  });

  it("allows /api/og/, disallows the rest of /api/, and points at this host's sitemap", () => {
    expect(TXT).toMatch(/^Allow: \/api\/og\/$/m);
    expect(TXT).toMatch(/^Disallow: \/api\/$/m);
    expect(TXT).toMatch(/^Sitemap: \S+\/sitemap\.xml$/m);
    expect(TXT).not.toContain("api/v1");
  });

  it.each(["/", "/claims/abc", "/topics/medicine", "/settling-curve/continental-drift", "/api/og/claim?id=x", "/api/og/trajectory?id=y", "/api/og/default"])(
    "%s is crawlable",
    (p) => {
      expect(allowed(TXT, p)).toBe(true);
    },
  );

  // /api/oembed and the read APIs that client-rendered public pages fetch from
  // (/api/topics/…, /api/opinions, /api/retractions) stay disallowed until the
  // owner decides otherwise — allowing one is a deliberate change to this list.
  it.each([
    "/api/claims",
    "/api/search?q=x",
    "/api/topics/medicine",
    "/api/opinions",
    "/api/oembed?url=x",
    "/login",
    "/login?from=%2Fx",
    "/review",
    "/admin/feedback",
    "/labs/claim-diff",
    "/claims/abc/edit",
  ])("%s is disallowed", (p) => {
    expect(allowed(TXT, p)).toBe(false);
  });
});
