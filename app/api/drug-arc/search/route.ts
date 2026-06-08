import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 0;

const DRUG_PIPELINES = ["clinicaltrials_v1", "drugsatfda_v1", "faers_normalized_drugs_v1"] as const;

const PIPELINE_LABEL: Record<string, string> = {
  clinicaltrials_v1: "Clinical Trial",
  drugsatfda_v1: "FDA Approval",
  faers_normalized_drugs_v1: "Adverse Events",
};

const PIPELINE_COLOR: Record<string, string> = {
  clinicaltrials_v1: "blue",
  drugsatfda_v1: "emerald",
  faers_normalized_drugs_v1: "orange",
};

export async function GET(req: NextRequest) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [], query: q });
  }

  const claims = await prisma.claim.findMany({
    where: {
      deleted: false,
      verificationStatus: { not: "DEPRECATED" },
      ingestedBy: { in: [...DRUG_PIPELINES] },
      text: { contains: q, mode: "insensitive" },
    },
    select: {
      id: true,
      text: true,
      ingestedBy: true,
      claimEmergedAt: true,
      metadata: true,
      epistemicStatus: true,
    },
    orderBy: { claimEmergedAt: "asc" },
    take: 30,
  });

  const results = claims.map((c) => {
    const meta = c.metadata as Record<string, unknown> | null;
    const reports = (meta?.total_reports as number | undefined) ?? null;
    return {
      id: c.id,
      text: c.text.length > 200 ? c.text.slice(0, 200) + "…" : c.text,
      pipeline: c.ingestedBy,
      pipelineLabel: PIPELINE_LABEL[c.ingestedBy] ?? c.ingestedBy,
      color: PIPELINE_COLOR[c.ingestedBy] ?? "gray",
      year: c.claimEmergedAt ? new Date(c.claimEmergedAt).getFullYear() : null,
      totalReports: reports,
      epistemicStatus: c.epistemicStatus,
    };
  });

  // Sort: trials first, then approvals, then adverse events, within each group by year asc
  const pipelineOrder = ["clinicaltrials_v1", "drugsatfda_v1", "faers_normalized_drugs_v1"];
  results.sort((a, b) => {
    const ai = pipelineOrder.indexOf(a.pipeline);
    const bi = pipelineOrder.indexOf(b.pipeline);
    if (ai !== bi) return ai - bi;
    return (a.year ?? 9999) - (b.year ?? 9999);
  });

  return NextResponse.json({ results, query: q });
}
