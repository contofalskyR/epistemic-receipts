import { NextRequest, NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

// Reading ?format= makes this handler dynamic, so the old route-level
// `revalidate` never applied. The trajectory itself is cached for an hour per
// id (STATUS.md Phase 5); the export formats are rendered from the cached,
// already-stringified transitions. An id with no row at all throws, so it is
// never stored — caching those misses let any made-up id add a Data Cache
// entry (phase 6). A row that exists but is soft-deleted resolves null and is
// cached like a hit, so the key space stays bounded by real rows and a claim
// deleted after it was cached turns into a 404 on its next revalidation.
export const dynamic = "force-dynamic";

/** No claim row at all for this id (slug or raw id). Thrown inside the cached
 *  loader: unstable_cache stores nothing when its callback throws. */
class TrajectoryNotFound extends Error {}

const loadTrajectory = unstable_cache(async (id: string) => {
  const statusHistorySelect = {
    orderBy: [{ seq: "asc" as const }, { occurredAt: "asc" as const }, { createdAt: "asc" as const }],
    select: {
      id: true, // row id — its shape encodes which writer produced it (provenance chip)
      seq: true,
      fromAxis: true,
      toAxis: true,
      community: true,
      occurredAt: true,
      datePrecision: true,
      reason: true,
      markerSource: { select: { name: true, url: true, publishedAt: true, ingestedBy: true } },
    },
  };

  const select = { id: true, text: true, ingestedBy: true, claimEmergedAt: true, deleted: true, statusHistory: statusHistorySelect };
  // Curated slug first (externalId is unique), deleted or not.
  let claim = await prisma.claim.findFirst({ where: { externalId: `trajectory:${id}` }, select });

  // Fallback: treat the path param as a raw claim CUID (corpus search results);
  // a live raw-id row wins over a deleted slug row, as before.
  if (!claim || claim.deleted) {
    claim = (await prisma.claim.findFirst({ where: { id }, select })) ?? claim;
  }

  if (!claim) throw new TrajectoryNotFound(id);
  if (claim.deleted) return null;

  const transitions = claim.statusHistory.map((s) => ({
    id: s.id,
    seq: s.seq,
    fromAxis: s.fromAxis,
    toAxis: s.toAxis,
    community: s.community,
    occurredAt: s.occurredAt.toISOString().slice(0, 10),
    datePrecision: s.datePrecision,
    reason: s.reason,
    source: s.markerSource
      ? { name: s.markerSource.name, url: s.markerSource.url, ingestedBy: s.markerSource.ingestedBy ?? null }
      : { name: "(no marker source)", url: null, ingestedBy: null },
  }));

  return { text: claim.text, ingestedBy: claim.ingestedBy ?? null, transitions };
}, ["api-trajectory-detail"], { revalidate: 3600 });

const CACHE_CONTROL = "public, s-maxage=3600, stale-while-revalidate=86400";

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

  const claim = await loadTrajectory(id).catch((e: unknown) => {
    if (e instanceof TrajectoryNotFound) return null;
    throw e; // a database error stays a 5xx, never "not found"
  });
  if (!claim) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { transitions } = claim;

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

  return NextResponse.json(
    { id, claim: claim.text, transitions, ingestedBy: claim.ingestedBy },
    { headers: { "Cache-Control": CACHE_CONTROL } },
  );
}
