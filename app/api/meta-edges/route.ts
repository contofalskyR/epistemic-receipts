import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";

const VALID_TYPES = ["SUPPRESSED", "AMPLIFIED", "LABELED", "DEMOTED"];

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const claimId = sp.get("claimId");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(sp.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);

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
    take: limit,
    skip: offset,
  });
  return NextResponse.json(metaEdges);
}

export async function POST(req: NextRequest) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
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
