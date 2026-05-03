import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const VALID_PRECISIONS = ["DAY", "MONTH", "QUARTER", "YEAR"];
const VALID_STATUSES = ["DISPUTED", "HARD_FACT", "NEVER_RESOLVES"];
const VALID_CLAIM_TYPES = ["EMPIRICAL", "INSTITUTIONAL", "INTERPRETIVE", "HYBRID"];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const claim = await prisma.claim.findUnique({
    where: { id },
    include: {
      parent: { select: { id: true, text: true } },
      children: {
        include: {
          _count: { select: { edges: { where: { deleted: false } } } },
        },
      },
      edges: {
        where: { deleted: false },
        include: {
          source: true,
          revisions: { orderBy: { changedAt: "asc" } },
          metaEdges: {
            where: { deleted: false },
            include: { actorSource: true },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
      thresholdEvents: {
        include: { triggeredBySource: true },
        orderBy: { createdAt: "desc" },
      },
      topics: {
        select: { topic: { select: { id: true, name: true, slug: true, domain: true } } },
      },
    },
  });
  if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(claim);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
