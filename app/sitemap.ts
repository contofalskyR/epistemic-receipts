import type { MetadataRoute } from "next";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import { STAT_METHOD_SLUGS } from "@/lib/statMethods";

// Sitemap chunks: with generateSitemaps(), Next serves /sitemap/[id].xml
// (per-chunk files) but does NOT emit an index — that lives in
// app/sitemap.xml/route.ts (keep its chunk logic in sync with this file).
// Each chunk must stay under the 50k-URL protocol cap.
const CHUNK = 50_000;

const STATIC_URLS: MetadataRoute.Sitemap = [
  { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1.0 },
  { url: `${SITE_URL}/start-here`, changeFrequency: "monthly", priority: 0.9 },
  { url: `${SITE_URL}/about`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/docs/api`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/glossary`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/trajectories`, changeFrequency: "daily", priority: 0.9 },
  { url: `${SITE_URL}/topics`, changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE_URL}/sources`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/statistics`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/statistics/explorer`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/search`, changeFrequency: "monthly", priority: 0.6 },
  { url: `${SITE_URL}/retractions`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/reversals`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/canon`, changeFrequency: "daily", priority: 0.8 },
  { url: `${SITE_URL}/globe`, changeFrequency: "monthly", priority: 0.5 },
  { url: `${SITE_URL}/case-studies`, changeFrequency: "weekly", priority: 0.9 },
  { url: `${SITE_URL}/stories`, changeFrequency: "monthly", priority: 0.8 },
  { url: `${SITE_URL}/stories/h-pylori`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/smoking-lung-cancer`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/continental-drift`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/cold-fusion`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/semaglutide-glp1`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/cfc-ozone-depletion`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/dietary-fat-heart`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/stories/voting-rights-act-1965`, changeFrequency: "monthly", priority: 0.7 },
  { url: `${SITE_URL}/open-questions`, changeFrequency: "weekly", priority: 0.7 },
  { url: `${SITE_URL}/split-ledger`, changeFrequency: "weekly", priority: 0.8 },
  { url: `${SITE_URL}/communities`, changeFrequency: "monthly", priority: 0.7 },
];

export async function generateSitemaps() {
  // Count multi-step claims (curve_length ≥ 1: any documented transition).
  // We include claims with ≥ 1 ClaimStatusHistory entry rather than strictly > 1
  // because even a single documented transition represents a meaningful epistemic
  // event worth indexing. All 1.76M pipeline claims with no status history are
  // excluded — they lack settled trajectories and would dilute crawl budget.
  // Revisit including all claims once the trajectory pages have more content.
  const multiStepCount = await prisma.claim.count({
    where: {
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
      statusHistory: { some: {} },
    },
  });

  const claimChunks = Math.ceil(multiStepCount / CHUNK) || 1;

  return [
    { id: "static" },  // static pages + curated trajectories (priority 1)
    { id: "topics" },  // topic pages + statistics explorer slugs (priority 2)
    // claim pages in 50k chunks (priority 3)
    ...Array.from({ length: claimChunks }, (_, i) => ({ id: `claims-${i}` })),
  ];
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;

  // Chunk 0: static pages + curated hand-built trajectories
  if (id === "static") {
    const curated = await prisma.claim.findMany({
      where: {
        deleted: false,
        externalId: { startsWith: "trajectory:" },
        OR: [
          { verificationStatus: null },
          { verificationStatus: { not: "DEPRECATED" } },
        ],
      },
      select: { externalId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    });

    const curatedUrls: MetadataRoute.Sitemap = curated.map((c) => ({
      url: `${SITE_URL}/settling-curve/${c.externalId!.replace(/^trajectory:/, "")}`,
      lastModified: c.updatedAt,
      changeFrequency: "monthly" as const,
      priority: 0.9,
    }));

    return [...STATIC_URLS, ...curatedUrls];
  }

  // Chunk 1: topic pages + statistics explorer method pages
  if (id === "topics") {
    const topics = await prisma.topic.findMany({
      select: { slug: true },
      orderBy: { slug: "asc" },
    });

    const topicUrls: MetadataRoute.Sitemap = topics.map((t) => ({
      url: `${SITE_URL}/topics/${t.slug}`,
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

    const explorerUrls: MetadataRoute.Sitemap = STAT_METHOD_SLUGS.map((slug) => ({
      url: `${SITE_URL}/statistics/explorer/${slug}`,
      changeFrequency: "monthly" as const,
      priority: 0.6,
    }));

    return [...topicUrls, ...explorerUrls];
  }

  // Claim chunks: id = "claims-0", "claims-1", ...
  const chunkMatch = id.match(/^claims-(\d+)$/);
  if (!chunkMatch) return [];

  const chunkIndex = parseInt(chunkMatch[1], 10);
  const skip = chunkIndex * CHUNK;

  // Cursor-style pagination via stable id ordering. skip/take is acceptable
  // here because this runs at build time (or ISR revalidation) and each chunk
  // is a separate serverless invocation — no single query loads > 50k rows.
  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
      statusHistory: { some: {} },
    },
    select: { id: true, updatedAt: true },
    orderBy: { id: "asc" },
    skip,
    take: CHUNK,
  });

  return claims.map((c) => ({
    url: `${SITE_URL}/claims/${c.id}`,
    lastModified: c.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
}
