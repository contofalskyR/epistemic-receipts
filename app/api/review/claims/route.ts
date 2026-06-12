import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminOrDev } from "@/lib/adminAuth";

export async function GET(req: NextRequest) {
  const denied = requireAdminOrDev(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = 10;
  const skip = (page - 1) * limit;
  const ingestedBy = searchParams.get("ingestedBy");

  const where = {
    humanReviewed: false,
    deleted: false,
    ...(ingestedBy && ingestedBy !== "all" ? { ingestedBy } : {}),
  };

  const [claims, total] = await Promise.all([
    prisma.claim.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      include: {
        _count: {
          select: {
            edges: { where: { deleted: false } },
            thresholdEvents: { where: { deleted: false } },
          },
        },
        thresholdEvents: {
          where: { deleted: false },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { triggeredBy: true, createdAt: true },
        },
        edges: {
          where: { deleted: false },
          select: { sourceId: true },
        },
      },
    }),
    prisma.claim.count({ where }),
  ]);

  const result = claims.map(c => ({
    ...c,
    sourceCount: new Set(c.edges.map(e => e.sourceId)).size,
    edges: undefined,
  }));

  return NextResponse.json({ claims: result, total, page, pages: Math.ceil(total / limit) });
}
