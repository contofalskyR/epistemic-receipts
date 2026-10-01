import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { socialMetadata, DEFAULT_OG_IMAGE, trajectoryOgImage, claimOgImage } from "@/lib/og";

// Front door phase 5 (STATUS.md, 2026-09-30): link previews. Next merges
// `openGraph` per segment by replacing the whole object, so a page that sets
// its own openGraph title without an image silently drops the root layout's
// default card. Every page-level openGraph block must therefore carry an image
// — through socialMetadata() or an explicit `images:`.

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/^(page|layout)\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
}

describe("socialMetadata()", () => {
  it("attaches the default card and a large-image twitter card", () => {
    const m = socialMetadata({ title: "T", description: "D", url: "/x" });
    expect(m.openGraph).toMatchObject({ title: "T", description: "D", url: "/x", siteName: "Epistemic Receipts", type: "website" });
    expect((m.openGraph as { images: unknown[] }).images).toEqual([DEFAULT_OG_IMAGE]);
    expect(m.twitter).toMatchObject({ card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] });
  });

  it("uses the curve card when given one", () => {
    const img = trajectoryOgImage("continental-drift");
    expect(img.url).toBe("/api/og/trajectory?id=continental-drift");
    expect(claimOgImage("abc").url).toBe("/api/og/claim?id=abc");
    const m = socialMetadata({ title: "T", url: "/stories/continental-drift", type: "article", image: img });
    expect((m.openGraph as { images: unknown[] }).images).toEqual([img]);
    expect((m.twitter as { images: string[] }).images).toEqual([img.url]);
  });

  it("every OG image URL is relative — app/layout.tsx sets metadataBase", () => {
    for (const u of [DEFAULT_OG_IMAGE.url, trajectoryOgImage("x").url, claimOgImage("y").url]) {
      expect(u.startsWith("/api/og/")).toBe(true);
    }
  });
});

describe("every openGraph block in app/ carries an image", () => {
  const files = walk(APP).filter((f) => /openGraph\s*:|socialMetadata\(/.test(fs.readFileSync(f, "utf8")));

  it("finds the pages that set link-preview metadata", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  const offenders = files
    .filter((f) => {
      const src = fs.readFileSync(f, "utf8");
      return !/socialMetadata\(/.test(src) && !/images\s*:/.test(src);
    })
    .map((f) => path.relative(ROOT, f));

  it("has no openGraph block without socialMetadata() or images:", () => {
    expect(offenders).toEqual([]);
  });

  it("the root layout sets the default card", () => {
    const src = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    expect(src).toMatch(/socialMetadata\(/);
    expect(src).toMatch(/metadataBase/);
  });
});
