import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeHero, { type HeroCard } from "./HomeHero";
import HomepageSections, { type HomepageStats } from "./HomepageSections";
import SettlingCurveMini, { AXIS_VIS } from "./components/SettlingCurveMini";
import {
  FEATURED_TRAJECTORIES,
  type FeaturedMilestone,
} from "@/lib/featured-trajectories";
import { loadRecentTransitions, type WhatsNewItem } from "@/lib/feed";

export const revalidate = 300;

type IngestedByRow = { ingestedBy: string; count: number };

// Plain (serializable) hero data — the React element is built in Home() so the
// SVG is server-rendered there and handed to the client island as a prop.
type HeroCardData = {
  id: string;
  eyebrow: string;
  eyebrowColor: string;
  hook: string;
  claim: string;
  endLabel: string;
  span: string;
  milestoneCount: number;
  milestones: FeaturedMilestone[];
};

// For each curated trajectory, pull live milestones from ClaimStatusHistory and
// fall back to the embedded curation data if the DB row is missing.
async function loadFeatured(): Promise<HeroCardData[]> {
  return Promise.all(
    FEATURED_TRAJECTORIES.map(async (f) => {
      const claim = await prisma.claim.findFirst({
        where: { externalId: `trajectory:${f.id}`, deleted: false },
        select: {
          text: true,
          statusHistory: {
            orderBy: { occurredAt: "asc" },
            select: { toAxis: true, community: true, occurredAt: true, reason: true },
          },
        },
      });

      const milestones: FeaturedMilestone[] =
        claim && claim.statusHistory.length > 0
          ? claim.statusHistory.map((s) => ({
              year: s.occurredAt.getUTCFullYear(),
              axis: s.toAxis,
              community: String(s.community),
              reason: s.reason,
            }))
          : f.milestones;

      const years = milestones.map((m) => m.year);
      const minY = Math.min(...years);
      const maxY = Math.max(...years);
      const last = milestones[milestones.length - 1];

      return {
        id: f.id,
        eyebrow: f.eyebrow,
        eyebrowColor: f.eyebrowColor,
        hook: f.hook,
        claim: claim?.text ?? f.claim,
        endLabel: AXIS_VIS[last.axis]?.label ?? last.axis,
        span: minY === maxY ? `${minY}` : `${minY} → ${maxY}`,
        milestoneCount: milestones.length,
        milestones,
      };
    }),
  );
}

async function loadHomepageData() {
  const [
    claimCount,
    sourceCount,
    legislativeVoteCount,
    retractedPapersCount,
    vdemCount,
    grouped,
    featured,
    whatsNew,
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
    loadFeatured(),
    loadRecentTransitions(6),
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

  return { stats, ingestedByCounts, featured, whatsNew };
}

export default async function Home() {
  const { stats, ingestedByCounts, featured, whatsNew } = await loadHomepageData();

  // Render the mini sparkline on the server; hand it to the client hero as a prop.
  const heroCards: HeroCard[] = featured.map(({ milestones, ...rest }) => ({
    ...rest,
    mini: (
      <SettlingCurveMini
        milestones={milestones}
        ariaLabel={`Epistemic trajectory: ${rest.claim}`}
      />
    ),
  }));

  return (
    <HomeHero heroCards={heroCards}>
      <HomepageSections
        stats={stats}
        ingestedByCounts={ingestedByCounts}
        whatsNew={whatsNew}
      />
    </HomeHero>
  );
}
