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

  let rows: RawCityRow[];

  if (category) {
    const pipelines = CATEGORY_PIPELINES[category];
    rows = await prisma.$queryRaw<RawCityRow[]>`
      SELECT
        ROUND(cl.lat::numeric, ${precision}) AS lat,
        ROUND(cl.lon::numeric, ${precision}) AS lon,
        (
          SELECT cl2.city
          FROM "ClaimLocation" cl2
          JOIN "Claim" c2 ON cl2."claimId" = c2.id
          WHERE c2.deleted = false
            AND c2."ingestedBy" = ANY(${pipelines}::text[])
            AND ROUND(cl2.lat::numeric, ${precision}) = ROUND(cl.lat::numeric, ${precision})
            AND ROUND(cl2.lon::numeric, ${precision}) = ROUND(cl.lon::numeric, ${precision})
            AND cl2.city IS NOT NULL
          GROUP BY cl2.city
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS city,
        (
          SELECT cl2."countryCode"
          FROM "ClaimLocation" cl2
          JOIN "Claim" c2 ON cl2."claimId" = c2.id
          WHERE c2.deleted = false
            AND c2."ingestedBy" = ANY(${pipelines}::text[])
            AND ROUND(cl2.lat::numeric, ${precision}) = ROUND(cl.lat::numeric, ${precision})
            AND ROUND(cl2.lon::numeric, ${precision}) = ROUND(cl.lon::numeric, ${precision})
            AND cl2."countryCode" IS NOT NULL
          GROUP BY cl2."countryCode"
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS country_code,
        COUNT(*) AS claim_count
      FROM "ClaimLocation" cl
      JOIN "Claim" c ON cl."claimId" = c.id
      WHERE c.deleted = false
        AND c."ingestedBy" = ANY(${pipelines}::text[])
      GROUP BY ROUND(cl.lat::numeric, ${precision}), ROUND(cl.lon::numeric, ${precision})
      ORDER BY claim_count DESC
    `;
  } else {
    rows = await prisma.$queryRaw<RawCityRow[]>`
      SELECT
        ROUND(cl.lat::numeric, ${precision}) AS lat,
        ROUND(cl.lon::numeric, ${precision}) AS lon,
        (
          SELECT cl2.city
          FROM "ClaimLocation" cl2
          JOIN "Claim" c2 ON cl2."claimId" = c2.id
          WHERE c2.deleted = false
            AND ROUND(cl2.lat::numeric, ${precision}) = ROUND(cl.lat::numeric, ${precision})
            AND ROUND(cl2.lon::numeric, ${precision}) = ROUND(cl.lon::numeric, ${precision})
            AND cl2.city IS NOT NULL
          GROUP BY cl2.city
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS city,
        (
          SELECT cl2."countryCode"
          FROM "ClaimLocation" cl2
          JOIN "Claim" c2 ON cl2."claimId" = c2.id
          WHERE c2.deleted = false
            AND ROUND(cl2.lat::numeric, ${precision}) = ROUND(cl.lat::numeric, ${precision})
            AND ROUND(cl2.lon::numeric, ${precision}) = ROUND(cl.lon::numeric, ${precision})
            AND cl2."countryCode" IS NOT NULL
          GROUP BY cl2."countryCode"
          ORDER BY COUNT(*) DESC
          LIMIT 1
        ) AS country_code,
        COUNT(*) AS claim_count
      FROM "ClaimLocation" cl
      JOIN "Claim" c ON cl."claimId" = c.id
      WHERE c.deleted = false
      GROUP BY ROUND(cl.lat::numeric, ${precision}), ROUND(cl.lon::numeric, ${precision})
      ORDER BY claim_count DESC
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
