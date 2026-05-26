import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PIPELINE_ORIGINS } from "@/lib/globe-origins";

export const revalidate = 3600;
export const revalidate = 3600;

export type OriginPoint = {
  city: string;
  lat: number;
  lon: number;
  claimCount: number;
  pipelines: string[];
};

export async function GET() {
  type Row = { ingestedBy: string; claim_count: bigint };
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT "ingestedBy", COUNT(*) AS claim_count
    FROM "Claim"
    WHERE deleted = false AND "ingestedBy" IS NOT NULL
    GROUP BY "ingestedBy"
  `;

  // Merge pipelines at the same city
  const cityMap = new Map<string, OriginPoint>();
  for (const row of rows) {
    const origin = PIPELINE_ORIGINS[row.ingestedBy];
    if (!origin) continue;
    const key = `${origin.lat.toFixed(2)},${origin.lon.toFixed(2)}`;
    const existing = cityMap.get(key);
    if (existing) {
      existing.claimCount += Number(row.claim_count);
      existing.pipelines.push(row.ingestedBy);
    } else {
      cityMap.set(key, {
        city: origin.city,
        lat: origin.lat,
        lon: origin.lon,
        claimCount: Number(row.claim_count),
        pipelines: [row.ingestedBy],
      });
    }
  }

  const result = Array.from(cityMap.values()).sort((a, b) => b.claimCount - a.claimCount);
  return NextResponse.json(result);
}
