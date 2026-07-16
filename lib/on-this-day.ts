import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { NON_ENGLISH_PIPELINES } from "@/lib/non-english-pipelines";

export const OTD_MAX_ITEMS = 8;

export type OTDRow = {
  claimId: string;
  claimText: string;
  externalId: string | null;
  ingestedBy: string | null;
  fromAxis: string | null;
  toAxis: string;
  occurredAt: Date;
  isMultiStep: boolean;
};

// 4-tier ranking: curated arcs → non-RECORDED transitions → multi-step → single-point entries
export function rankScore(row: OTDRow): number {
  if (row.externalId?.startsWith("trajectory:")) return 0;
  if (row.toAxis !== "RECORDED") return 1;
  if (row.isMultiStep) return 2;
  return 3;
}

export function rankAndFilter(rows: OTDRow[]): OTDRow[] {
  const seen = new Set<string>();
  return rows
    .sort((a, b) => rankScore(a) - rankScore(b) || a.occurredAt.getTime() - b.occurredAt.getTime())
    .filter((r) => {
      if (seen.has(r.claimId)) return false;
      seen.add(r.claimId);
      return true;
    })
    .slice(0, OTD_MAX_ITEMS);
}

export async function selectTodayRows(): Promise<OTDRow[]> {
  const now = new Date();
  const mm = now.getUTCMonth() + 1;
  const dd = now.getUTCDate();
  const nonEnglish = Array.from(NON_ENGLISH_PIPELINES);

  const rows = await prisma.$queryRaw<OTDRow[]>(
    Prisma.sql`
      SELECT
        c.id AS "claimId",
        LEFT(c.text, 120) AS "claimText",
        c."externalId",
        c."ingestedBy",
        csh."fromAxis",
        csh."toAxis",
        csh."occurredAt",
        EXISTS (
          SELECT 1 FROM "ClaimStatusHistory" csh2
          WHERE csh2."claimId" = c.id AND csh2."fromAxis" IS NOT NULL
        ) AS "isMultiStep"
      FROM "ClaimStatusHistory" csh
      JOIN "Claim" c ON c.id = csh."claimId"
      WHERE csh."datePrecision" = 'DAY'
        AND EXTRACT(MONTH FROM csh."occurredAt") = ${mm}
        AND EXTRACT(DAY   FROM csh."occurredAt") = ${dd}
        AND c.deleted = false
        AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
        AND (c."ingestedBy" IS NULL OR c."ingestedBy" != ALL(${nonEnglish}::text[]))
      LIMIT ${OTD_MAX_ITEMS * 6}
    `
  );

  return rows;
}
