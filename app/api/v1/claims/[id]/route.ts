import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { computeProvenanceGrade, GRADE_DESCRIPTIONS } from "@/lib/v1/provenance";
import { v1Json, v1Error, methodNotAllowed, notFound } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyApiKey(req, "claims");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const { id } = await params;

  const claim = await readPrisma.claim.findUnique({
    where: { id, deleted: false },
    include: {
      edges: {
        where: { deleted: false },
        include: {
          source: {
            select: {
              id: true,
              name: true,
              url: true,
              methodologyType: true,
              publishedAt: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      },
      statusHistory: {
        orderBy: { occurredAt: "asc" },
        select: {
          id: true,
          fromAxis: true,
          toAxis: true,
          community: true,
          reason: true,
          occurredAt: true,
          datePrecision: true,
          sourceId: true,
        },
      },
      relationsFrom: {
        include: { toClaim: { select: { id: true } } },
      },
      relationsTo: {
        include: { fromClaim: { select: { id: true } } },
      },
      topics: {
        include: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
      },
    },
  });

  if (!claim) return notFound(`Claim ${id} not found.`);

  const primaryEdges = claim.edges.filter(e => e.source.methodologyType === "primary").length;
  const grade = computeProvenanceGrade({
    humanReviewed: claim.humanReviewed,
    autoApproved: claim.autoApproved,
    verificationStatus: claim.verificationStatus,
    epistemicAxis: claim.epistemicAxis,
    primarySourceEdgeCount: primaryEdges,
  });

  const etag = claim.updatedAt.getTime().toString(16);
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === `"${etag}"`) {
    return new Response(null, { status: 304 });
  }

  const relations = [
    ...claim.relationsFrom.map(r => ({
      id: r.id,
      relationType: r.relationType,
      relatedClaimId: r.toClaimId,
      year: r.year,
    })),
    ...claim.relationsTo.map(r => ({
      id: r.id,
      relationType: r.relationType,
      relatedClaimId: r.fromClaimId,
      year: r.year,
    })),
  ];

  const body = {
    id: claim.id,
    text: claim.text,
    claimType: claim.claimType,
    epistemicAxis: claim.epistemicAxis,
    verificationStatus: claim.verificationStatus,
    ingestedBy: claim.ingestedBy,
    humanReviewed: claim.humanReviewed,
    autoApproved: claim.autoApproved,
    openAlexId: claim.openAlexId,
    claimEmergedAt: claim.claimEmergedAt?.toISOString() ?? null,
    claimEmergedPrecision: claim.claimEmergedPrecision,
    metadata: claim.metadata as Record<string, unknown> | null,
    createdAt: claim.createdAt.toISOString(),
    updatedAt: claim.updatedAt.toISOString(),
    provenanceGrade: grade,
    provenanceDetail: {
      grade,
      description: GRADE_DESCRIPTIONS[grade],
      primarySourceEdgeCount: primaryEdges,
    },
    edges: claim.edges.map(e => ({
      id: e.id,
      type: e.type,
      evidenceType: e.evidenceType,
      source: {
        id: e.source.id,
        name: e.source.name,
        url: e.source.url,
        methodologyType: e.source.methodologyType,
        publishedAt: e.source.publishedAt?.toISOString() ?? null,
      },
    })),
    statusHistory: claim.statusHistory.map(h => ({
      id: h.id,
      fromAxis: h.fromAxis,
      toAxis: h.toAxis,
      community: h.community,
      reason: h.reason,
      occurredAt: h.occurredAt.toISOString(),
      datePrecision: h.datePrecision,
      markerSourceId: h.sourceId,
    })),
    relations,
    topics: claim.topics.map(ct => ({
      id: ct.topic.id,
      name: ct.topic.name,
      slug: ct.topic.slug,
      domain: ct.topic.domain,
    })),
  };

  return v1Json(body, { cache: "detail", etag });
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
