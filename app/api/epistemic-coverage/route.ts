import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [total, byAxis, byCommunity, byDecadeRaw, topPipelinesRaw] =
    await Promise.all([
      prisma.claimStatusHistory.count(),

      prisma.claimStatusHistory.groupBy({
        by: ["toAxis"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      prisma.claimStatusHistory.groupBy({
        by: ["community"],
        _count: { id: true },
        orderBy: { _count: { id: "desc" } },
      }),

      prisma.$queryRaw<{ decade: number; count: bigint }[]>`
        SELECT FLOOR(EXTRACT(YEAR FROM "occurredAt") / 10) * 10 AS decade,
               COUNT(*) AS count
        FROM "ClaimStatusHistory"
        WHERE EXTRACT(YEAR FROM "occurredAt") BETWEEN 1800 AND 2030
        GROUP BY decade
        ORDER BY decade
      `,

      prisma.$queryRaw<{ pipeline: string; count: bigint }[]>`
        SELECT c."ingestedBy" AS pipeline, COUNT(*) AS count
        FROM "ClaimStatusHistory" csh
        JOIN "Claim" c ON c.id = csh."claimId"
        WHERE c."ingestedBy" IS NOT NULL
        GROUP BY c."ingestedBy"
        ORDER BY count DESC
        LIMIT 20
      `,
    ]);

  return NextResponse.json({
    total,
    byAxis: byAxis.map((r) => ({ axis: r.toAxis, count: r._count.id })),
    byCommunity: byCommunity.map((r) => ({
      community: r.community,
      count: r._count.id,
    })),
    byDecade: byDecadeRaw.map((r) => ({
      decade: Number(r.decade),
      count: Number(r.count),
    })),
    topPipelines: topPipelinesRaw.map((r) => ({
      pipeline: r.pipeline,
      count: Number(r.count),
    })),
  });
}
