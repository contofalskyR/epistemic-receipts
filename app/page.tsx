import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeHero from "./HomeHero";
import HomepageSections, {
  type FeaturedClaim,
  type HomepageStats,
  type TopicChipData,
} from "./HomepageSections";

export const revalidate = 300;

type IngestedByRow = { ingestedBy: string; count: number };

type ClaimWithEdge = {
  id: string;
  text: string;
  edges: { source: { name: string; publishedAt: Date | null } | null }[];
};

function toFeatured(claim: ClaimWithEdge | null): FeaturedClaim {
  if (!claim) return null;
  const edgeSource = claim.edges[0]?.source ?? null;
  const year = edgeSource?.publishedAt ? new Date(edgeSource.publishedAt).getFullYear() : null;
  return {
    id: claim.id,
    text: claim.text,
    sourceName: edgeSource?.name ?? null,
    sourceYear: year,
  };
}

async function loadHomepageData() {
  const [
    claimCount,
    sourceCount,
    legislativeVoteCount,
    retractedPapersCount,
    vdemCount,
    grouped,
    settled,
    contested,
    recorded,
    rawTopics,
  ] = await Promise.all([
    prisma.claim.count({ where: { verificationStatus: { not: "DEPRECATED" } } }),
    prisma.source.count(),
    prisma.legislativeVote.count(),
    prisma.claim.count({ where: { ingestedBy: "crossref_retractions_v1" } }),
    prisma.claim.count({ where: { ingestedBy: "vdem_v1" } }),
    prisma.$queryRaw<IngestedByRow[]>(
      Prisma.sql`
        SELECT "ingestedBy", COUNT(*)::int AS count
        FROM "Claim"
        WHERE "verificationStatus" IS DISTINCT FROM 'DEPRECATED'
        GROUP BY "ingestedBy"
      `,
    ),
    prisma.claim.findFirst({
      where: { epistemicAxis: "SETTLED", verificationStatus: { not: "DEPRECATED" } },
      orderBy: { createdAt: "desc" },
      include: { edges: { take: 1, include: { source: true } } },
    }),
    prisma.claim.findFirst({
      where: { epistemicAxis: "CONTESTED", verificationStatus: { not: "DEPRECATED" } },
      orderBy: { createdAt: "desc" },
      include: { edges: { take: 1, include: { source: true } } },
    }),
    prisma.claim.findFirst({
      where: { epistemicAxis: "RECORDED", verificationStatus: { not: "DEPRECATED" } },
      orderBy: { createdAt: "desc" },
      include: { edges: { take: 1, include: { source: true } } },
    }),
    prisma.topic.findMany({
      where: { parentTopicId: null },
      orderBy: { claims: { _count: "desc" } },
      include: { _count: { select: { claims: true } } },
      take: 40,
    }),
  ]);

  const stats: HomepageStats = {
    claims: claimCount,
    sources: sourceCount,
    legislativeVotes: legislativeVoteCount,
    retractedPapers: retractedPapersCount,
    vdemIndicators: vdemCount,
  };

  const ingestedByCounts = new Map<string, number>();
  for (const row of grouped) {
    ingestedByCounts.set(row.ingestedBy, Number(row.count));
  }

  const allTopics: TopicChipData[] = rawTopics.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    domain: t.domain,
    claimCount: t._count.claims,
  }));
  const topTopics = [...allTopics].sort(() => Math.random() - 0.5).slice(0, 16);

  return {
    stats,
    ingestedByCounts,
    featured: {
      settled:   toFeatured(settled),
      contested: toFeatured(contested),
      recorded:  toFeatured(recorded),
    },
    topTopics,
  };
}

export default async function Home() {
  const { stats, ingestedByCounts, featured, topTopics } = await loadHomepageData();
  return (
    <HomeHero>
      <HomepageSections stats={stats} ingestedByCounts={ingestedByCounts} featured={featured} topTopics={topTopics} />
    </HomeHero>
  );
}
