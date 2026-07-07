import "server-only";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type OrgRole = "owner" | "admin" | "member";

export type OrgContext = {
  userId: string;
  orgId: string;
  role: OrgRole;
};

const ROLES: OrgRole[] = ["member", "admin", "owner"];

export async function requireOrgRole(
  orgId: string,
  minRole: OrgRole = "member",
): Promise<OrgContext | NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });

  if (!membership) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  const memberIdx = ROLES.indexOf(membership.role as OrgRole);
  const minIdx = ROLES.indexOf(minRole);

  if (memberIdx < minIdx) {
    return NextResponse.json({ error: "Insufficient role" }, { status: 403 });
  }

  return { userId: session.user.id, orgId, role: membership.role as OrgRole };
}

export function isOrgContext(v: OrgContext | NextResponse): v is OrgContext {
  return "userId" in v;
}
