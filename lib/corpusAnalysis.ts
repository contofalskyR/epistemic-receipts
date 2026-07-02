import "server-only";
import { prisma } from "@/lib/prisma";

// Aggregate analysis over the full ClaimStatusHistory corpus (Layer-1
// baselines: ~1.6M rows), NOT the curated "trajectory:" claims. Uses raw
// SQL for all aggregations, which is far faster than the Prisma ORM at
// this row count.

export interface CorpusData {
  totalHistoryRows: number;
  totalUniqueClaims: number;
  multiStepClaims: number; // claims with >1 history row
  statusDistribution: Array<{ axis: string; count: number; pct: number }>;
  communityDistribution: Array<{ community: string; count: number; pct: number }>;
  topTransitions: Array<{ from: string; to: string; count: number }>;
  yearlyEmergence: Array<{ year: number; count: number }>; // from occurredAt where fromAxis IS NULL
  topPipelines: Array<{ pipeline: string; count: number }>; // join to Claim.ingestedBy
}

export async function buildCorpusAnalysis(): Promise<CorpusData> {
  const [
    totals,
    multiStep,
    statusRows,
    communityRows,
    transitionRows,
    yearRows,
    pipelineRows,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ total: bigint; unique_claims: bigint }>>`
      SELECT COUNT(*) as total, COUNT(DISTINCT "claimId") as unique_claims
      FROM "ClaimStatusHistory"
    `,
    prisma.$queryRaw<Array<{ count: bigint }>>`
      SELECT COUNT(*) as count FROM (
        SELECT "claimId" FROM "ClaimStatusHistory"
        GROUP BY "claimId" HAVING COUNT(*) > 1
      ) sub
    `,
    prisma.$queryRaw<Array<{ toAxis: string; count: bigint }>>`
      SELECT "toAxis", COUNT(*) as count
      FROM "ClaimStatusHistory"
      WHERE "fromAxis" IS NULL
      GROUP BY "toAxis"
      ORDER BY count DESC
    `,
    prisma.$queryRaw<Array<{ community: string; count: bigint }>>`
      SELECT community, COUNT(*) as count
      FROM "ClaimStatusHistory"
      WHERE "fromAxis" IS NULL AND community IS NOT NULL
      GROUP BY community
      ORDER BY count DESC
    `,
    prisma.$queryRaw<Array<{ fromAxis: string; toAxis: string; count: bigint }>>`
      SELECT "fromAxis", "toAxis", COUNT(*) as count
      FROM "ClaimStatusHistory"
      WHERE "fromAxis" IS NOT NULL
      GROUP BY "fromAxis", "toAxis"
      ORDER BY count DESC
      LIMIT 20
    `,
    prisma.$queryRaw<Array<{ year: number; count: bigint }>>`
      SELECT EXTRACT(YEAR FROM "occurredAt") as year, COUNT(*) as count
      FROM "ClaimStatusHistory"
      WHERE "fromAxis" IS NULL
      GROUP BY year
      ORDER BY year
    `,
    prisma.$queryRaw<Array<{ ingestedBy: string; count: bigint }>>`
      SELECT c."ingestedBy", COUNT(*) as count
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON h."claimId" = c.id
      WHERE h."fromAxis" IS NULL
      GROUP BY c."ingestedBy"
      ORDER BY count DESC
      LIMIT 20
    `,
  ]);

  const totalHistoryRows = Number(totals[0]?.total ?? 0);
  const totalUniqueClaims = Number(totals[0]?.unique_claims ?? 0);
  const multiStepClaims = Number(multiStep[0]?.count ?? 0);

  const statusTotal = statusRows.reduce((s, r) => s + Number(r.count), 0) || 1;
  const statusDistribution = statusRows.map((r) => {
    const count = Number(r.count);
    return {
      axis: r.toAxis,
      count,
      pct: Math.round((count / statusTotal) * 1000) / 10,
    };
  });

  const communityTotal =
    communityRows.reduce((s, r) => s + Number(r.count), 0) || 1;
  const communityDistribution = communityRows.map((r) => {
    const count = Number(r.count);
    return {
      community: r.community,
      count,
      pct: Math.round((count / communityTotal) * 1000) / 10,
    };
  });

  const topTransitions = transitionRows.map((r) => ({
    from: r.fromAxis,
    to: r.toAxis,
    count: Number(r.count),
  }));

  const yearlyEmergence = yearRows
    .map((r) => ({ year: Number(r.year), count: Number(r.count) }))
    .filter((r) => Number.isFinite(r.year));

  const topPipelines = pipelineRows.map((r) => ({
    pipeline: r.ingestedBy,
    count: Number(r.count),
  }));

  return {
    totalHistoryRows,
    totalUniqueClaims,
    multiStepClaims,
    statusDistribution,
    communityDistribution,
    topTransitions,
    yearlyEmergence,
    topPipelines,
  };
}
