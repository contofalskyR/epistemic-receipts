import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const events = await prisma.thresholdEvent.findMany({
    orderBy: { createdAt: "desc" },
    include: { claim: true, suggestedEvent: true, triggeredBySource: true },
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
