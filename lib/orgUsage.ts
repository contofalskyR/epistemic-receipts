import "server-only";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

export type UsageMetric = "page_view" | "search" | "citation_export" | "api_call";

export async function incrementOrgUsage(orgId: string, metric: UsageMetric): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  await prisma.orgUsageDaily.upsert({
    where: { orgId_date_metric: { orgId, date, metric } },
    create: { orgId, date, metric, count: 1 },
    update: { count: { increment: 1 } },
  });
}

export async function getOrgContextFromHeaders(): Promise<{ orgId: string; tier: string } | null> {
  const hdrs = await headers();
  const orgId = hdrs.get("x-org-id");
  const tier = hdrs.get("x-org-tier");
  if (orgId && tier) return { orgId, tier };
  return null;
}
