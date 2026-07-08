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
import { compactCount } from "@/lib/format";

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

const CURATED_IDS = new Set(FEATURED_TRAJECTORIES.map((f) => `trajectory:${f.id}`));

function trajectoryEyebrow(lastAxis: string): { eyebrow: string; eyebrowColor: string } {
  if (lastAxis === "REVERSED")   return { eyebrow: "THE REVERSAL",   eyebrowColor: "text-rose-300" };
  if (lastAxis === "SETTLED")    return { eyebrow: "THE SETTLEMENT",  eyebrowColor: "text-emerald-300" };
  if (lastAxis === "CONTESTED")  return { eyebrow: "STILL CONTESTED", eyebrowColor: "text-amber-300" };
  if (lastAxis === "ABANDONED")  return { eyebrow: "ABANDONED",       eyebrowColor: "text-slate-400" };
  return                                { eyebrow: "RECORDED",        eyebrowColor: "text-sky-300" };
}

// For each curated trajectory, pull live milestones from ClaimStatusHistory and
// fall back to the embedded curation data if the DB row is missing.
// Also pulls up to 12 interesting DB trajectories (REVERSED/multi-milestone) to
// expand the rotation pool beyond the 3 hardcoded ones.
async function loadFeatured(): Promise<HeroCardData[]> {
  const [curated, interesting] = await Promise.all([
    // Curated hand-written cards
    Promise.all(
      FEATURED_TRAJECTORIES.map(async (f) => {
        const claim = await prisma.claim.findFirst({
          where: { externalId: `trajectory:${f.id}`, deleted: false },
          select: {
            text: true,
            statusHistory: {
              orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
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
    ),
    // Dynamic pool: REVERSED or SETTLED trajectories with 3+ milestones, excluding curated ones
    prisma.claim.findMany({
      where: {
        externalId: { startsWith: "trajectory:", notIn: Array.from(CURATED_IDS) },
        epistemicAxis: { in: ["REVERSED", "SETTLED"] },
        deleted: false,
        statusHistory: { some: {} },
      },
      select: {
        externalId: true,
        text: true,
        statusHistory: {
          orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
          select: { toAxis: true, community: true, occurredAt: true, reason: true },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  // Shuffle the dynamic pool and take 12
  const shuffled = interesting
    .filter((c) => c.statusHistory.length >= 3)
    .sort(() => Math.random() - 0.5)
    .slice(0, 12);

  const dynamic: HeroCardData[] = shuffled.map((c) => {
    const milestones: FeaturedMilestone[] = c.statusHistory.map((s) => ({
      year: s.occurredAt.getUTCFullYear(),
      axis: s.toAxis,
      community: String(s.community),
      reason: s.reason,
    }));
    const years = milestones.map((m) => m.year);
    const minY = Math.min(...years);
    const maxY = Math.max(...years);
    const last = milestones[milestones.length - 1];
    const id = c.externalId!.replace(/^trajectory:/, "");
    const { eyebrow, eyebrowColor } = trajectoryEyebrow(last.axis);
    return {
      id,
      eyebrow,
      eyebrowColor,
      hook: c.text,
      claim: c.text,
      endLabel: AXIS_VIS[last.axis]?.label ?? last.axis,
      span: minY === maxY ? `${minY}` : `${minY} → ${maxY}`,
      milestoneCount: milestones.length,
      milestones,
    };
  });

  return [...curated, ...dynamic];
}

async function loadHomepageData() {
  const [
    claimCount,
    transitionCount,
    curveCount,
    sourceCount,
    legislativeVoteCount,
    grouped,
    featured,
    whatsNew,
  ] = await Promise.all([
    prisma.claim.count({ where: { verificationStatus: { not: "DEPRECATED" } } }),
    prisma.claimStatusHistory.count(),
    // Settling curves = non-deprecated claims with at least one transition row
    // (a one-dot curve is a real curve — "nothing has moved yet" is a claim).
    prisma.claim.count({
      where: { verificationStatus: { not: "DEPRECATED" }, statusHistory: { some: {} } },
    }),
    prisma.source.count(),
    prisma.legislativeVote.count(),
    // Per-pipeline counts, CLASSIFIED claims only. `IS NOT NULL` mirrors what
    // Prisma's `not: "DEPRECATED"` does for the headline count above — without
    // it the domain tiles silently included the ~138k never-classified claims
    // and disagreed with the headline/pipelines totals (e.g. the Neuroscience
    // tile showed 318,775 while /pipelines showed openalex at 212,145).
    prisma.$queryRaw<IngestedByRow[]>(
      Prisma.sql`
        SELECT "ingestedBy", COUNT(*)::int AS count
        FROM "Claim"
        WHERE "verificationStatus" IS DISTINCT FROM 'DEPRECATED'
          AND "verificationStatus" IS NOT NULL
        GROUP BY "ingestedBy"
      `,
    ),
    loadFeatured(),
    loadRecentTransitions(6),
  ]);

  const ingestedByCounts = new Map<string, number>();
  for (const row of grouped) {
    ingestedByCounts.set(row.ingestedBy, Number(row.count));
  }

  // Stats-bar numbers derive from the SAME grouped query the domain tiles use,
  // so the same figure can never differ across one page (audit §8: the stats
  // bar said 26,624 retracted papers while the Retractions tile said 26,679 —
  // the bar counted crossref only, the tile crossref + retraction_watch).
  const sumTags = (...tags: string[]) =>
    tags.reduce((s, t) => s + (ingestedByCounts.get(t) ?? 0), 0);

  const stats: HomepageStats = {
    claims: claimCount,
    settlingCurves: curveCount,
    sources: sourceCount,
    legislativeVotes: legislativeVoteCount,
    retractedPapers: sumTags("crossref_retractions_v1", "retraction_watch_v1"),
  };

  // Derived, never hand-written (audit item 2 / marketing house rule).
  const liveCounts = {
    claims: compactCount(claimCount),
    transitions: compactCount(transitionCount),
  };

  return { stats, ingestedByCounts, featured, whatsNew, liveCounts };
}

export default async function Home() {
  const { stats, ingestedByCounts, featured, whatsNew, liveCounts } = await loadHomepageData();

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
    <HomeHero heroCards={heroCards} liveCounts={liveCounts}>
      <HomepageSections
        stats={stats}
        ingestedByCounts={ingestedByCounts}
        whatsNew={whatsNew}
      />
    </HomeHero>
  );
}
