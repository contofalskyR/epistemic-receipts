import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { safeRedirectPath } from "@/lib/safeRedirect";

// /login's post-sign-in redirect (front door phase 6, 2026-10-01). The old
// check was a regex — one leading "/" not followed by "/" — which
// "/\evil.example/" and "/<TAB>/evil.example" pass; the browser's URL parser
// then lands on evil.example. What matters is where the returned string lands
// when the browser assigns it to location.href on the /login page.

const O = "https://er.test";
const landsOn = (dest: string): string => {
  try {
    return new URL(dest, `${O}/login?from=x`).origin;
  } catch {
    return "unparseable";
  }
};

describe("safeRedirectPath (lib/safeRedirect.ts)", () => {
  it.each([
    ["/history", "/history"],
    ["/history?x=1#a", "/history?x=1#a"],
    ["/claims/abc", "/claims/abc"],
    ["/admin/feedback", "/admin/feedback"],
    ["/settling-curve?t=continental-drift", "/settling-curve?t=continental-drift"],
    ["/%2F%2Fevil.example", "/%2F%2Fevil.example"], // encoded slashes stay inside one segment
    ["/members/%E2%82%AC", "/members/%E2%82%AC"],
    ["/members/€", "/members/%E2%82%AC"],
  ])("%j → %j", (from, want) => {
    expect(safeRedirectPath(from, O)).toBe(want);
  });

  it.each([
    "",
    null,
    undefined,
    "//evil.example/x",
    "/\\evil.example/x",
    "/\t/evil.example/x",
    "/\n/evil.example/x",
    "/\r/evil.example/x",
    "\\\\evil.example/x",
    "https://evil.example/x",
    "https://er.test/history", // an absolute URL is not a path
    "http:/evil.example/x",
    " /history",
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "data:text/html,x",
    // dot segments collapse to the protocol-relative "//evil.example"
    "/.//evil.example/x",
    "/..//evil.example/x",
    "/%2e//evil.example/x",
    "/%2E%2E//evil.example/x",
    "/./\\evil.example/x",
    "/x/..//evil.example/x",
    "//er.test//evil.example/x",
    "/.//", // would be "//", which the browser cannot even parse
  ])("%j → /", (from) => {
    expect(safeRedirectPath(from, O)).toBe("/");
  });

  it("compares origins after normalising the one it is given", () => {
    expect(safeRedirectPath("/history", "https://er.test:443")).toBe("/history");
    expect(safeRedirectPath("/history", "https://er.test/")).toBe("/history");
    expect(safeRedirectPath("/history", "null")).toBe("/");
  });

  it("never sends the browser off-site or to an unparseable URL (exhaustive over short inputs)", () => {
    const atoms = ["/", "\\", ".", "..", "%2e", "\t", "\n", "evil.example", "er.test", "%2F", "@", "?", "#"];
    const bad: string[] = [];
    let kept = 0;
    const walk = (s: string, depth: number): void => {
      if (depth > 0) {
        const dest = safeRedirectPath(s, O);
        if (dest !== "/") kept++;
        if (landsOn(dest) !== O) bad.push(JSON.stringify(s));
      }
      if (depth < 4) for (const a of atoms) walk(s + a, depth + 1);
    };
    walk("/", 0);
    expect(bad.slice(0, 10)).toEqual([]);
    expect(kept).toBeGreaterThan(1000); // the property is not met by always answering "/"
  });

  it("app/login/page.tsx redirects through safeRedirectPath", () => {
    const src = fs.readFileSync(path.resolve(__dirname, "../../app/login/page.tsx"), "utf8");
    expect(src).toMatch(/window\.location\.href\s*=\s*safeRedirectPath\(/);
  });
});
