import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import OrgIpRangesClient from "./OrgIpRangesClient";

type Props = { params: Promise<{ orgId: string }> };

export default async function OrgIpRangesPage({ params }: Props) {
  const { orgId } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect("/auth/signin");

  const membership = await prisma.membership.findUnique({
    where: { userId_orgId: { userId: session.user.id, orgId } },
  });
  if (!membership || !["owner", "admin"].includes(membership.role)) redirect("/");

  const org = await prisma.org.findUnique({ where: { id: orgId } });
  if (!org) redirect("/");

  const ranges = await prisma.orgIpRange.findMany({ where: { orgId }, orderBy: { createdAt: "asc" } });

  return <OrgIpRangesClient org={{ id: org.id, name: org.name }} ranges={ranges} />;
}
