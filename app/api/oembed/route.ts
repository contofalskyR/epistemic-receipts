import { NextRequest, NextResponse } from "next/server";
import { DOMAIN_TRAJECTORIES } from "@/lib/domain-trajectories";
import { SITE_URL } from "@/lib/site";

// Curated trajectory slugs (same gate as /embed)
const CURATED_SLUGS = new Set(Object.values(DOMAIN_TRAJECTORIES).flat());

// Known story slugs from app/stories/
const STORY_SLUGS = new Set([
  "h-pylori",
  "smoking-lung-cancer",
  "continental-drift",
  "cold-fusion",
  "cfc-ozone-depletion",
  "dietary-fat-heart",
  "semaglutide-glp1",
  "voting-rights-act-1965",
]);

type OEmbedResponse = {
  version: "1.0";
  type: "rich";
  provider_name: string;
  provider_url: string;
  title: string;
  html: string;
  width: number;
  height: number;
};

/**
 * Validate that `url` is a trajectory or story URL on this origin.
 * Returns { kind, slug } on success, null on rejection.
 * This is a lookup, not a fetch — no SSRF surface.
 */
function parseUrl(
  rawUrl: string,
): { kind: "trajectory"; slug: string } | { kind: "story"; slug: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  // Must be our origin
  const origin = new URL(SITE_URL).origin;
  if (parsed.origin !== origin) return null;

  // /settling-curve/{slug}
  const trajMatch = parsed.pathname.match(/^\/settling-curve\/([^/]+)$/);
  if (trajMatch) {
    const slug = trajMatch[1];
    return CURATED_SLUGS.has(slug) ? { kind: "trajectory", slug } : null;
  }

  // /stories/{slug}
  const storyMatch = parsed.pathname.match(/^\/stories\/([^/]+)$/);
  if (storyMatch) {
    const slug = storyMatch[1];
    return STORY_SLUGS.has(slug) ? { kind: "story", slug } : null;
  }

  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter required" }, { status: 400 });
  }

  const parsed = parseUrl(rawUrl);
  if (!parsed) {
    return NextResponse.json(
      { error: "URL does not match a supported trajectory or story route on this origin" },
      { status: 404 },
    );
  }

  let title: string;
  let embedSrc: string;

  if (parsed.kind === "trajectory") {
    title = `Settling curve — ${parsed.slug.replace(/-/g, " ")}`;
    embedSrc = `${SITE_URL}/embed/trajectory/${parsed.slug}`;
  } else {
    // story — no dedicated embed route, link to the story page
    title = `Story — ${parsed.slug.replace(/-/g, " ")}`;
    embedSrc = rawUrl; // story page itself (no /embed/ route for stories)
  }

  const width = 600;
  const height = 200;
  const html =
    parsed.kind === "trajectory"
      ? `<iframe src="${embedSrc}" width="${width}" height="${height}" style="border:0" loading="lazy" title="${escHtml(title)}"></iframe>`
      : `<blockquote><a href="${escHtml(rawUrl)}">${escHtml(title)}</a> — Epistemic Receipts</blockquote>`;

  const body: OEmbedResponse = {
    version: "1.0",
    type: "rich",
    provider_name: "Epistemic Receipts",
    provider_url: SITE_URL,
    title,
    html,
    width,
    height,
  };

  return NextResponse.json(body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
