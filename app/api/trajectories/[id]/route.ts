import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // CSV export
  const url = new URL(req.url);
  const wantCsv = url.searchParams.get("format") === "csv";

  const claim = await prisma.claim.findFirst({
    where: { externalId: `trajectory:${id}`, deleted: false },
    select: {
      id: true,
      text: true,
      statusHistory: {
        orderBy: { occurredAt: "asc" },
        select: {
          fromAxis: true,
          toAxis: true,
          community: true,
          occurredAt: true,
          datePrecision: true,
          reason: true,
          markerSource: { select: { name: true, url: true, publishedAt: true } },
        },
      },
    },
  });

  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const transitions = claim.statusHistory.map((s) => ({
    fromAxis: s.fromAxis,
    toAxis: s.toAxis,
    community: s.community,
    occurredAt: s.occurredAt.toISOString().slice(0, 10),
    datePrecision: s.datePrecision,
    reason: s.reason,
    source: s.markerSource
      ? { name: s.markerSource.name, url: s.markerSource.url }
      : { name: "(no marker source)", url: null },
  }));

  if (wantCsv) {
    const rows = [
      "community,fromAxis,toAxis,occurredAt,reason,sourceName,sourceUrl",
      ...transitions.map((t) =>
        [t.community, t.fromAxis ?? "", t.toAxis, t.occurredAt,
         `"${(t.reason ?? "").replace(/"/g, '""')}"`,
         `"${t.source.name.replace(/"/g, '""')}"`,
         t.source.url ?? ""].join(",")
      ),
    ].join("\n");
    return new Response(rows, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${id}.csv"`,
      },
    });
  }

  return NextResponse.json({ id, claim: claim.text, transitions });
}
