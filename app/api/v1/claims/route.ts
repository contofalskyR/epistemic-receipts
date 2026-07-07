import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { encodeCursor, decodeCursor } from "@/lib/v1/cursor";
import { computeProvenanceGrade } from "@/lib/v1/provenance";
import { ClaimsQuerySchema } from "@/lib/v1/schemas";
import { v1Json, v1Error, methodNotAllowed, badRequest } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req, "claims");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const sp = req.nextUrl.searchParams;
  const parseResult = ClaimsQuerySchema.safeParse({
    pipeline: sp.get("pipeline") ?? undefined,
    epistemicAxis: sp.get("epistemicAxis") ?? undefined,
    claimType: sp.get("claimType") ?? undefined,
    verificationStatus: sp.get("verificationStatus") ?? undefined,
    emergedAfter: sp.get("emergedAfter") ?? undefined,
    emergedBefore: sp.get("emergedBefore") ?? undefined,
    topic: sp.get("topic") ?? undefined,
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  });

  if (!parseResult.success) {
    return badRequest(parseResult.error.issues.map(i => i.message).join("; "));
  }

  const q = parseResult.data;
  const limit = q.limit ?? 20;

  const cursor = q.cursor ? decodeCursor(q.cursor) : null;
  if (q.cursor && !cursor) return badRequest("Invalid cursor.");

  // Build where clause
  const where: Record<string, unknown> = { deleted: false };
  if (q.pipeline) where.ingestedBy = q.pipeline;
  if (q.epistemicAxis) where.epistemicAxis = q.epistemicAxis;
  if (q.claimType) where.claimType = q.claimType;
  if (q.verificationStatus) where.verificationStatus = q.verificationStatus;
  if (q.emergedAfter || q.emergedBefore) {
    where.claimEmergedAt = {
      ...(q.emergedAfter ? { gte: new Date(q.emergedAfter) } : {}),
      ...(q.emergedBefore ? { lte: new Date(q.emergedBefore) } : {}),
    };
  }

  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }

  let topicIds: string[] | undefined;
  if (q.topic) {
    const topic = await readPrisma.topic.findFirst({
      where: { OR: [{ slug: q.topic }, { name: { contains: q.topic, mode: "insensitive" } }] },
      select: { id: true },
    });
    if (!topic) {
      return v1Json({ data: [], nextCursor: null }, { cache: "list" });
    }
    topicIds = [topic.id];
  }

  const claims = await readPrisma.claim.findMany({
    where: topicIds
      ? { ...where, topics: { some: { topicId: { in: topicIds } } } }
      : where,
    include: {
      edges: {
        where: { deleted: false },
        select: { type: true, evidenceType: true, source: { select: { methodologyType: true } } },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
  });

  const hasMore = claims.length > limit;
  const page = hasMore ? claims.slice(0, limit) : claims;

  const data = page.map(c => {
    const primaryEdges = c.edges.filter(e => e.source.methodologyType === "primary").length;
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
    };
  });

  const nextCursor =
    hasMore && page.length > 0
      ? encodeCursor(page[page.length - 1].createdAt, page[page.length - 1].id)
      : null;

  return v1Json({ data, nextCursor }, { cache: "list" });
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
