import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; claimId: string }> };

async function getOwnedItem(userId: string, collectionId: string, claimId: string) {
  const col = await prisma.collection.findFirst({
    where: { id: collectionId, ownerId: userId },
    select: { id: true },
  });
  if (!col) return null;
  return prisma.collectionItem.findUnique({
    where: { collectionId_claimId: { collectionId, claimId } },
  });
}

// PATCH /api/collections/[id]/items/[claimId] — update note/position
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id: collectionId, claimId } = await params;

  const item = await getOwnedItem(session.user.id, collectionId, claimId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { note?: string | null; position?: number } = {};
  if ("note" in body)
    data.note = typeof body.note === "string" ? body.note.trim() || null : null;
  if (typeof body.position === "number") data.position = Math.max(0, body.position);

  const updated = await prisma.collectionItem.update({
    where: { id: item.id },
    data,
    select: { id: true, claimId: true, note: true, position: true },
  });

  return NextResponse.json({ item: updated });
}

// DELETE /api/collections/[id]/items/[claimId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id: collectionId, claimId } = await params;

  const item = await getOwnedItem(session.user.id, collectionId, claimId);
  if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.collectionItem.delete({ where: { id: item.id } });
  return NextResponse.json({ ok: true });
}
