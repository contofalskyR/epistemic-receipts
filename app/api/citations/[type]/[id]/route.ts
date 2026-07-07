import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { SITE_URL } from "@/lib/site";
import {
  renderCitation,
  inferEntryType,
  makeCitationKey,
  type CitationFormat,
  type CitationSource,
} from "@/lib/citations/format";

export const revalidate = 3600;

const VALID_FORMATS: CitationFormat[] = ["bibtex", "csl-json", "ris"];
const VALID_TYPES = ["claim", "source"] as const;
type CitationType = (typeof VALID_TYPES)[number];

async function buildClaimSources(id: string): Promise<CitationSource[] | null> {
  const claim = await prisma.claim.findUnique({
    where: { id },
    select: {
      text: true,
      epistemicAxis: true,
      claimEmergedAt: true,
      edges: {
        where: { deleted: false },
        orderBy: { createdAt: "asc" },
        select: {
          type: true,
          source: {
            select: {
              name: true,
              url: true,
              publishedAt: true,
              methodologyType: true,
            },
          },
        },
      },
    },
  });
  if (!claim) return null;

  const seen = new Set<string>();
  const sources: CitationSource[] = [];

  for (const edge of claim.edges) {
    const src = edge.source;
    const dedupeKey = src.url ?? src.name;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const pubDate = src.publishedAt ? new Date(src.publishedAt) : null;
    const fallbackDate = claim.claimEmergedAt ? new Date(claim.claimEmergedAt) : null;
    const year = pubDate?.getUTCFullYear() ?? fallbackDate?.getUTCFullYear() ?? null;
    const month = pubDate?.getUTCMonth() != null ? pubDate.getUTCMonth() + 1 : null;

    const noteLines = [
      `Evidence for: ${claim.text.slice(0, 200)}`,
      `Relation: ${edge.type}`,
      claim.epistemicAxis ? `Epistemic axis: ${claim.epistemicAxis}` : null,
      `Source: ${SITE_URL}/claims/${id}`,
    ].filter(Boolean);

    sources.push({
      key: makeCitationKey("claim", src.name, year, sources.length),
      title: src.name,
      url: src.url ?? null,
      year,
      month,
      entryType: inferEntryType(src.url, src.methodologyType),
      note: noteLines.join(". "),
    });
  }

  return sources;
}

async function buildSourceSources(id: string): Promise<CitationSource[] | null> {
  const source = await prisma.source.findUnique({
    where: { id },
    select: {
      name: true,
      url: true,
      publishedAt: true,
      methodologyType: true,
    },
  });
  if (!source) return null;

  const pubDate = source.publishedAt ? new Date(source.publishedAt) : null;
  const year = pubDate?.getUTCFullYear() ?? null;
  const month = pubDate?.getUTCMonth() != null ? pubDate.getUTCMonth() + 1 : null;

  let authors: string[] | undefined;
  let journal: string | undefined;
  let volume: string | undefined;
  let issue: string | undefined;
  let doi: string | undefined;

  // Attempt OpenAlex enrichment: look for a claim linked to this source that has openAlexId
  const linkedClaim = await prisma.claim.findFirst({
    where: {
      openAlexId: { not: null },
      edges: { some: { sourceId: id, deleted: false } },
    },
    select: { openAlexId: true },
  });

  if (linkedClaim?.openAlexId) {
    try {
      const res = await fetch(
        `https://api.openalex.org/works/${linkedClaim.openAlexId}?select=authorships,primary_location,biblio,doi`,
        { signal: AbortSignal.timeout(3000) },
      );
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.authorships)) {
          authors = data.authorships
            .slice(0, 10)
            .map((a: { author?: { display_name?: string } }) => a.author?.display_name)
            .filter(Boolean);
        }
        journal = data.primary_location?.source?.display_name ?? undefined;
        volume = data.biblio?.volume ?? undefined;
        issue = data.biblio?.issue ?? undefined;
        doi = data.doi?.replace("https://doi.org/", "") ?? undefined;
      }
    } catch {
      // OpenAlex unreachable — export with base fields
    }
  }

  const entryType = inferEntryType(source.url, source.methodologyType);

  return [
    {
      key: makeCitationKey("src", source.name, year, 0),
      title: source.name,
      url: source.url ?? null,
      year,
      month,
      authors,
      journal,
      volume,
      issue,
      doi,
      entryType,
      note: `Via Epistemic Receipts (${SITE_URL}/sources/${id})`,
    },
  ];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  const url = new URL(req.url);
  const rawFormat = url.searchParams.get("format") ?? "bibtex";

  if (!VALID_FORMATS.includes(rawFormat as CitationFormat)) {
    return NextResponse.json(
      { error: `Unsupported format. Use: ${VALID_FORMATS.join(", ")}` },
      { status: 400 },
    );
  }
  const format = rawFormat as CitationFormat;

  if (!VALID_TYPES.includes(type as CitationType)) {
    return NextResponse.json(
      { error: `Unsupported type. Use: ${VALID_TYPES.join(", ")}` },
      { status: 400 },
    );
  }

  let sources: CitationSource[] | null = null;

  if (type === "claim") {
    sources = await buildClaimSources(id);
  } else if (type === "source") {
    sources = await buildSourceSources(id);
  }

  if (sources === null) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (sources.length === 0) {
    return NextResponse.json(
      { error: "No citable sources found for this entity" },
      { status: 422 },
    );
  }

  const { body, contentType, ext } = renderCitation(format, sources);

  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${type}-${id}.${ext}"`,
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
    },
  });
}
