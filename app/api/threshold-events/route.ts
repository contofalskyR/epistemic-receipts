import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const claimId = sp.get("claimId");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(sp.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);

  const events = await prisma.thresholdEvent.findMany({
    where: {
      deleted: false,
      ...(claimId ? { claimId } : {}),
    },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      claim: { select: { id: true, text: true, currentStatus: true, claimType: true } },
      suggestedEvent: { select: { id: true, aiReasoning: true } },
      triggeredBySource: { select: { id: true, name: true, url: true } },
    },
  });
  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const {
    claimId, confirmedBy, triggeredBy, triggeredBySourceId, note, evidenceSnapshot, createdAt, suggestedEventId,
    ingestedBy, humanReviewed, reviewConfidence, reviewedAt, reviewedBy,
  } = await req.json();

  if (!claimId || !confirmedBy || !triggeredBy) {
    return NextResponse.json({ error: "claimId, confirmedBy, triggeredBy are required" }, { status: 400 });
  }

  const isManual = !ingestedBy || ingestedBy === "manual";
  const event = await prisma.thresholdEvent.create({
    data: {
      claimId,
      confirmedBy,
      triggeredBy,
      triggeredBySourceId: triggeredBySourceId ?? null,
      note: note ?? null,
      evidenceSnapshot: typeof evidenceSnapshot === "string" ? evidenceSnapshot : JSON.stringify(evidenceSnapshot ?? {}),
      suggestedEventId: suggestedEventId ?? null,
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      ingestedBy: isManual ? "manual" : ingestedBy,
      humanReviewed: humanReviewed !== undefined ? humanReviewed : isManual,
      reviewConfidence: reviewConfidence ?? null,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
      reviewedBy: reviewedBy ?? null,
    },
    include: { triggeredBySource: true },
  });

  return NextResponse.json(event, { status: 201 });
}
