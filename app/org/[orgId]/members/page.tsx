import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrgMembersClient from "./OrgMembersClient";

type Props = { params: Promise<{ orgId: string }> };

export default async function OrgMembersPage({ params }: Props) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) redirect("/");

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) redirect("/");

  const members = await prisma.membership.findMany({
    where: { orgId },
    include: { user: { select: { id: true, email: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  return (
    <OrgMembersClient
      org={{ id: org.id, name: org.name, seats: org.seats }}
      members={members}
      currentRole={membership.role}
    />
  );
}
