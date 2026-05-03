import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const showUnreviewed = req.nextUrl.searchParams.get("showUnreviewed") === "true";
  const [edges, thresholdEvents] = await Promise.all([
    prisma.edge.findMany({
      where: { deleted: false, ...(showUnreviewed ? {} : { humanReviewed: true }) },
      include: {
        source: true,
        claim: true,
        revisions: { orderBy: { changedAt: "asc" } },
        metaEdges: {
          where: { deleted: false },
          include: { actorSource: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.thresholdEvent.findMany({
      include: { triggeredBySource: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Group by claim
  const claimMap = new Map<string, {
    id: string;
    text: string;
    currentStatus: string;
    claimType: string;
    claimEmergedAt: Date | null;
    claimEmergedPrecision: string | null;
    edges: typeof edges;
    thresholdEvents: typeof thresholdEvents;
  }>();

  for (const edge of edges) {
    const c = edge.claim;
    if (!claimMap.has(c.id)) {
      claimMap.set(c.id, {
        id: c.id,
        text: c.text,
        currentStatus: c.currentStatus,
        claimType: c.claimType,
        claimEmergedAt: c.claimEmergedAt,
        claimEmergedPrecision: c.claimEmergedPrecision,
        edges: [],
        thresholdEvents: [],
      });
    }
    claimMap.get(c.id)!.edges.push(edge);
  }

  // Attach threshold events to their claims
  for (const te of thresholdEvents) {
    if (claimMap.has(te.claimId)) {
      claimMap.get(te.claimId)!.thresholdEvents.push(te);
    }
  }

  const claims = Array.from(claimMap.values());

  // Time range: all source publishedAt + all threshold event dates
  const edgeDates = edges
    .map(e => e.source.publishedAt)
    .filter((d): d is Date => d !== null)
    .map(d => new Date(d).getTime());

  const thresholdDates = thresholdEvents.map(te => new Date(te.createdAt).getTime());
  const allDates = [...edgeDates, ...thresholdDates];

  const timeRange = allDates.length
    ? { min: new Date(Math.min(...allDates)).toISOString(), max: new Date(Math.max(...allDates)).toISOString() }
    : null;

  return NextResponse.json({ claims, timeRange });
}
