import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { can } from "@/lib/entitlements";
import { SITE_URL } from "@/lib/site";
import {
  renderCitation,
  inferEntryType,
  makeCitationKey,
  type CitationFormat,
  type CitationSource,
} from "@/lib/citations/format";

export const dynamic = "force-dynamic";

// GET /api/collections/[id]/export?format=bibtex|csl-json|ris|csv
// Gated on export.citations entitlement.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const { id: collectionId } = await params;

  // Ownership
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, ownerId: session.user.id },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          claim: {
            select: {
              id: true,
              text: true,
              epistemicAxis: true,
              claimEmergedAt: true,
              edges: {
                where: { deleted: false },
                orderBy: { createdAt: "asc" },
                select: {
                  type: true,
                  source: {
                    select: { name: true, url: true, publishedAt: true, methodologyType: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!collection) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Entitlement check
  const membership = await prisma.membership.findFirst({
    where: { userId: session.user.id },
    include: { org: { select: { id: true, tier: true } } },
  });
  const ctx = membership
    ? {
        user: { id: session.user.id },
        org: { id: membership.org.id, tier: membership.org.tier as "free" | "pro" | "team" | "enterprise" },
      }
    : { user: { id: session.user.id } };

  if (!can(ctx, "export.citations")) {
    return NextResponse.json(
      { error: "Citation export requires an org subscription", upgrade: true },
      { status: 402 },
    );
  }

  const url = new URL(req.url);
  const format = (url.searchParams.get("format") ?? "bibtex") as CitationFormat | "csv";

  if (format === "csv") {
    const rows: string[] = [
      "collection_name,claim_id,claim_text,epistemic_axis,note,url",
    ];
    for (const item of collection.items) {
      const c = item.claim;
      const sourceUrl = c.edges[0]?.source?.url ?? "";
      const csvEscape = (s: string) => `"${s.replace(/"/g, '""')}"`;
      rows.push(
        [
          csvEscape(collection.name),
          csvEscape(c.id),
          csvEscape(c.text.slice(0, 300)),
          csvEscape(c.epistemicAxis ?? ""),
          csvEscape(item.note ?? ""),
          csvEscape(`${SITE_URL}/claims/${c.id}`),
        ].join(","),
      );
    }
    return new Response(rows.join("\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="collection-${collectionId}.csv"`,
      },
    });
  }

  const validFormats: CitationFormat[] = ["bibtex", "csl-json", "ris"];
  if (!validFormats.includes(format)) {
    return NextResponse.json(
      { error: "Unsupported format. Use: bibtex, csl-json, ris, csv" },
      { status: 400 },
    );
  }

  // Build citation sources from all collection items
  const allSources: CitationSource[] = [];
  const globalSeen = new Set<string>();

  for (const item of collection.items) {
    const c = item.claim;
    for (const edge of c.edges) {
      const src = edge.source;
      const dedupeKey = src.url ?? src.name;
      if (globalSeen.has(dedupeKey)) continue;
      globalSeen.add(dedupeKey);

      const pubDate = src.publishedAt ? new Date(src.publishedAt) : null;
      const fallbackDate = c.claimEmergedAt ? new Date(c.claimEmergedAt) : null;
      const year = pubDate?.getUTCFullYear() ?? fallbackDate?.getUTCFullYear() ?? null;
      const month = pubDate?.getUTCMonth() != null ? pubDate.getUTCMonth() + 1 : null;

      const noteLines = [
        `Evidence for: ${c.text.slice(0, 200)}`,
        `Relation: ${edge.type}`,
        c.epistemicAxis ? `Epistemic axis: ${c.epistemicAxis}` : null,
        `Source: ${SITE_URL}/claims/${c.id}`,
        item.note ? `Collection note: ${item.note}` : null,
      ].filter(Boolean);

      allSources.push({
        key: makeCitationKey("col", src.name, year, allSources.length),
        title: src.name,
        url: src.url ?? null,
        year,
        month,
        entryType: inferEntryType(src.url, src.methodologyType),
        note: noteLines.join(". "),
      });
    }
  }

  if (allSources.length === 0) {
    return NextResponse.json({ error: "Collection has no citable sources" }, { status: 422 });
  }

  const { body, contentType, ext } = renderCitation(format, allSources);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="collection-${collectionId}.${ext}"`,
    },
  });
}
