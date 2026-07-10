import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { encodeCursor, decodeCursor } from "@/lib/v1/cursor";
import { computeProvenanceGrade } from "@/lib/v1/provenance";
import { ClaimsQuerySchema } from "@/lib/v1/schemas";
import { v1Json, v1Error, methodNotAllowed, badRequest } from "@/lib/v1/respond";
import { terminalAxisLateralJoin, effectiveAxisCondition } from "@/lib/effective-axis";

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

  // Build where clause. epistemicAxis is handled separately (below): it can't be
  // an ORM column match because REVERSED/ABANDONED live on the terminal
  // transition, not the stored column — see lib/effective-axis.ts.
  const where: Record<string, unknown> = { deleted: false };
  if (q.pipeline) where.ingestedBy = q.pipeline;
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

  const include = {
    edges: {
      where: { deleted: false },
      select: { type: true, evidenceType: true, source: { select: { methodologyType: true } } },
    },
  } as const;

  type ClaimRow = Awaited<ReturnType<typeof readPrisma.claim.findMany<{ include: typeof include }>>>[number];
  let page: ClaimRow[];
  let hasMore: boolean;
  let lastRow: { createdAt: Date; id: string } | null;

  if (q.epistemicAxis) {
    // Terminal-aware axis filter: the matching set (and its cursor order) is
    // resolved in SQL against each claim's terminal transition, then hydrated
    // through the ORM so the response shape and provenance logic are unchanged.
    const params: unknown[] = [];
    const conds: string[] = [`c."deleted" = false`];

    params.push(q.epistemicAxis);
    conds.push(effectiveAxisCondition(`$${params.length}`));
    if (q.pipeline) { params.push(q.pipeline); conds.push(`c."ingestedBy" = $${params.length}`); }
    if (q.claimType) { params.push(q.claimType); conds.push(`c."claimType" = $${params.length}`); }
    if (q.verificationStatus) { params.push(q.verificationStatus); conds.push(`c."verificationStatus" = $${params.length}`); }
    if (q.emergedAfter) { params.push(new Date(q.emergedAfter)); conds.push(`c."claimEmergedAt" >= $${params.length}`); }
    if (q.emergedBefore) { params.push(new Date(q.emergedBefore)); conds.push(`c."claimEmergedAt" <= $${params.length}`); }
    if (topicIds) {
      params.push(topicIds);
      conds.push(`EXISTS (SELECT 1 FROM "ClaimTopic" ct WHERE ct."claimId" = c."id" AND ct."topicId" = ANY($${params.length}::text[]))`);
    }
    if (cursor) {
      params.push(cursor.createdAt);
      const cAt = params.length;
      params.push(cursor.id);
      const cId = params.length;
      conds.push(`(c."createdAt" < $${cAt} OR (c."createdAt" = $${cAt} AND c."id" < $${cId}))`);
    }
    params.push(limit + 1);
    const limitIdx = params.length;

    const idRows = await readPrisma.$queryRawUnsafe<Array<{ id: string; createdAt: Date }>>(
      `SELECT c."id", c."createdAt"
         FROM "Claim" c
         ${terminalAxisLateralJoin()}
        WHERE ${conds.join(" AND ")}
        ORDER BY c."createdAt" DESC, c."id" DESC
        LIMIT $${limitIdx}`,
      ...params,
    );

    hasMore = idRows.length > limit;
    const pageRows = hasMore ? idRows.slice(0, limit) : idRows;
    const ids = pageRows.map(r => r.id);
    const hydrated = ids.length
      ? await readPrisma.claim.findMany({ where: { id: { in: ids } }, include })
      : [];
    const byId = new Map(hydrated.map(c => [c.id, c]));
    page = ids.map(id => byId.get(id)).filter((c): c is ClaimRow => Boolean(c));
    lastRow = pageRows.length ? pageRows[pageRows.length - 1] : null;
  } else {
    const claims = await readPrisma.claim.findMany({
      where: topicIds
        ? { ...where, topics: { some: { topicId: { in: topicIds } } } }
        : where,
      include,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });
    hasMore = claims.length > limit;
    page = hasMore ? claims.slice(0, limit) : claims;
    lastRow = page.length ? { createdAt: page[page.length - 1].createdAt, id: page[page.length - 1].id } : null;
  }

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
    hasMore && lastRow
      ? encodeCursor(lastRow.createdAt, lastRow.id)
      : null;

  return v1Json({ data, nextCursor }, { cache: "list" });
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
