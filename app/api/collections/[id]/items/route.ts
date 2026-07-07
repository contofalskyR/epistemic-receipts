import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const ITEMS_PER_COLLECTION_LIMIT = 500;

// POST /api/collections/[id]/items — add a claim to a collection
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id: collectionId } = await params;

  const col = await prisma.collection.findFirst({
    where: { id: collectionId, ownerId: session.user.id },
    include: { _count: { select: { items: true } } },
  });
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (col._count.items >= ITEMS_PER_COLLECTION_LIMIT) {
    return NextResponse.json(
      { error: "Collection item limit reached", limit: ITEMS_PER_COLLECTION_LIMIT },
      { status: 402 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const claimId = typeof body.claimId === "string" ? body.claimId.trim() : "";
  if (!claimId) return NextResponse.json({ error: "claimId is required" }, { status: 400 });

  const claimExists = await prisma.claim.findUnique({
    where: { id: claimId },
    select: { id: true },
  });
  if (!claimExists) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  const note =
    typeof body.note === "string" ? body.note.trim() || null : null;

  // Position at end
  const lastItem = await prisma.collectionItem.findFirst({
    where: { collectionId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = (lastItem?.position ?? -1) + 1;

  const item = await prisma.collectionItem.upsert({
    where: { collectionId_claimId: { collectionId, claimId } },
    create: { collectionId, claimId, note, position },
    update: { note },
    select: { id: true, claimId: true, note: true, position: true, addedAt: true },
  });

  return NextResponse.json({ item }, { status: 201 });
}
