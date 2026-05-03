import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { triggeredBySourceId } = await req.json();

  const event = await prisma.thresholdEvent.update({
    where: { id },
    data: { triggeredBySourceId: triggeredBySourceId ?? null },
    include: { triggeredBySource: true },
  });
  return NextResponse.json(event);
}
