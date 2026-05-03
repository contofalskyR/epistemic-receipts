import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const edges = await prisma.edge.findMany({
    where: { deleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      source: true,
      claim: true,
      revisions: { orderBy: { changedAt: "desc" }, take: 1 },
    },
  });
  return NextResponse.json(edges);
}

const VALID_EVIDENCE_TYPES = ["EVIDENTIARY", "PROCEDURAL", "ARGUMENTATIVE"];

export async function POST(req: NextRequest) {
  const {
    sourceId, claimId, type, evidenceType, score, reason,
    ingestedBy, humanReviewed, reviewConfidence, reviewedAt, reviewedBy,
  } = await req.json();

  if (!sourceId || !claimId) {
    return NextResponse.json({ error: "sourceId and claimId are required" }, { status: 400 });
  }
  if (!["FOR", "AGAINST", "CITES", "RETRACTS", "CORRECTED"].includes(type)) {
    return NextResponse.json({ error: "invalid edge type" }, { status: 400 });
  }
  if (evidenceType && !VALID_EVIDENCE_TYPES.includes(evidenceType)) {
    return NextResponse.json({ error: "invalid evidenceType" }, { status: 400 });
  }
  if (typeof score !== "number" || score < 0 || score > 100) {
    return NextResponse.json({ error: "score must be 0-100" }, { status: 400 });
  }

  const isManual = !ingestedBy || ingestedBy === "manual";
  const provenance = {
    ingestedBy: isManual ? "manual" : ingestedBy,
    humanReviewed: humanReviewed !== undefined ? humanReviewed : isManual,
    reviewConfidence: reviewConfidence ?? null,
    reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
    reviewedBy: reviewedBy ?? null,
  };

  // Write Edge + first EdgeRevision in a single transaction
  const edge = await prisma.$transaction(async (tx) => {
    const newEdge = await tx.edge.create({
      data: { sourceId, claimId, type, evidenceType: evidenceType || "EVIDENTIARY", ...provenance },
    });
    await tx.edgeRevision.create({
      data: {
        edgeId: newEdge.id,
        priorScore: null,
        newScore: score,
        reason: reason?.trim() || null,
      },
    });
    return newEdge;
  });

  return NextResponse.json(edge, { status: 201 });
}
