import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

// ── Sitemap INDEX at /sitemap.xml ─────────────────────────────────────────────
// app/sitemap.ts uses generateSitemaps(), which makes Next serve the chunk
// files at /sitemap/[id].xml but does NOT emit an index at /sitemap.xml —
// the URL robots.ts advertises 404'd in production (AUDIT-PRELAUNCH-2026-07-06
// §2). This handler derives the same chunk list as generateSitemaps() and
// serves the <sitemapindex> pointing at the real chunk URLs.
//
// Keep the chunking logic in sync with app/sitemap.ts.

export const revalidate = 86400; // same freshness as the chunks themselves

const CHUNK = 50_000;

export async function GET() {
  const multiStepCount = await prisma.claim.count({
    where: {
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
      statusHistory: { some: {} },
    },
  });

  const claimChunks = Math.ceil(multiStepCount / CHUNK) || 1;
  const ids = [
    "static",
    "topics",
    ...Array.from({ length: claimChunks }, (_, i) => `claims-${i}`),
  ];

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    ids
      .map((id) => `  <sitemap><loc>${SITE_URL}/sitemap/${id}.xml</loc></sitemap>`)
      .join("\n") +
    `\n</sitemapindex>\n`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=86400",
    },
  });
}
