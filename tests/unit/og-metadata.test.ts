import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { socialMetadata, defaultSocialMetadata, DEFAULT_OG_IMAGE, trajectoryOgImage, claimOgImage } from "@/lib/og";
import { truncate } from "@/lib/og-shared";

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

  it("the root layout sets the image-only default card, never a page title or url", () => {
    const src = fs.readFileSync(path.join(APP, "layout.tsx"), "utf8");
    expect(src).toMatch(/defaultSocialMetadata\(\)/);
    expect(src).not.toMatch(/socialMetadata\(\{/);
    expect(src).toMatch(/metadataBase/);
  });

  it("the homepage keeps the site root as its og:url", () => {
    const src = fs.readFileSync(path.join(APP, "page.tsx"), "utf8");
    expect(src).toMatch(/socialMetadata\(\{[^}]*url: "\/"/);
  });
});

// Front door phase 6 (2026-10-01): phase 5's root block carried the homepage's
// title and url, which ~25 public pages without an openGraph block of their
// own inherited whole (og:url = the site root, og:title "Epistemic Receipts").
describe("defaultSocialMetadata() — the root layout's block", () => {
  it("is the image and nothing page-specific", () => {
    const m = defaultSocialMetadata();
    expect(Object.keys(m.openGraph!).sort()).toEqual(["images", "siteName", "type"]);
    expect(Object.keys(m.twitter!).sort()).toEqual(["card"]);
    expect((m.openGraph as { images: unknown[] }).images).toEqual([DEFAULT_OG_IMAGE]);
  });
});

// Runs Next's own resolver (next/dist/lib/metadata/resolve-metadata.js, Next
// 16.2.6): the fix relies on postProcessMetadata filling og/twitter titles and
// descriptions from the page, which the docs do not spell out. If a Next
// upgrade breaks this block, re-run the Twitterbot curl from the phase 6 PR
// before deleting it.
describe("Next's metadata resolver under the root default", () => {
  type Title = { absolute: string } | null | undefined;
  type Img = { url: unknown }[] | undefined;
  type Resolved = {
    openGraph: { title?: Title; description?: string | null; url?: unknown; images?: Img } | null;
    twitter: { card?: string; title?: Title; description?: string | null; images?: Img } | null;
  };
  type Accumulate = (
    route: string,
    items: unknown[],
    pathname: Promise<string>,
    ctx: { trailingSlash: boolean; isStaticMetadataRouteFile: boolean },
  ) => Promise<Resolved>;

  // vi.mock("server-only") in setup.ts does not reach Next's CJS require, so
  // the module cache is seeded before loading the resolver — inside the tests,
  // so a moved Next internal fails these cases rather than the whole file.
  function accumulate(route: string, items: unknown[]): Promise<Resolved> {
    const req = createRequire(import.meta.url);
    const so = req.resolve("server-only");
    req.cache[so] = { id: so, filename: so, loaded: true, exports: {} } as never;
    const { accumulateMetadata } = req("next/dist/lib/metadata/resolve-metadata.js") as { accumulateMetadata: Accumulate };
    return accumulateMetadata(route, items, Promise.resolve(route), { trailingSlash: false, isStaticMetadataRouteFile: false });
  }
  const root = { metadataBase: new URL("https://er.test"), title: "Epistemic Receipts", description: "root description", ...defaultSocialMetadata() };
  const url = (u: unknown) => String(u);

  it("a page with only a title and description gets its own og and twitter title, no og:url, the default image", async () => {
    const page = { title: "Court Opinions — Epistemic Receipts", description: "page description" };
    const m = await accumulate("/opinions", [[root, null], [null, null], [page, null]]);
    expect(m.openGraph?.title?.absolute).toBe(page.title);
    expect(m.openGraph?.description).toBe(page.description);
    expect(m.openGraph?.url ?? null).toBeNull();
    expect(url(m.openGraph?.images?.[0]?.url)).toMatch(/\/api\/og\/default$/);
    expect(m.twitter?.card).toBe("summary_large_image");
    expect(m.twitter?.title?.absolute).toBe(page.title);
    expect(m.twitter?.description).toBe(page.description);
    expect(url(m.twitter?.images?.[0]?.url)).toMatch(/\/api\/og\/default$/);
  });

  it("a title from a nested layout (app/topics/layout.tsx) carries through", async () => {
    const topics = { title: "Topics — Epistemic Receipts", description: "topics description" };
    const m = await accumulate("/topics/medicine", [[root, null], [topics, null], [null, null], [null, null]]);
    expect(m.openGraph?.title?.absolute).toBe(topics.title);
    expect(m.openGraph?.url ?? null).toBeNull();
  });

  it("a page with its own og image and no twitter block gets that image on twitter too", async () => {
    const page = { title: "A receipt", openGraph: { title: "A receipt", images: [{ url: "/api/og/receipt?id=x" }] } };
    const m = await accumulate("/receipts/x", [[root, null], [null, null], [page, null]]);
    expect(url(m.twitter?.images?.[0]?.url)).toMatch(/\/api\/og\/receipt\?id=x$/);
  });
});

// Satori (@vercel/og) honours a display:-webkit-box line clamp only when
// textOverflow is "ellipsis"; without it the line limit is Infinity, and a
// 1,206-character curated title ran across the curve (phase 6).
describe("OG card text is clamped and cut", () => {
  const files = [path.join(ROOT, "lib", "og-shared.tsx")];
  (function walkOg(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walkOg(p);
      else if (/^route\.tsx?$/.test(e.name)) files.push(p);
    }
  })(path.join(APP, "api", "og"));

  it.each(files.map((f) => [path.relative(ROOT, f), f]))("%s pairs every line clamp with an ellipsis", (_name, f) => {
    const src = fs.readFileSync(f, "utf8");
    const clamps = (src.match(/WebkitLineClamp\s*:/g) ?? []).length;
    const ellipses = (src.match(/textOverflow\s*:\s*["']ellipsis["']/g) ?? []).length;
    expect(clamps).toBeLessThanOrEqual(ellipses);
  });

  it("truncate() cuts to max characters with an ellipsis", () => {
    expect(truncate("short", 10)).toBe("short");
    const t = truncate("x".repeat(1206), 220);
    expect(t.length).toBe(220);
    expect(t.endsWith("…")).toBe(true);
  });
});
