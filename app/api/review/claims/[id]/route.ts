import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { action } = await req.json() as { action: "approve" | "reject" };

  if (action === "approve") {
    const now = new Date();
    try {
      await prisma.$transaction(async tx => {
        const claim = await tx.claim.findUnique({
          where: { id, deleted: false },
          include: {
            edges: { where: { deleted: false }, select: { id: true, sourceId: true } },
            thresholdEvents: { where: { deleted: false }, select: { id: true } },
          },
        });
        if (!claim) throw new Error("not found");

        const reviewFields = {
          humanReviewed: true,
          reviewedBy: "robert",
          reviewedAt: now,
          reviewConfidence: "HIGH" as const,
        };

        await tx.claim.update({ where: { id }, data: reviewFields });

        const sourceIds = [...new Set(claim.edges.map(e => e.sourceId))];
        if (sourceIds.length > 0) {
          await tx.source.updateMany({ where: { id: { in: sourceIds } }, data: reviewFields });
        }
        if (claim.edges.length > 0) {
          await tx.edge.updateMany({
            where: { id: { in: claim.edges.map(e => e.id) } },
            data: reviewFields,
          });
        }
        if (claim.thresholdEvents.length > 0) {
          await tx.thresholdEvent.updateMany({
            where: { id: { in: claim.thresholdEvents.map(te => te.id) } },
            data: reviewFields,
          });
        }
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  if (action === "reject") {
    try {
      await prisma.$transaction(async tx => {
        const claim = await tx.claim.findUnique({
          where: { id, deleted: false },
          include: {
            edges: { where: { deleted: false }, select: { id: true, sourceId: true } },
            thresholdEvents: { where: { deleted: false }, select: { id: true } },
          },
        });
        if (!claim) throw new Error("not found");

        await tx.claim.update({ where: { id }, data: { deleted: true } });

        const sourceIds = [...new Set(claim.edges.map(e => e.sourceId))];
        if (sourceIds.length > 0) {
          await tx.source.updateMany({ where: { id: { in: sourceIds } }, data: { deleted: true } });
        }
        if (claim.edges.length > 0) {
          await tx.edge.updateMany({
            where: { id: { in: claim.edges.map(e => e.id) } },
            data: { deleted: true },
          });
        }
        if (claim.thresholdEvents.length > 0) {
          await tx.thresholdEvent.updateMany({
            where: { id: { in: claim.thresholdEvents.map(te => te.id) } },
            data: { deleted: true },
          });
        }
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      return NextResponse.json({ error: String(err) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}
