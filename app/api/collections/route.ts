import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

export const dynamic = "force-dynamic";

// GET /api/collections — list the authenticated user's collections
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const collections = await prisma.collection.findMany({
    where: { ownerId: session.user.id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { items: true } },
    },
  });

  return NextResponse.json({ collections });
}

// POST /api/collections — create a new collection
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  const description =
    typeof body.description === "string" ? body.description.trim() : undefined;

  // Entitlement check — how many collections does the user have?
  const existing = await prisma.collection.count({
    where: { ownerId: session.user.id },
  });

  // Check org membership for entitlement
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { org: { select: { id: true, tier: true } } },
  });

  const ctx = membership
    ? { user: { id: session.user.id }, org: { id: membership.org.id, tier: membership.org.tier as "free" | "pro" | "team" | "enterprise" } }
    : { user: { id: session.user.id } };

  const maxCollections = can(ctx, "collections.max") as number;

  if (existing >= maxCollections) {
    return NextResponse.json(
      {
        error: "Collection limit reached",
        code: "collections_limit",
        limit: maxCollections,
        upgrade: true,
      },
      { status: 402 },
    );
  }

  const collection = await prisma.collection.create({
    data: { ownerId: session.user.id, name, description },
    select: { id: true, name: true, description: true, createdAt: true },
  });

  return NextResponse.json({ collection }, { status: 201 });
}
