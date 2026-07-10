import type { Metadata } from "next";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeHero from "./HomeHero";
import HomepageSections, { type HomepageStats } from "./HomepageSections";
import { buildSettlingRateAnalysis } from "@/lib/settlingRate";
import { loadRecentTransitions } from "@/lib/feed";
import { compactCount } from "@/lib/format";

export const revalidate = 300;

// V1 landing metadata mirrors the hero copy. No corpus numbers here — metadata
// is built at compile time and hand-written figures would drift from the DB
// (marketing house rule: derived, never hand-written).
export const metadata: Metadata = {
  title: "Epistemic Receipts — how long does “settled” stay settled?",
  description:
    "A research observatory of sourced claims, each carrying a dated epistemic trajectory — recorded, settled, contested, and sometimes reversed.",
};

type IngestedByRow = { ingestedBy: string; count: number };

async function loadHomepageData() {
  const [
    claimCount,
    transitionCount,
    curveCount,
    sourceCount,
    legislativeVoteCount,
    grouped,
    settlingRate,
    datedTrajectoryCount,
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
    // it the domain links silently included the ~138k never-classified claims
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
    // Fig. 1 — the same loader /analysis/settling-rate and the paper figure use,
    // so the homepage curve can never disagree with the published analysis.
    buildSettlingRateAnalysis(),
    // Fig. 1 caption basis: non-deleted trajectories with an emergence date —
    // the exact set lib/settlingRate derives its survival percentages over.
    prisma.claim.count({
      where: {
        deleted: false,
        externalId: { startsWith: "trajectory:" },
        claimEmergedAt: { not: null },
      },
    }),
    loadRecentTransitions(6),
  ]);

  const ingestedByCounts = new Map<string, number>();
  for (const row of grouped) {
    ingestedByCounts.set(row.ingestedBy, Number(row.count));
  }

  // Stats-band numbers derive from the SAME grouped query the domain links use,
  // so the same figure can never differ across one page (audit §8: the stats
  // bar said 26,624 retracted papers while the Retractions tile said 26,679 —
  // the bar counted crossref only, the tile crossref + retraction_watch).
  const sumTags = (...tags: string[]) =>
    tags.reduce((s, t) => s + (ingestedByCounts.get(t) ?? 0), 0);

  const stats: HomepageStats = {
    claims: claimCount,
    transitions: transitionCount,
    settlingCurves: curveCount,
    sources: sourceCount,
    legislativeVotes: legislativeVoteCount,
    retractedPapers: sumTags("crossref_retractions_v1", "retraction_watch_v1"),
  };

  return { claimCount, stats, ingestedByCounts, settlingRate, datedTrajectoryCount, whatsNew };
}

export default async function Home() {
  const { claimCount, stats, ingestedByCounts, settlingRate, datedTrajectoryCount, whatsNew } =
    await loadHomepageData();

  return (
    <>
      <HomeHero
        claimCount={claimCount}
        // Derived, never hand-written (audit item 2 / marketing house rule).
        claimsCompact={compactCount(claimCount)}
        settlingRate={settlingRate}
        datedTrajectoryCount={datedTrajectoryCount}
      />
      <HomepageSections stats={stats} ingestedByCounts={ingestedByCounts} whatsNew={whatsNew} />
    </>
  );
}
