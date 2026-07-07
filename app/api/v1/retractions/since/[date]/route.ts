import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { computeProvenanceGrade } from "@/lib/v1/provenance";
import { encodeCursor, decodeCursor } from "@/lib/v1/cursor";
import { v1Json, v1Error, methodNotAllowed, badRequest } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

// Pipelines that ingest retractions
const RETRACTION_PIPELINES = ["crossref_retractions_v1", "retraction_watch_v1"];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ date: string }> },
) {
  const auth = await verifyApiKey(req, "retractions");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const { date } = await params;
  const sinceDate = new Date(date);
  if (Number.isNaN(sinceDate.getTime())) {
    return badRequest("Invalid date. Use ISO 8601 format, e.g. 2024-01-01.");
  }

  const sp = req.nextUrl.searchParams;
  const limit = Math.min(200, Math.max(1, Number.parseInt(sp.get("limit") ?? "50", 10) || 50));
  const cursorStr = sp.get("cursor");
  const cursor = cursorStr ? decodeCursor(cursorStr) : null;
  if (cursorStr && !cursor) return badRequest("Invalid cursor.");

  const where: Record<string, unknown> = {
    deleted: false,
    ingestedBy: { in: RETRACTION_PIPELINES },
    createdAt: { gte: sinceDate },
  };

  if (cursor) {
    where.AND = [
      { createdAt: { gte: sinceDate } },
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ];
    delete where.createdAt;
  }

  const claims = await readPrisma.claim.findMany({
    where,
    include: {
      edges: {
        where: { deleted: false, type: "CONTRADICTS" },
        select: { claimId: true },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = claims.length > limit;
  const page = hasMore ? claims.slice(0, limit) : claims;

  const data = page.map(c => {
    const meta = c.metadata as Record<string, unknown> | null;
    const primaryEdges = 0; // retractions typically have no primary edges
    const grade = computeProvenanceGrade({
      humanReviewed: c.humanReviewed,
      autoApproved: c.autoApproved,
      verificationStatus: c.verificationStatus,
      epistemicAxis: c.epistemicAxis,
      primarySourceEdgeCount: primaryEdges,
    });

    return {
      id: c.id,
      text: c.text,
      claimType: c.claimType,
      epistemicAxis: c.epistemicAxis,
      verificationStatus: c.verificationStatus,
      ingestedBy: c.ingestedBy,
      humanReviewed: c.humanReviewed,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      provenanceGrade: grade,
      doi: (meta?.doi as string | null) ?? null,
      retractionDate:
        ((meta?.retractionDate ?? meta?.retraction_date) as string | null) ?? null,
      originalPaperMetadata: meta ?? null,
      contradictsEdges: c.edges.map(e => ({ targetClaimId: e.claimId })),
    };
  });

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
      : null;

  return v1Json({ data, nextCursor, since: sinceDate.toISOString() }, { cache: "list" });
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
