import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";
import { requireAdminOrDev } from "@/lib/adminAuth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });
  const denied = requireAdminOrDev(req);
  if (denied) return denied;

  const { id } = await params;
  const { triggeredBySourceId } = await req.json();

  const event = await prisma.thresholdEvent.update({
    where: { id },
    data: { triggeredBySourceId: triggeredBySourceId ?? null },
    include: { triggeredBySource: true },
  });
  return NextResponse.json(event);
}
