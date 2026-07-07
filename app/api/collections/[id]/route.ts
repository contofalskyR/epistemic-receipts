import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

async function getOwnedCollection(userId: string, collectionId: string) {
  return prisma.collection.findFirst({
    where: { id: collectionId, ownerId: userId },
  });
}

// GET /api/collections/[id] — collection detail with items
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const collection = await prisma.collection.findFirst({
    where: { id, ownerId: session.user.id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          claim: {
            select: {
              id: true,
              text: true,
              epistemicAxis: true,
              currentStatus: true,
              claimEmergedAt: true,
            },
          },
        },
      },
    },
  });

  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ collection });
}

// PATCH /api/collections/[id] — update name/description
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const col = await getOwnedCollection(session.user.id, id);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: { name?: string; description?: string | null } = {};
  if (typeof body.name === "string") data.name = body.name.trim();
  if ("description" in body)
    data.description =
      typeof body.description === "string" ? body.description.trim() : null;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const updated = await prisma.collection.update({
    where: { id },
    data,
    select: { id: true, name: true, description: true, updatedAt: true },
  });

  return NextResponse.json({ collection: updated });
}

// DELETE /api/collections/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id } = await params;

  const col = await getOwnedCollection(session.user.id, id);
  if (!col) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.collection.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
