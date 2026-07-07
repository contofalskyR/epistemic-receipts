import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { v1Json, v1Error, methodNotAllowed, notFound } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await verifyApiKey(req, "sources");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const { id } = await params;

  const source = await readPrisma.source.findUnique({
    where: { id, deleted: false },
    include: {
      credibilityEvents: { orderBy: { createdAt: "desc" } },
      relationshipsA: {
        include: { sourceB: { select: { id: true, name: true } } },
      },
      relationshipsB: {
        include: { sourceA: { select: { id: true, name: true } } },
      },
    },
  });

  if (!source) return notFound(`Source ${id} not found.`);

  const etag = source.createdAt.getTime().toString(16);
  const ifNoneMatch = req.headers.get("if-none-match");
  if (ifNoneMatch === `"${etag}"`) {
    return new Response(null, { status: 304 });
  }

  const relationships = [
    ...source.relationshipsA.map(r => ({
      id: r.id,
      type: r.type,
      otherSourceId: r.sourceB.id,
      otherSourceName: r.sourceB.name,
    })),
    ...source.relationshipsB.map(r => ({
      id: r.id,
      type: r.type,
      otherSourceId: r.sourceA.id,
      otherSourceName: r.sourceA.name,
    })),
  ];

  const body = {
    id: source.id,
    name: source.name,
    url: source.url,
    methodologyType: source.methodologyType,
    publishedAt: source.publishedAt?.toISOString() ?? null,
    humanReviewed: source.humanReviewed,
    ingestedBy: source.ingestedBy,
    createdAt: source.createdAt.toISOString(),
    credibilityEvents: source.credibilityEvents.map(e => ({
      id: e.id,
      eventType: e.eventType,
      reason: e.reason,
      createdAt: e.createdAt.toISOString(),
    })),
    relationships,
  };

  return v1Json(body, { cache: "detail", etag });
}

export function POST() { return methodNotAllowed(); }
export function PUT() { return methodNotAllowed(); }
export function PATCH() { return methodNotAllowed(); }
export function DELETE() { return methodNotAllowed(); }
