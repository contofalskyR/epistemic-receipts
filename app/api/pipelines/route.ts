import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const [claimCounts, sourceCounts] = await Promise.all([
    prisma.claim.groupBy({
      by: ["ingestedBy"],
      _count: { _all: true },
      where: { deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.source.groupBy({
      by: ["ingestedBy"],
      _count: { _all: true },
      where: { deleted: false },
    }),
  ]);

  const allTags = new Set([
    ...claimCounts.map((r) => r.ingestedBy),
    ...sourceCounts.map((r) => r.ingestedBy),
  ]);

  const pipelines = Array.from(allTags).map((tag) => ({
    ingestedBy: tag,
    claimCount: claimCounts.find((r) => r.ingestedBy === tag)?._count._all ?? 0,
    sourceCount: sourceCounts.find((r) => r.ingestedBy === tag)?._count._all ?? 0,
  }));

  return NextResponse.json({ pipelines });
}
