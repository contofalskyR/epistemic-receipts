import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { requireAdminOrDev } from "@/lib/adminAuth";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const claimId = sp.get("claimId");
  const sourceId = sp.get("sourceId");
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, parseInt(sp.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT),
  );
  const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);

  const where = {
    deleted: false,
    ...(claimId ? { claimId } : {}),
    ...(sourceId ? { sourceId } : {}),
  };

  const edges = await prisma.edge.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    select: {
      id: true,
      sourceId: true,
      claimId: true,
      type: true,
      evidenceType: true,
      createdAt: true,
      humanReviewed: true,
      source: { select: { id: true, name: true, url: true, methodologyType: true } },
      claim: { select: { id: true, text: true, currentStatus: true, claimType: true } },
      revisions: { orderBy: { changedAt: "desc" }, take: 1, select: { newScore: true, changedAt: true } },
    },
  });
  return NextResponse.json(edges);
}

const VALID_EVIDENCE_TYPES = ["EVIDENTIARY", "PROCEDURAL", "ARGUMENTATIVE"];

export async function POST(req: NextRequest) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const denied = requireAdminOrDev(req);
  if (denied) return denied;
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
