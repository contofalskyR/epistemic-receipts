import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_CODE_TO_NAME } from "@/lib/countryCodeMap";
import { COUNTRY_TO_PIPELINES } from "@/lib/globe-pipeline-country";

export const revalidate = 3600;

type ClaimRow = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  createdAt: Date;
  ingestedBy: string;
};

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

  const pipelines = COUNTRY_TO_PIPELINES[upperCode] ?? [];

  // Count distinct claims that are either PoliticalContext-linked to this
  // country OR ingested by one of its country-specific pipelines.
  const whereUnion =
    pipelines.length === 0
      ? {
          deleted: false,
          edges: {
            some: {
              deleted: false,
              source: { politicalContext: { country: countryName } },
            },
          },
        }
      : {
          deleted: false,
          OR: [
            {
              edges: {
                some: {
                  deleted: false,
                  source: { politicalContext: { country: countryName } },
                },
              },
            },
            { ingestedBy: { in: pipelines } },
          ],
        };

  const [claimCount, pcRecent, pipelineRecent] = await Promise.all([
    prisma.claim.count({ where: whereUnion }),
    prisma.claim.findMany({
      where: {
        deleted: false,
        edges: {
          some: {
            deleted: false,
            source: { politicalContext: { country: countryName } },
          },
        },
      },
      select: {
        id: true,
        text: true,
        currentStatus: true,
        claimType: true,
        createdAt: true,
        ingestedBy: true,
      },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    pipelines.length === 0
      ? Promise.resolve([] as ClaimRow[])
      : prisma.claim.findMany({
          where: { deleted: false, ingestedBy: { in: pipelines } },
          select: {
            id: true,
            text: true,
            currentStatus: true,
            claimType: true,
            createdAt: true,
            ingestedBy: true,
          },
          orderBy: { createdAt: "desc" },
          take: 25,
        }),
  ]);

  // Merge and dedupe recent claims (a claim can match both buckets).
  const merged = new Map<string, ClaimRow>();
  for (const c of [...pcRecent, ...pipelineRecent]) {
    if (!merged.has(c.id)) merged.set(c.id, c);
  }
  const recentClaims = Array.from(merged.values())
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return NextResponse.json({
    countryCode: upperCode,
    countryName,
    claimCount,
    recentClaims,
  });
}
