import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; topicId: string }> },
) {
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
