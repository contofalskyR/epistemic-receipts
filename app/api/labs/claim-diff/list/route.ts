import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

type Row = {
  claimId: string;
  externalId: string | null;
  text: string;
  snapshotCount: bigint;
  transitionCount: bigint;
  firstYear: number | null;
  lastYear: number | null;
};

export async function GET(_req: NextRequest) {
  // Group ClaimStatusHistory by claim, count those with a snapshot; return
  // only claims where ≥ 2 transitions have a snapshot (the minimum needed to
  // compute one diff).
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      c.id                                                AS "claimId",
      c."externalId"                                      AS "externalId",
      c.text                                              AS "text",
      COUNT(t.id)                                         AS "snapshotCount",
      COUNT(csh.id)                                       AS "transitionCount",
      EXTRACT(YEAR FROM MIN(csh."occurredAt"))::int       AS "firstYear",
      EXTRACT(YEAR FROM MAX(csh."occurredAt"))::int       AS "lastYear"
    FROM "Claim" c
    JOIN "ClaimStatusHistory" csh ON csh."claimId" = c.id
    LEFT JOIN "TransitionClaimsSnapshot" t ON t."claimStatusHistoryId" = csh.id
    WHERE c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" <> 'DEPRECATED')
    GROUP BY c.id, c."externalId", c.text
    HAVING COUNT(t.id) >= 2
    ORDER BY COUNT(t.id) DESC, c.text ASC
  `;

  const list = rows.map((r) => {
    const isCurated = r.externalId?.startsWith("trajectory:") ?? false;
    return {
      id: isCurated
        ? r.externalId!.replace(/^trajectory:/, "")
        : r.claimId,
      claimId: r.claimId,
      claim: r.text.length > 160 ? r.text.slice(0, 157) + "…" : r.text,
      snapshotCount: Number(r.snapshotCount),
      transitionCount: Number(r.transitionCount),
      firstYear: r.firstYear,
      lastYear: r.lastYear,
      isCurated,
    };
  });

  return NextResponse.json({ trajectories: list });
}
