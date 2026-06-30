import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type YearAxisRow = { year: number | null; axis: string | null; n: bigint };
type BoundsRow = {
  earliest_year: number | null;
  latest_year: number | null;
  total_dated: bigint;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  // Per-year, per-axis density of dated claims on this topic.
  const rows = await prisma.$queryRaw<YearAxisRow[]>(Prisma.sql`
    SELECT
      EXTRACT(YEAR FROM c."claimEmergedAt")::int AS year,
      c."epistemicAxis" AS axis,
      COUNT(*) AS n
    FROM "Claim" c
    JOIN "ClaimTopic" ct ON ct."claimId" = c.id
    JOIN "Topic" t ON t.id = ct."topicId"
    WHERE t.slug = ${slug}
      AND c."claimEmergedAt" IS NOT NULL
      AND c.deleted = false
    GROUP BY year, axis
    ORDER BY year
  `);

  const [bounds] = await prisma.$queryRaw<BoundsRow[]>(Prisma.sql`
    SELECT
      MIN(EXTRACT(YEAR FROM c."claimEmergedAt")::int) AS earliest_year,
      MAX(EXTRACT(YEAR FROM c."claimEmergedAt")::int) AS latest_year,
      COUNT(*) AS total_dated
    FROM "Claim" c
    JOIN "ClaimTopic" ct ON ct."claimId" = c.id
    JOIN "Topic" t ON t.id = ct."topicId"
    WHERE t.slug = ${slug}
      AND c."claimEmergedAt" IS NOT NULL
      AND c.deleted = false
  `);

  const [{ total_claims }] = await prisma.$queryRaw<{ total_claims: bigint }[]>(Prisma.sql`
    SELECT COUNT(*) AS total_claims
    FROM "Claim" c
    JOIN "ClaimTopic" ct ON ct."claimId" = c.id
    JOIN "Topic" t ON t.id = ct."topicId"
    WHERE t.slug = ${slug}
      AND c.deleted = false
  `);

  // Any REVERSED (retraction) relations touching a claim on this topic.
  const [{ has_reversals }] = await prisma.$queryRaw<{ has_reversals: boolean }[]>(Prisma.sql`
    SELECT EXISTS (
      SELECT 1
      FROM "ClaimRelation" r
      JOIN "ClaimTopic" ct
        ON ct."claimId" = r."fromClaimId" OR ct."claimId" = r."toClaimId"
      JOIN "Topic" t ON t.id = ct."topicId"
      WHERE t.slug = ${slug}
        AND r."relationType" = 'REVERSED'
    ) AS has_reversals
  `);

  const totalDated = bounds?.total_dated != null ? Number(bounds.total_dated) : 0;

  if (totalDated < 3) {
    const res = NextResponse.json({ timeline: [], insufficient: true });
    res.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    return res;
  }

  const timeline = rows
    .filter(r => r.year != null)
    .map(r => ({ year: r.year as number, axis: r.axis, n: Number(r.n) }));

  const res = NextResponse.json({
    timeline,
    earliest_year: bounds?.earliest_year ?? null,
    latest_year: bounds?.latest_year ?? null,
    total_dated: totalDated,
    total_claims: total_claims != null ? Number(total_claims) : 0,
    has_reversals: Boolean(has_reversals),
    insufficient: false,
  });
  res.headers.set("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
  return res;
}
