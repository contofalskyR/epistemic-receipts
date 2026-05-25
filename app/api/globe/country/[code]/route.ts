import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_CODE_TO_NAME } from "@/lib/countryCodeMap";

export const revalidate = 3600;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const upperCode = code.toUpperCase();
  const countryName = COUNTRY_CODE_TO_NAME[upperCode];

  if (!countryName) {
    return NextResponse.json({ error: "Unknown country code" }, { status: 404 });
  }

  // Get sources with PoliticalContext for this country
  const sources = await prisma.source.findMany({
    where: { politicalContext: { country: countryName } },
    select: {
      id: true,
      edges: {
        where: { deleted: false },
        select: {
          claim: {
            select: {
              id: true,
              text: true,
              currentStatus: true,
              claimType: true,
              createdAt: true,
              ingestedBy: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      },
    },
  });

  // Collect unique claims, deduplicated by claimId
  const seen = new Set<string>();
  const recentClaims: Array<{
    id: string;
    text: string;
    currentStatus: string;
    claimType: string;
    createdAt: Date;
    ingestedBy: string;
  }> = [];

  for (const source of sources) {
    for (const edge of source.edges) {
      if (!seen.has(edge.claim.id)) {
        seen.add(edge.claim.id);
        recentClaims.push(edge.claim);
      }
    }
  }

  recentClaims.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return NextResponse.json({
    countryCode: upperCode,
    countryName,
    claimCount: recentClaims.length,
    recentClaims: recentClaims.slice(0, 10),
  });
}
