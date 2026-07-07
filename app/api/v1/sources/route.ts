import { NextRequest } from "next/server";
import { readPrisma } from "@/lib/v1/readClient";
import { verifyApiKey, isAuthError } from "@/lib/v1/auth";
import { encodeCursor, decodeCursor } from "@/lib/v1/cursor";
import { SourcesQuerySchema } from "@/lib/v1/schemas";
import { v1Json, v1Error, methodNotAllowed, badRequest } from "@/lib/v1/respond";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const auth = await verifyApiKey(req, "sources");
  if (isAuthError(auth)) return v1Error(auth.body, auth.headers);

  const sp = req.nextUrl.searchParams;
  const parseResult = SourcesQuerySchema.safeParse({
    cursor: sp.get("cursor") ?? undefined,
    limit: sp.get("limit") ?? undefined,
  });

  if (!parseResult.success) {
    return badRequest(parseResult.error.issues.map(i => i.message).join("; "));
  }

  const { cursor: cursorStr, limit = 20 } = parseResult.data;
  const cursor = cursorStr ? decodeCursor(cursorStr) : null;
  if (cursorStr && !cursor) return badRequest("Invalid cursor.");

  const where: Record<string, unknown> = { deleted: false };
  if (cursor) {
    where.OR = [
      { createdAt: { lt: cursor.createdAt } },
      { createdAt: cursor.createdAt, id: { lt: cursor.id } },
    ];
  }

  const sources = await readPrisma.source.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: {
      id: true,
      name: true,
      url: true,
      methodologyType: true,
      publishedAt: true,
      humanReviewed: true,
      ingestedBy: true,
      createdAt: true,
    },
  });

  const hasMore = sources.length > limit;
  const page = hasMore ? sources.slice(0, limit) : sources;

  const data = page.map(s => ({
    id: s.id,
    name: s.name,
    url: s.url,
    methodologyType: s.methodologyType,
    publishedAt: s.publishedAt?.toISOString() ?? null,
    humanReviewed: s.humanReviewed,
    ingestedBy: s.ingestedBy,
    createdAt: s.createdAt.toISOString(),
  }));

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
