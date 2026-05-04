import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";

const VALID_PRECISIONS = ["DAY", "MONTH", "QUARTER", "YEAR"];
const VALID_CLAIM_TYPES = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"];
const VALID_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"];

export async function GET() {
  const claims = await prisma.claim.findMany({
    where: { deleted: false },
    orderBy: { createdAt: "desc" },
    include: {
      parent: true,
      children: true,
      _count: { select: { edges: { where: { deleted: false } } } },
    },
  });
  return NextResponse.json(claims);
}

export async function POST(req: NextRequest) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const {
    text, parentClaimId, claimEmergedAt, claimEmergedPrecision, claimType, currentStatus,
    ingestedBy, humanReviewed, reviewConfidence, reviewedAt, reviewedBy,
  } = await req.json();
  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (claimEmergedPrecision && !VALID_PRECISIONS.includes(claimEmergedPrecision)) {
    return NextResponse.json({ error: "invalid claimEmergedPrecision" }, { status: 400 });
  }
  if (claimType && !VALID_CLAIM_TYPES.includes(claimType)) {
    return NextResponse.json({ error: "invalid claimType" }, { status: 400 });
  }
  if (currentStatus && !VALID_STATUSES.includes(currentStatus)) {
    return NextResponse.json({ error: "invalid currentStatus" }, { status: 400 });
  }
  const isManual = !ingestedBy || ingestedBy === "manual";
  const claim = await prisma.claim.create({
    data: {
      text: text.trim(),
      parentClaimId: parentClaimId || null,
      claimEmergedAt: claimEmergedAt ? new Date(claimEmergedAt) : null,
      claimEmergedPrecision: claimEmergedPrecision || null,
      claimType: claimType || "EMPIRICAL",
      currentStatus: currentStatus || "DISPUTED",
      ingestedBy: isManual ? "manual" : ingestedBy,
      humanReviewed: humanReviewed !== undefined ? humanReviewed : isManual,
      reviewConfidence: reviewConfidence ?? null,
      reviewedAt: reviewedAt ? new Date(reviewedAt) : null,
      reviewedBy: reviewedBy ?? null,
    },
  });
  return NextResponse.json(claim, { status: 201 });
}
