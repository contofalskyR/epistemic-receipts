import type { Metadata } from "next";
import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import HomeHero from "./HomeHero";
import HomeCarousel from "./HomeCarousel";
import HomepageSections, { type HomepageStats } from "./HomepageSections";
import { buildSettlingRateAnalysis } from "@/lib/settlingRate";
import { loadRecentTransitions } from "@/lib/feed";
import { compactCount } from "@/lib/format";
import { getSettlingCurveCounts } from "@/lib/curve-counts";

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
    curveCounts,
    sourceCount,
    legislativeVoteCount,
    grouped,
    settlingRate,
    datedTrajectoryCount,
    whatsNew,
  ] = await Promise.all([
    prisma.claim.count({ where: { verificationStatus: { not: "DEPRECATED" } } }),
    prisma.claimStatusHistory.count(),
    // Split so a same-day bulk promotion (bulk-promote-corpus.ts) can never
    // read as "movement over time" — see lib/curve-counts.ts.
    getSettlingCurveCounts(),
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
    settlingCurves: curveCounts.totalSettlingCurves,
    settlingCurvesMultiDate: curveCounts.multiDateSettlingCurves,
    sources: sourceCount,
    legislativeVotes: legislativeVoteCount,
    retractedPapers: sumTags("crossref_retractions_v1", "retraction_watch_v1"),
  };

  return { claimCount, transitionCount, stats, ingestedByCounts, settlingRate, datedTrajectoryCount, whatsNew };
}

export default async function Home() {
  const { claimCount, transitionCount, stats, ingestedByCounts, settlingRate, datedTrajectoryCount, whatsNew } =
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
      {/* Claim example carousel — below the macro settling curve */}
      <div className="mx-auto max-w-5xl pb-4 pt-10">
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_420px]">
          <div className="flex flex-col justify-center gap-6">
            <div>
              <p className="text-[11px] font-mono uppercase tracking-[0.14em] text-amber-400/90">
                Claim provenance database
              </p>
              <h2 className="mt-4 text-[clamp(26px,3.4vw,38px)] font-semibold leading-[1.16] text-gray-100">
                Track the status of every claim — when it was established, changed, or overturned.
              </h2>
              <p className="mt-3.5 max-w-[52ch] text-base leading-relaxed text-gray-400">
                A live record of epistemic status across science, law, and history.{" "}
                <strong className="text-gray-200">{compactCount(claimCount)}</strong> claims, each
                sourced and traceable, carrying{" "}
                <strong className="text-gray-200">{compactCount(transitionCount)}</strong>{" "}
                dated status transitions. Search any topic, follow the evidence trail, and see how each
                claim&apos;s status shifted over time.
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <Link
                href="/settling-curve"
                className="inline-block w-fit rounded-lg bg-amber-400 px-5 py-3 text-sm font-medium text-gray-950 transition-colors hover:bg-amber-300"
              >
                Explore the Settling Curve →
              </Link>
              <Link
                href="/search?q=semaglutide"
                className="text-sm text-amber-400/80 transition-colors hover:text-amber-300 hover:underline underline-offset-4"
              >
                View a sample trajectory: semaglutide (GLP-1) →
              </Link>
            </div>
          </div>
          <HomeCarousel />
        </div>
      </div>
      <HomepageSections stats={stats} ingestedByCounts={ingestedByCounts} whatsNew={whatsNew} />
    </>
  );
}
