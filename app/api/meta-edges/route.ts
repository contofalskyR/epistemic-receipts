import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_TYPES = ["SUPPRESSED", "AMPLIFIED", "LABELED", "DEMOTED"];

export async function GET(req: NextRequest) {
  const claimId = req.nextUrl.searchParams.get("claimId");
  const metaEdges = await prisma.metaEdge.findMany({
    where: {
      deleted: false,
      ...(claimId ? { claimId } : {}),
    },
    include: {
      actorSource: true,
      targetEdge: {
        include: {
          source: true,
          claim: true,
        },
      },
      claim: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(metaEdges);
}

export async function POST(req: NextRequest) {
  const {
    actorSourceId, targetEdgeId, claimId, type, reason, createdAt,
    ingestedBy, humanReviewed, reviewConfidence, reviewedAt, reviewedBy,
  } = await req.json();

  if (!actorSourceId || !targetEdgeId || !claimId) {
    return NextResponse.json(
      { error: "actorSourceId, targetEdgeId, claimId are required" },
      { status: 400 }
    );
  }
  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json({ error: "invalid type" }, { status: 400 });
  }

  const isManual = !ingestedBy || ingestedBy === "manual";
  const metaEdge = await prisma.metaEdge.create({
    data: {
      actorSourceId,
      targetEdgeId,
      claimId,
      type,
      reason: reason?.trim() || null,
      ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      ingestedBy: isManual ? "manual" : ingestedBy,
      humanReviewed: humanReviewed !== undefined ? humanReviewed : isManual,
      reviewConfidence: reviewConfidence ?? null,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
      reviewedBy: reviewedBy ?? null,
    },
    include: { actorSource: true },
  });
  return NextResponse.json(metaEdge, { status: 201 });
}
