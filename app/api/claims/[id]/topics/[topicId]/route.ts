import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isReadOnly } from "@/lib/isReadOnly";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> },
) {
  if (isReadOnly()) return NextResponse.json({ error: "Editing disabled in production" }, { status: 403 });

  const { id, topicId } = await params;

  try {
    await prisma.claimTopic.delete({
      where: { claimId_topicId: { claimId: id, topicId } },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
