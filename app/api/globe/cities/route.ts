import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CATEGORY_PIPELINES, isCategorySlug } from "@/lib/globe-categories";

export const revalidate = 3600;

type RawCityRow = {
  lat: number;
  lon: number;
  city: string | null;
  country_code: string | null;
  claim_count: bigint;
};

export async function GET(request: NextRequest) {
  const zoomParam = request.nextUrl.searchParams.get("zoom");
  const zoom = zoomParam ? parseInt(zoomParam, 10) : 1;
  const precision = zoom >= 3 ? 2 : 1;

  const categoryParam = request.nextUrl.searchParams.get("category");
  const category = isCategorySlug(categoryParam) ? categoryParam : null;

  const MAX_ROWS = 12000;

  let rows: RawCityRow[];

  if (category) {
    const pipelines = CATEGORY_PIPELINES[category];
    rows = await prisma.$queryRaw<RawCityRow[]>`
      SELECT
        ROUND(cl.lat::numeric, ${precision})::float8 AS lat,
        ROUND(cl.lon::numeric, ${precision})::float8 AS lon,
        mode() WITHIN GROUP (ORDER BY cl.city) AS city,
        mode() WITHIN GROUP (ORDER BY cl."countryCode") AS country_code,
        COUNT(*) AS claim_count
      FROM "ClaimLocation" cl
      JOIN "Claim" c ON cl."claimId" = c.id
      WHERE c.deleted = false
      AND c."ingestedBy" = ANY(${pipelines}::text[])
      GROUP BY ROUND(cl.lat::numeric, ${precision}), ROUND(cl.lon::numeric, ${precision})
      ORDER BY claim_count DESC
      LIMIT ${MAX_ROWS}
    `;
  } else {
    rows = await prisma.$queryRaw<RawCityRow[]>`
      SELECT
        ROUND(cl.lat::numeric, ${precision})::float8 AS lat,
        ROUND(cl.lon::numeric, ${precision})::float8 AS lon,
        mode() WITHIN GROUP (ORDER BY cl.city) AS city,
        mode() WITHIN GROUP (ORDER BY cl."countryCode") AS country_code,
        COUNT(*) AS claim_count
      FROM "ClaimLocation" cl
      JOIN "Claim" c ON cl."claimId" = c.id
      WHERE c.deleted = false
      GROUP BY ROUND(cl.lat::numeric, ${precision}), ROUND(cl.lon::numeric, ${precision})
      ORDER BY claim_count DESC
      LIMIT ${MAX_ROWS}
    `;
  }

  const result = rows.map((row) => ({
    lat: Number(row.lat),
    lon: Number(row.lon),
    city: row.city ?? null,
    countryCode: row.country_code ?? null,
    claimCount: Number(row.claim_count),
  }));

  return NextResponse.json(result);
}
