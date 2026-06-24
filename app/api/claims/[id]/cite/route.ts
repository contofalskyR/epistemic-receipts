import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 600;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const format = new URL(req.url).searchParams.get("format") ?? "bibtex";

  const claim = await prisma.claim.findUnique({
    where: { id },
    select: {
      text: true,
      epistemicAxis: true,
      claimEmergedAt: true,
      edges: {
        where: { deleted: false },
        select: {
          type: true,
          source: {
            select: { name: true, url: true, publishedAt: true },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!claim) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Deduplicate sources by URL (or name if no URL)
  const seen = new Set<string>();
  const sources = claim.edges
    .map((e) => ({ type: e.type, ...e.source }))
    .filter((s) => {
      const key = s.url ?? s.name;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  const claimSlug = claim.text.slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/_+$/, "");

  if (format === "bibtex") {
    const entries = sources.map((s, i) => {
      const year = s.publishedAt
        ? new Date(s.publishedAt).getFullYear().toString()
        : (claim.claimEmergedAt ? new Date(claim.claimEmergedAt).getFullYear().toString() : "n.d.");
      const key = `er_${claimSlug}_${year}_${i + 1}`;
      const lines = [
        `@misc{${key},`,
        `  title        = {${s.name.replace(/[{}]/g, "")}},`,
        s.url ? `  howpublished = {\\url{${s.url}}},` : null,
        year !== "n.d." ? `  year         = {${year}},` : `  year         = {n.d.},`,
        `  note         = {Evidence for: ${claim.text.slice(0, 200).replace(/[{}]/g, "")}. Relation: ${s.type}. Via Epistemic Receipts (epistemic-receipts.vercel.app)},`,
        `}`,
      ].filter(Boolean).join("\n");
      return lines;
    });

    const bib = [
      `% BibTeX export — Epistemic Receipts`,
      `% Claim: ${claim.text}`,
      `% Axis: ${claim.epistemicAxis ?? "unknown"}`,
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

  if (format === "ris") {
    const entries = sources.map((s) => {
      const date = s.publishedAt ? new Date(s.publishedAt) : null;
      const lines = [
        "TY  - ELEC",
        `TI  - ${s.name}`,
        s.url ? `UR  - ${s.url}` : null,
        date
          ? `Y1  - ${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}`
          : null,
        `N1  - Claim: ${claim.text.slice(0, 200)}`,
        `N1  - Evidence relation: ${s.type}`,
        `N1  - Epistemic axis: ${claim.epistemicAxis ?? "unknown"}`,
        `N1  - Source: Epistemic Receipts (epistemic-receipts.vercel.app/claims/${id})`,
        "ER  - ",
      ].filter(Boolean).join("\n");
      return lines;
    });

    return new Response(entries.join("\n\n"), {
      headers: {
        "Content-Type": "application/x-research-info-systems",
        "Content-Disposition": `attachment; filename="${id}.ris"`,
      },
    });
  }

  return NextResponse.json({ error: "unsupported format — use ?format=bibtex or ?format=ris" }, { status: 400 });
}
