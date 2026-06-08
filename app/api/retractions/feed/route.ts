import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

const RATE_LIMIT = 100;

type ClaimRow = {
  id: string;
  text: string;
  epistemicAxis: string | null;
  verificationStatus: string | null;
  ingestedBy: string;
  createdAt: Date;
  updatedAt?: Date;
  claimEmergedAt: Date | null;
  metadata: unknown;
  edges: { source: { name: string; url: string | null } }[];
  topics: { topic: { id: string; name: string; slug: string } }[];
};

type ClaimMeta = {
  title?: string;
  journal?: string;
  publisher?: string;
  doi?: string;
  updateType?: string;
} | null;

function titleFromMeta(meta: ClaimMeta, text: string): string {
  if (meta?.title?.trim()) return meta.title.trim();
  const m = text.match(/"([^"]+)"/);
  if (m) return m[1];
  return text.slice(0, 200);
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  const field = (url.searchParams.get("field") ?? "").trim().toLowerCase();
  const journal = (url.searchParams.get("journal") ?? "").trim().toLowerCase();
  const since = (url.searchParams.get("since") ?? "").trim();
  const limitRaw = Number.parseInt(url.searchParams.get("limit") ?? "25", 10);
  const limit = Math.max(1, Math.min(RATE_LIMIT, isNaN(limitRaw) ? 25 : limitRaw));
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Math.max(1, isNaN(pageRaw) ? 1 : pageRaw);
  const skip = (page - 1) * limit;

  let sinceDate: Date | null = null;
  if (since) {
    sinceDate = new Date(since);
    if (isNaN(sinceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid `since` date. Use ISO 8601 format (e.g. 2024-01-01)." },
        { status: 400 },
      );
    }
  }

  const baseWhere = {
    deleted: false,
    OR: [
      {
        epistemicAxis: "CONTESTED",
        ingestedBy: "crossref_retractions_v1",
      },
      {
        verificationStatus: "DISPUTED",
      },
    ],
    ...(sinceDate
      ? {
          claimEmergedAt: { gte: sinceDate },
        }
      : {}),
    ...(field
      ? {
          topics: {
            some: {
              topic: {
                slug: { contains: field, mode: "insensitive" as const },
              },
            },
          },
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.claim.count({ where: baseWhere }),
    prisma.claim.findMany({
      where: baseWhere,
      orderBy: [{ claimEmergedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      skip,
      select: {
        id: true,
        text: true,
        epistemicAxis: true,
        verificationStatus: true,
        ingestedBy: true,
        createdAt: true,
        claimEmergedAt: true,
        metadata: true,
        edges: {
          where: { deleted: false },
          take: 1,
          select: {
            source: { select: { name: true, url: true } },
          },
        },
        topics: {
          take: 5,
          select: {
            topic: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    }),
  ]);

  // Post-filter by journal (metadata JSON field — can't push to DB easily)
  const filtered: ClaimRow[] = journal
    ? (rows as ClaimRow[]).filter((r) => {
        const meta = r.metadata as ClaimMeta;
        return (meta?.journal ?? "").toLowerCase().includes(journal);
      })
    : (rows as ClaimRow[]);

  const data = filtered.map((r) => {
    const meta = r.metadata as ClaimMeta;
    return {
      id: r.id,
      title: titleFromMeta(meta, r.text),
      description: r.text,
      sourceUrl: r.edges[0]?.source?.url ?? null,
      epistemicAxis: r.epistemicAxis,
      verificationStatus: r.verificationStatus,
      source: r.ingestedBy,
      journal: meta?.journal ?? null,
      publisher: meta?.publisher ?? null,
      doi: meta?.doi ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.createdAt.toISOString(),
      retractionDate: r.claimEmergedAt ? r.claimEmergedAt.toISOString() : null,
      topics: r.topics.map((t) => ({
        id: t.topic.id,
        name: t.topic.name,
        slug: t.topic.slug,
      })),
    };
  });

  const remaining = Math.max(0, RATE_LIMIT - limit);

  return NextResponse.json(
    {
      data,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        generated_at: new Date().toISOString(),
      },
    },
    {
      headers: {
        "X-RateLimit-Limit": `${RATE_LIMIT}`,
        "X-RateLimit-Remaining": `${remaining}`,
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    },
  );
}
