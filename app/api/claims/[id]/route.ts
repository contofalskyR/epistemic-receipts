import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { requireAdminOrDev } from "@/lib/adminAuth";
import { getClaimDetail } from "@/lib/claim-detail";

const VALID_PRECISIONS = ["DAY", "MONTH", "QUARTER", "YEAR"];
const VALID_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"];
const VALID_CLAIM_TYPES = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"];

// GET is a thin wrapper over lib/claim-detail.ts — the same helper that
// server-renders /claims/[id]. Query shape + vote-source LV backfill live there.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let claim;
  try {
    claim = await getClaimDetail(id);
  } catch (err) {
    console.error(`[/api/claims/${id}] DB error:`, err);
    return NextResponse.json({ error: "internal server error" }, { status: 500 });
  }
  if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(claim);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const denied = requireAdminOrDev(req);
  if (denied) return denied;
  const { id } = await params;
  const { text, claimEmergedAt, claimEmergedPrecision, currentStatus, claimType, topicIds } = await req.json();

  if (claimEmergedPrecision && !VALID_PRECISIONS.includes(claimEmergedPrecision)) {
    return NextResponse.json({ error: "invalid claimEmergedPrecision" }, { status: 400 });
  }
  if (currentStatus && !VALID_STATUSES.includes(currentStatus)) {
    return NextResponse.json({ error: "invalid currentStatus" }, { status: 400 });
  }
  if (claimType && !VALID_CLAIM_TYPES.includes(claimType)) {
    return NextResponse.json({ error: "invalid claimType" }, { status: 400 });
  }

  const claim = await prisma.claim.update({
    where: { id },
    data: {
      text: text?.trim() ?? undefined,
      claimEmergedAt: claimEmergedAt ? new Date(claimEmergedAt) : undefined,
      claimEmergedPrecision: claimEmergedPrecision ?? undefined,
      currentStatus: currentStatus ?? undefined,
      claimType: claimType ?? undefined,
    },
  });

  // Replace topic associations if topicIds is provided (null = no change, [] = remove all)
  if (Array.isArray(topicIds)) {
    await prisma.claimTopic.deleteMany({ where: { claimId: id } });
    if (topicIds.length > 0) {
      await prisma.claimTopic.createMany({
        data: topicIds.map((topicId: string) => ({ claimId: id, topicId })),
      });
    }
  }

  return NextResponse.json(claim);
}
