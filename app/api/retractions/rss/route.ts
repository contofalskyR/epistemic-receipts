import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";

export const revalidate = 900;
const FEED_LIMIT = 50;

type ClaimMeta = {
  title?: string;
  journal?: string;
  publisher?: string;
  doi?: string;
} | null;

function titleFromMeta(meta: ClaimMeta, text: string): string {
  if (meta?.title?.trim()) return meta.title.trim();
  const m = text.match(/"([^"]+)"/);
  if (m) return m[1];
  return text.slice(0, 200);
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export async function GET(_req: NextRequest) {
  const rows = await prisma.claim.findMany({
    where: {
      deleted: false,
      OR: [
        { epistemicAxis: "CONTESTED", ingestedBy: "crossref_retractions_v1" },
        { verificationStatus: "DISPUTED" },
      ],
    },
    orderBy: [{ claimEmergedAt: "desc" }, { createdAt: "desc" }],
    take: FEED_LIMIT,
    select: {
      id: true,
      text: true,
      epistemicAxis: true,
      verificationStatus: true,
      ingestedBy: true,
      createdAt: true,
      claimEmergedAt: true,
      metadata: true,
      edges: {
        where: { deleted: false },
        take: 1,
        select: { source: { select: { name: true, url: true } } },
      },
    },
  });

  const items = rows
    .map((r) => {
      const meta = r.metadata as ClaimMeta;
      const title = titleFromMeta(meta, r.text);
      const link = `${SITE_URL}/claims/${r.id}`;
      const pubDate = (r.claimEmergedAt ?? r.createdAt).toUTCString();
      const description = [
        meta?.journal ? `Journal: ${meta.journal}` : null,
        meta?.publisher ? `Publisher: ${meta.publisher}` : null,
        meta?.doi ? `DOI: ${meta.doi}` : null,
        `Status: ${r.epistemicAxis ?? r.verificationStatus ?? "unknown"}`,
      ]
        .filter(Boolean)
        .join(" · ");

      return `    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(link)}</link>
      <guid isPermaLink="true">${escapeXml(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(description || r.text.slice(0, 300))}</description>
    </item>`;
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Epistemic Receipts — Retraction Feed</title>
    <link>${SITE_URL}/retractions</link>
    <description>Live feed of retracted scientific papers and disputed claims tracked by Epistemic Receipts.</description>
    <language>en-us</language>
    <ttl>900</ttl>
    <atom:link href="${SITE_URL}/api/retractions/rss" rel="self" type="application/rss+xml"/>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
      "X-RateLimit-Limit": "100",
      "X-RateLimit-Remaining": "99",
    },
  });
}
