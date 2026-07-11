import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Honest settling-curve counts, split so a same-day administrative promotion
 * (e.g. scripts/bulk-promote-corpus.ts's RECORDED→SETTLED wave, which reuses
 * the baseline's own occurredAt) can never be reported as "movement over
 * time." Both numbers come from one query so they can't drift apart across
 * pages — see AGENTS.md's "derive, never hand-write numbers" rule.
 */
export type SettlingCurveCounts = {
  /** Non-deprecated claims with >=2 dated transitions — the curve has moved past its entry point at least once. */
  totalSettlingCurves: number;
  /** Subset of the above whose transitions land on more than one distinct calendar date. */
  multiDateSettlingCurves: number;
};

type Row = { total: bigint; multiDate: bigint };

export async function getSettlingCurveCounts(): Promise<SettlingCurveCounts> {
  const [row] = await prisma.$queryRaw<Row[]>(Prisma.sql`
    WITH curve_claims AS (
      SELECT
        h."claimId",
        COUNT(DISTINCT date_trunc('day', h."occurredAt")) AS distinct_dates
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c.id = h."claimId"
      WHERE c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
      GROUP BY h."claimId"
      HAVING COUNT(*) >= 2
    )
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE distinct_dates > 1)::bigint AS "multiDate"
    FROM curve_claims
  `);

  return {
    totalSettlingCurves: Number(row?.total ?? 0n),
    multiDateSettlingCurves: Number(row?.multiDate ?? 0n),
  };
}
