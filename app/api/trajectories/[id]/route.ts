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
  const format = url.searchParams.get("format");
  const wantCsv = format === "csv";
  const wantBibtex = format === "bibtex";
  const wantRis = format === "ris";

  const statusHistorySelect = {
    orderBy: [{ occurredAt: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      fromAxis: true,
      toAxis: true,
      community: true,
      occurredAt: true,
      datePrecision: true,
      reason: true,
      markerSource: { select: { name: true, url: true, publishedAt: true } },
    },
  };

  let claim = await prisma.claim.findFirst({
    where: { externalId: `trajectory:${id}`, deleted: false },
    select: { id: true, text: true, ingestedBy: true, claimEmergedAt: true, statusHistory: statusHistorySelect },
  });

  // Fallback: treat the path param as a raw claim CUID (corpus search results).
  if (!claim) {
    claim = await prisma.claim.findFirst({
      where: { id, deleted: false },
      select: { id: true, text: true, ingestedBy: true, claimEmergedAt: true, statusHistory: statusHistorySelect },
    });
  }

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

  if (wantBibtex) {
    const slug = claim.text.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "");
    const entries = transitions.map((t, i) => {
      const year = t.occurredAt.slice(0, 4);
      const key = `er_${slug}_${year}_${i + 1}`;
      const note = `Epistemic transition: ${t.fromAxis ?? "—"} → ${t.toAxis} (${t.community.replace(/_/g, " ").toLowerCase()}). ${t.reason ? t.reason.replace(/[{}]/g, "") : ""}`.trim();
      const lines = [
        `@misc{${key},`,
        `  title     = {${t.source.name.replace(/[{}]/g, "")}},`,
        t.source.url ? `  howpublished = {\\url{${t.source.url}}},` : null,
        `  year      = {${year}},`,
        `  note      = {${note}},`,
        `}`,
      ].filter(Boolean).join("\n");
      return lines;
    });
    const bib = [
      `% BibTeX export — Epistemic Receipts trajectory`,
      `% Claim: ${claim.text}`,
      `% Generated: ${new Date().toISOString().slice(0, 10)}`,
      "",
      ...entries,
    ].join("\n\n");
    return new Response(bib, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${id}.bib"`,
      },
    });
  }

  if (wantRis) {
    const entries = transitions.map((t) => {
      const ymd = t.occurredAt.split("-");
      const lines = [
        "TY  - ELEC",
        `TI  - ${t.source.name}`,
        t.source.url ? `UR  - ${t.source.url}` : null,
        `Y1  - ${ymd[0]}/${ymd[1] ?? "01"}/${ymd[2] ?? "01"}`,
        `N1  - Trajectory: ${claim.text.slice(0, 200)}`,
        `N1  - Transition: ${t.fromAxis ?? "—"} → ${t.toAxis} (${t.community.replace(/_/g, " ").toLowerCase()})`,
        t.reason ? `AB  - ${t.reason}` : null,
        "ER  - ",
      ].filter(Boolean).join("\n");
      return lines;
    });
    const ris = entries.join("\n\n");
    return new Response(ris, {
      headers: {
        "Content-Type": "application/x-research-info-systems",
        "Content-Disposition": `attachment; filename="${id}.ris"`,
      },
    });
  }

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

  return NextResponse.json({ id, claim: claim.text, transitions, ingestedBy: claim.ingestedBy ?? null });
}
