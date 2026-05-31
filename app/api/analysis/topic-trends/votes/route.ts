import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ERAS } from "@/lib/us-presidents";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const topic = searchParams.get("topic");
  const eraLabel = searchParams.get("era");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 50);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  if (!topic || !eraLabel) {
    return NextResponse.json({ error: "topic and era are required" }, { status: 400 });
  }

  const era = ERAS.find((e) => e.label === eraLabel);
  if (!era) {
    return NextResponse.json({ error: "Unknown era" }, { status: 404 });
  }

  const eraStart = new Date(`${era.start}T00:00:00.000Z`);
  const eraEnd = new Date(`${era.end}T23:59:59.999Z`);
  const topicJson = JSON.stringify([topic]);

  const [countResult, votes] = await Promise.all([
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) as count
      FROM "LegislativeVote" lv
      JOIN "Source" s ON s.id = lv."sourceId"
      WHERE s."ingestedBy" = 'voteview_v1'
        AND lv.topics IS NOT NULL
        AND lv."voteDate" >= ${eraStart}
        AND lv."voteDate" <= ${eraEnd}
        AND lv.topics::jsonb @> ${topicJson}::jsonb
    `,
    prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        voteDate: Date | null;
        chamber: string;
        result: string | null;
        yesCount: number | null;
        noCount: number | null;
        url: string | null;
      }>
    >`
      SELECT lv.id, s.name AS title, lv."voteDate", lv.chamber, lv.result, lv."yesCount", lv."noCount", s.url
      FROM "LegislativeVote" lv
      JOIN "Source" s ON s.id = lv."sourceId"
      WHERE s."ingestedBy" = 'voteview_v1'
        AND lv.topics IS NOT NULL
        AND lv."voteDate" >= ${eraStart}
        AND lv."voteDate" <= ${eraEnd}
        AND lv.topics::jsonb @> ${topicJson}::jsonb
      ORDER BY lv."voteDate" ASC
      LIMIT ${limit} OFFSET ${offset}
    `,
  ]);

  return NextResponse.json({
    votes,
    total: Number(countResult[0]?.count ?? 0),
  });
}
