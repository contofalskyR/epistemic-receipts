import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ matterId: string; claimId: string }> };

// DELETE /api/litigation/matters/[matterId]/claims/[claimId] — remove claim
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { matterId, claimId } = await params;
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

  const deleted = await prisma.matterClaim.deleteMany({
    where: { matterId, claimId },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: "Claim not found in matter" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
