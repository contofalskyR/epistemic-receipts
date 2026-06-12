import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { requireAdminOrDev } from "@/lib/adminAuth";

const VALID_PRECISIONS = ["DAY", "MONTH", "QUARTER", "YEAR"];
const VALID_CLAIM_TYPES = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"];
const VALID_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"];

const PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const offset = Math.max(0, parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0);
  const [total, claims] = await Promise.all([
    prisma.claim.count({ where: { deleted: false } }),
    prisma.claim.findMany({
      where: { deleted: false },
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: PAGE_SIZE,
      select: {
        id: true,
        text: true,
        epistemicAxis: true,
        claimType: true,
        parentClaimId: true,
        createdAt: true,
        claimEmergedAt: true,
        claimEmergedPrecision: true,
      },
    }),
  ]);
  return NextResponse.json({ claims, total, offset, pageSize: PAGE_SIZE });
}

export async function POST(req: NextRequest) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const denied = requireAdminOrDev(req);
  if (denied) return denied;
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
