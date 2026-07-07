import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ matterId: string }> };

// POST /api/litigation/matters/[matterId]/claims — add claim to matter
export async function POST(req: NextRequest, { params }: Params) {
  const { matterId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const matter = await prisma.litigationMatter.findUnique({
    where: { id: matterId },
    include: { org: { select: { id: true, tier: true } } },
  });
  if (!matter) return NextResponse.json({ error: "Matter not found" }, { status: 404 });

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId: matter.orgId } },
  });
  if (!membership) return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });

  const entitled = can(
    { org: { id: matter.orgId, tier: matter.org.tier as "free" | "pro" | "team" | "enterprise" } },
    "litigation",
  );
  if (!entitled) {
    return NextResponse.json(
      { error: "Litigation workbench requires a Team or Enterprise plan" },
      { status: 403 },
    );
  }

  const body: unknown = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { claimId, notes, relevanceTag } = body as Record<string, unknown>;
  if (typeof claimId !== "string" || !claimId) {
    return NextResponse.json({ error: "claimId required" }, { status: 400 });
  }

  const claimExists = await prisma.claim.findUnique({ where: { id: claimId }, select: { id: true } });
  if (!claimExists) return NextResponse.json({ error: "Claim not found" }, { status: 404 });

  const matterClaim = await prisma.matterClaim.upsert({
    where: { matterId_claimId: { matterId, claimId } },
    create: {
      matterId,
      claimId,
      addedById: session.user.id,
      notes: typeof notes === "string" ? notes : undefined,
      relevanceTag: typeof relevanceTag === "string" ? relevanceTag : undefined,
    },
    update: {
      notes: typeof notes === "string" ? notes : undefined,
      relevanceTag: typeof relevanceTag === "string" ? relevanceTag : undefined,
    },
  });

  return NextResponse.json(matterClaim, { status: 201 });
}
