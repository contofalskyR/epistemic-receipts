import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ matterId: string }> };

async function resolveMatterWithAuth(userId: string, matterId: string) {
  const matter = await prisma.litigationMatter.findUnique({
    where: { id: matterId },
    include: { org: { select: { id: true, tier: true } } },
  });
  if (!matter) return { error: "Matter not found", status: 404 } as const;

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId, orgId: matter.orgId } },
  });
  if (!membership) return { error: "Not a member of this org", status: 403 } as const;

  const entitled = can(
    { org: { id: matter.orgId, tier: matter.org.tier as "free" | "pro" | "team" | "enterprise" } },
    "litigation",
  );
  if (!entitled) return { error: "Litigation workbench requires a Team or Enterprise plan", status: 403 } as const;

  return { matter, membership };
}

// GET /api/litigation/matters/[matterId] — matter detail with claims
export async function GET(_req: NextRequest, { params }: Params) {
  const { matterId } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await resolveMatterWithAuth(session.user.id, matterId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });

  const claims = await prisma.matterClaim.findMany({
    where: { matterId },
    include: {
      claim: {
        select: {
          id: true,
          text: true,
          epistemicAxis: true,
          claimEmergedAt: true,
          epistemicStatus: true,
        },
      },
      addedBy: { select: { id: true, email: true, name: true } },
    },
    orderBy: { addedAt: "desc" },
  });

  return NextResponse.json({ ...result.matter, claims });
}
