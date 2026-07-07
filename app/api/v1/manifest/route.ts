import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PIPELINES } from "@/lib/pipelines/registry";

export const revalidate = 3600;

export async function GET() {
  const tags = PIPELINES.map(p => p.tag);

  const [claimGroups, pipelineRuns] = await Promise.all([
    prisma.claim.groupBy({
      by: ["ingestedBy", "verificationStatus", "humanReviewed", "autoApproved"],
      where: { ingestedBy: { in: tags }, deleted: false },
      _count: { _all: true },
    }),
    prisma.pipelineRun.findMany({
      where: { pipelineTag: { in: tags }, status: "done" },
      orderBy: { finishedAt: "desc" },
      select: { pipelineTag: true, finishedAt: true },
      distinct: ["pipelineTag"],
    }),
  ]);

  const lastRunByTag = new Map(
    pipelineRuns.map(r => [r.pipelineTag, r.finishedAt]),
  );

  const manifest = PIPELINES.map(p => {
    const rows = claimGroups.filter(r => r.ingestedBy === p.tag);
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const humanReviewedCount = rows
      .filter(r => r.humanReviewed)
      .reduce((s, r) => s + r._count._all, 0);
    const autoApprovedCount = rows
      .filter(r => r.autoApproved)
      .reduce((s, r) => s + r._count._all, 0);
    const verificationMix: Record<string, number> = {};
    for (const r of rows) {
      const key = r.verificationStatus ?? "null";
      verificationMix[key] = (verificationMix[key] ?? 0) + r._count._all;
    }

    return {
      tag: p.tag,
      name: p.name,
      retired: p.retired ?? false,
      upstreamName: p.upstreamName,
      upstreamUrl: p.upstreamUrl,
      method: p.method,
      cadence: p.cadence,
      caveats: p.caveats ?? null,
      counts: {
        total,
        humanReviewed: humanReviewedCount,
        autoApproved: autoApprovedCount,
        verificationMix,
      },
      lastRunAt: lastRunByTag.get(p.tag)?.toISOString() ?? null,
      license: "see /license",
      licenseUrl: "https://epistemic-receipts.vercel.app/license",
    };
  });

  return NextResponse.json(manifest, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
      "X-License": "ER-Community-1.0",
    },
  });
}
