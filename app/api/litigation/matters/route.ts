import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/litigation/matters — create a new litigation matter
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { orgId, name, description, jurisdiction, caseNumber } = body as Record<string, unknown>;

  if (typeof orgId !== "string" || !orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }
  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
    include: { org: { select: { id: true, tier: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  const entitled = can(
    { org: { id: orgId, tier: membership.org.tier as "free" | "pro" | "team" | "enterprise" } },
    "litigation",
  );
  if (!entitled) {
    return NextResponse.json(
      { error: "Litigation workbench requires a Team or Enterprise plan" },
      { status: 403 },
    );
  }

  const matter = await prisma.litigationMatter.create({
    data: {
      orgId,
      name: (name as string).trim(),
      description: typeof description === "string" ? description : undefined,
      jurisdiction: typeof jurisdiction === "string" ? jurisdiction : undefined,
      caseNumber: typeof caseNumber === "string" ? caseNumber : undefined,
    },
  });

  return NextResponse.json(matter, { status: 201 });
}

// GET /api/litigation/matters?orgId=... — list org matters
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const orgId = searchParams.get("orgId");
  if (!orgId) {
    return NextResponse.json({ error: "orgId required" }, { status: 400 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
    include: { org: { select: { id: true, tier: true } } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  const entitled = can(
    { org: { id: orgId, tier: membership.org.tier as "free" | "pro" | "team" | "enterprise" } },
    "litigation",
  );
  if (!entitled) {
    return NextResponse.json(
      { error: "Litigation workbench requires a Team or Enterprise plan" },
      { status: 403 },
    );
  }

  const matters = await prisma.litigationMatter.findMany({
    where: { orgId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(matters);
}
