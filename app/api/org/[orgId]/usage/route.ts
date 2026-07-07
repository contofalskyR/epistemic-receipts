import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireOrgRole, isOrgContext } from "@/lib/orgAuth";

type Params = { params: Promise<{ orgId: string }> };

export async function GET(req: NextRequest, { params }: Params) {
  const { orgId } = await params;
  const ctx = await requireOrgRole(orgId, "admin");
  if (!isOrgContext(ctx)) return ctx;

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const since = url.searchParams.get("since");
  const until = url.searchParams.get("until");

  const where: { orgId: string; date?: { gte?: string; lte?: string } } = { orgId };
  if (since || until) {
    where.date = {};
    if (since) where.date.gte = since.slice(0, 10);
    if (until) where.date.lte = until.slice(0, 10);
  }

  const rows = await prisma.orgUsageDaily.findMany({
    where,
    orderBy: [{ date: "asc" }, { metric: "asc" }],
  });

  if (format === "csv") {
    const lines = [
      "date,metric,count",
      ...rows.map((r: { date: string; metric: string; count: number }) => `${r.date},${r.metric},${r.count}`),
    ];
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="usage-${orgId}.csv"`,
      },
    });
  }

  return NextResponse.json(rows);
}
