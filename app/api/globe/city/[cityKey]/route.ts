import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

type RawLocationRow = {
  claimId: string;
  city: string | null;
  countryCode: string | null;
  lat: number;
  lon: number;
};

type RawClaimRow = {
  id: string;
  title: string | null;
  claimType: string;
  ingestedBy: string;
  epistemicAxis: string | null;
  createdAt: Date;
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cityKey: string }> }
) {
  const { cityKey } = await params;
  // cityKey format: "{lat}_{lon}" e.g. "40.7_-74.0" or "-33.9_151.2". Use lastIndexOf to split.
  const splitIdx = cityKey.lastIndexOf("_");
  if (splitIdx === -1) {
    return NextResponse.json({ error: "Invalid cityKey" }, { status: 400 });
  }
  const latStr = cityKey.slice(0, splitIdx);
  const lonStr = cityKey.slice(splitIdx + 1);
  const lat = parseFloat(latStr);
  const lon = parseFloat(lonStr);

  if (isNaN(lat) || isNaN(lon)) {
    return NextResponse.json({ error: "Invalid cityKey" }, { status: 400 });
  }

  const page = Math.max(1, parseInt(request.nextUrl.searchParams.get("page") ?? "1", 10));
  const rawLimit = parseInt(request.nextUrl.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(50, Math.max(1, isNaN(rawLimit) ? 20 : rawLimit));
  const offset = (page - 1) * limit;

  // Use queryRaw to avoid float comparison issues
  const locations = await prisma.$queryRaw<RawLocationRow[]>`
    SELECT DISTINCT ON ("claimId") "claimId", city, "countryCode", lat, lon
    FROM "ClaimLocation"
    WHERE ROUND(lat::numeric, 1) = ${lat}
      AND ROUND(lon::numeric, 1) = ${lon}
  `;

  if (locations.length === 0) {
    return NextResponse.json({
      city: null,
      countryCode: null,
      lat,
      lon,
      total: 0,
      claims: [],
    });
  }

  const { city, countryCode } = locations[0];
  const claimIds = locations.map((r) => r.claimId);
  const total = claimIds.length;

  const paginatedIds = claimIds.slice(offset, offset + limit);

  const claims = await prisma.$queryRaw<RawClaimRow[]>`
    SELECT id, title, "claimType", "ingestedBy", "epistemicAxis", "createdAt"
    FROM "Claim"
    WHERE id = ANY(${paginatedIds}::text[])
    ORDER BY "createdAt" DESC
  `;

  return NextResponse.json({
    city,
    countryCode,
    lat,
    lon,
    total,
    claims: claims.map((c) => ({
      id: c.id,
      title: c.title,
      claimType: c.claimType,
      ingestedBy: c.ingestedBy,
      epistemicAxis: c.epistemicAxis,
      createdAt: c.createdAt,
    })),
  });
}
