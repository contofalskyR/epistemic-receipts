/**
 * lib/dormancy.ts — dormancy queries for CONTESTED claims.
 *
 * Source of truth shared by /open-questions and the settling-curve-lifetimes
 * finding, so neither can disagree with the other.
 *
 * "Dormancy" = time elapsed since MAX(occurredAt) on a claim's status history.
 * A long gap is information, not a defect — copy everywhere must reflect that.
 */

import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export type DormantClaim = {
  claimId: string;
  text: string;
  lastTransitionYear: number;
  dormancyYears: number;
};

export type WokenClaim = {
  claimId: string;
  text: string;
  lastTransitionYear: number;
  dormancyYears: number;
};

const WOKEN_DORMANCY_THRESHOLD_YEARS = 5;
const WOKEN_RECENT_DAYS = 90;

/**
 * Top-N CONTESTED claims ranked by longest dormancy (oldest last transition).
 * Excludes soft-deleted and DEPRECATED.
 */
export async function loadDormantContested(limit = 50): Promise<DormantClaim[]> {
  const rows = await prisma.$queryRaw<
    { claimId: string; text: string; lastOccurredAt: Date }[]
  >(
    Prisma.sql`
      SELECT
        c.id AS "claimId",
        LEFT(c.text, 200) AS text,
        MAX(csh."occurredAt") AS "lastOccurredAt"
      FROM "Claim" c
      JOIN "ClaimStatusHistory" csh ON csh."claimId" = c.id
      WHERE c."epistemicAxis" = 'CONTESTED'
        AND c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
      GROUP BY c.id, c.text
      ORDER BY MAX(csh."occurredAt") ASC
      LIMIT ${limit}
    `
  );

  const nowYear = new Date().getUTCFullYear();
  return rows.map((r) => {
    const lastYear = r.lastOccurredAt.getUTCFullYear();
    return {
      claimId: r.claimId,
      text: r.text,
      lastTransitionYear: lastYear,
      dormancyYears: Math.max(0, nowYear - lastYear),
    };
  });
}

/**
 * Long-dormant CONTESTED claims (≥5 yrs) whose latest transition is recent (<90d).
 * Returns empty array if the set is empty — caller must suppress the strip.
 */
export async function loadRecentlyWoken(): Promise<WokenClaim[]> {
  const threshold = new Date();
  threshold.setUTCFullYear(threshold.getUTCFullYear() - WOKEN_DORMANCY_THRESHOLD_YEARS);

  const recentCutoff = new Date();
  recentCutoff.setUTCDate(recentCutoff.getUTCDate() - WOKEN_RECENT_DAYS);

  const rows = await prisma.$queryRaw<
    { claimId: string; text: string; lastOccurredAt: Date; firstOccurredAt: Date }[]
  >(
    Prisma.sql`
      SELECT
        c.id AS "claimId",
        LEFT(c.text, 200) AS text,
        MAX(csh."occurredAt") AS "lastOccurredAt",
        MIN(csh."occurredAt") AS "firstOccurredAt"
      FROM "Claim" c
      JOIN "ClaimStatusHistory" csh ON csh."claimId" = c.id
      WHERE c."epistemicAxis" = 'CONTESTED'
        AND c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
      GROUP BY c.id, c.text
      HAVING
        MAX(csh."occurredAt") >= ${recentCutoff}
        AND MIN(csh."occurredAt") <= ${threshold}
      ORDER BY (MAX(csh."occurredAt") - MIN(csh."occurredAt")) DESC
      LIMIT 10
    `
  );

  const nowYear = new Date().getUTCFullYear();
  return rows.map((r) => {
    const firstYear = r.firstOccurredAt.getUTCFullYear();
    const lastYear = r.lastOccurredAt.getUTCFullYear();
    return {
      claimId: r.claimId,
      text: r.text,
      lastTransitionYear: lastYear,
      dormancyYears: Math.max(0, nowYear - firstYear),
    };
  });
}
