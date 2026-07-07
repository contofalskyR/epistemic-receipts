import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import AccountClient from "./AccountClient";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ checkout?: string }>;
}

async function getAccountData(orgId: string) {
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 7);

  const [org, usageThisMonth] = await Promise.all([
    prisma.org.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        tier: true,
        pastDueSince: true,
        enterpriseFlag: true,
        stripeCustomerId: true,
        apiKeys: {
          where: { revokedAt: null },
          select: { id: true, orgName: true, createdAt: true, tier: true, lastUsedAt: true },
        },
      },
    }),
    prisma.apiUsage.aggregate({
      where: {
        date: { startsWith: monthStart },
        key: { orgId },
      },
      _sum: { count: true },
    }),
  ]);

  return { org, usageThisMonth: usageThisMonth._sum.count ?? 0 };
}

// Placeholder — in production this comes from session (Auth.js / spec30)
async function getSessionOrgId(): Promise<string | null> {
  return null;
}

export default async function AccountPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const orgId = await getSessionOrgId();

  // Unauthenticated — redirect to login
  if (!orgId) {
    redirect("/login?from=/account");
  }

  const { org, usageThisMonth } = await getAccountData(orgId);

  if (!org) {
    redirect("/login?from=/account");
  }

  return (
    <AccountClient
      org={org}
      usageThisMonth={usageThisMonth}
      checkoutSuccess={params.checkout === "success"}
    />
  );
}
