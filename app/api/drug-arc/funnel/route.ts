import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export async function GET() {
  const [trials, approvals, adverseEvents, outcomeLinks] = await Promise.all([
    prisma.claim.count({
      where: { ingestedBy: "clinicaltrials_v1", deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.claim.count({
      where: { ingestedBy: "drugsatfda_v1", deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.claim.count({
      where: { ingestedBy: "faers_normalized_drugs_v1", deleted: false, verificationStatus: { not: "DEPRECATED" } },
    }),
    prisma.claimRelation.count({
      where: {
        relationType: "OUTCOME",
        fromClaim: { ingestedBy: "clinicaltrials_v1", deleted: false },
        toClaim: { ingestedBy: "drugsatfda_v1", deleted: false },
      },
    }),
  ]);

  return NextResponse.json({
    stages: [
      {
        key: "trials",
        label: "Clinical Trials",
        sublabel: "Registered & completed trials in the public record",
        count: trials,
        pipeline: "clinicaltrials_v1",
        color: "blue",
      },
      {
        key: "approvals",
        label: "FDA Approvals",
        sublabel: "NDA/BLA decisions — original applications approved",
        count: approvals,
        pipeline: "drugsatfda_v1",
        color: "emerald",
      },
      {
        key: "adverseEvents",
        label: "Post-Market Surveillance",
        sublabel: "Drugs with FAERS adverse event report aggregates",
        count: adverseEvents,
        pipeline: "faers_normalized_drugs_v1",
        color: "orange",
      },
      {
        key: "outcomeLinks",
        label: "Trial → Approval Links",
        sublabel: "Verified OUTCOME relations connecting trials to approvals",
        count: outcomeLinks,
        pipeline: "ClaimRelation:OUTCOME",
        color: "violet",
      },
    ],
  });
}
