import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const revalidate = 60;

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type VoteHit = {
  id: string;
  chamber: string;
  yesCount: number | null;
  noCount: number | null;
  abstainCount: number | null;
  voteDate: string | null;
  result: string | null;
  topics: string[];
  sourceName: string;
  sourceUrl: string | null;
};

function parseTopics(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.filter(t => typeof t === "string");
  } catch {
    // fall through
  }
  return [];
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const chamberRaw = (url.searchParams.get("chamber") ?? "all").toLowerCase();
  const resultRaw = (url.searchParams.get("result") ?? "all").toLowerCase();
  const yearRaw = (url.searchParams.get("year") ?? "").trim();
  const dateFromRaw = (url.searchParams.get("dateFrom") ?? "").trim();
  const dateToRaw = (url.searchParams.get("dateTo") ?? "").trim();

  const limit = Math.max(
    1,
    Math.min(
      MAX_LIMIT,
      Number.parseInt(url.searchParams.get("limit") ?? `${DEFAULT_LIMIT}`, 10) || DEFAULT_LIMIT,
    ),
  );
  const offset = Math.max(0, Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0);

  const where: Prisma.LegislativeVoteWhereInput = {
    source: { ingestedBy: "voteview_v1" },
  };

  if (chamberRaw === "house") where.chamber = "House";
  else if (chamberRaw === "senate") where.chamber = "Senate";

  if (resultRaw === "passed" || resultRaw === "failed" || resultRaw === "tied" || resultRaw === "unknown") {
    where.result = resultRaw;
  }

  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if (isoDate.test(dateFromRaw) || isoDate.test(dateToRaw)) {
    const dateFilter: Prisma.DateTimeNullableFilter = {};
    if (isoDate.test(dateFromRaw)) {
      const d = new Date(`${dateFromRaw}T00:00:00.000Z`);
      if (!Number.isNaN(d.getTime())) dateFilter.gte = d;
    }
    if (isoDate.test(dateToRaw)) {
      const d = new Date(`${dateToRaw}T23:59:59.999Z`);
      if (!Number.isNaN(d.getTime())) dateFilter.lte = d;
    }
    where.voteDate = dateFilter;
  } else if (/^\d{4}$/.test(yearRaw)) {
    const year = Number.parseInt(yearRaw, 10);
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));
    where.voteDate = { gte: start, lt: end };
  }

  if (q.length > 0) {
    where.source = {
      ingestedBy: "voteview_v1",
      name: { contains: q, mode: "insensitive" },
    };
  }

  const [total, rows] = await Promise.all([
    prisma.legislativeVote.count({ where }),
    prisma.legislativeVote.findMany({
      where,
      orderBy: [{ voteDate: "desc" }, { id: "desc" }],
      take: limit,
      skip: offset,
      select: {
        id: true,
        chamber: true,
        yesCount: true,
        noCount: true,
        abstainCount: true,
        voteDate: true,
        result: true,
        topics: true,
        source: { select: { name: true, url: true } },
      },
    }),
  ]);

  const votes: VoteHit[] = rows.map(r => ({
    id: r.id,
    chamber: r.chamber,
    yesCount: r.yesCount,
    noCount: r.noCount,
    abstainCount: r.abstainCount,
    voteDate: r.voteDate ? r.voteDate.toISOString() : null,
    result: r.result,
    topics: parseTopics(r.topics),
    sourceName: r.source.name,
    sourceUrl: r.source.url,
  }));

  return NextResponse.json({ total, votes });
}
