import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { US_VOTE_PIPELINES } from "@/lib/representationGap";

export const revalidate = 600;

// Helpers duplicated from representationGap.ts (kept local to avoid re-running full analysis)
function parseTopics(raw: string | null | undefined): string[] {
  if (!raw || !raw.startsWith("[")) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === "string" && t.length > 0);
  } catch {
    return [];
  }
}

function isYea(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "yea" || s === "yes" || s === "aye" || s === "y";
}

function isNay(v: string | null | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "nay" || s === "no" || s === "n";
}

export type TopicDrillRow = {
  state: string;
  year: number;
  constituentPct: number;
  delegationPct: number;
  gap: number;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  if (!slug || slug.length > 80) {
    return NextResponse.json({ error: "invalid slug" }, { status: 400 });
  }

  // Pull ConstituentOpinion rows for this topic
  const opinions = await prisma.constituentOpinion.findMany({
    where: { topicSlug: slug },
    select: { state: true, year: true, supportPct: true },
  });

  if (opinions.length === 0) {
    return NextResponse.json({ rows: [] });
  }

  // Build a lookup keyed by "STATE|YEAR"
  const opinionMap = new Map<string, number>();
  for (const o of opinions) {
    opinionMap.set(`${o.state}|${o.year}`, o.supportPct);
  }

  // Pull legislative votes that include this topic slug
  const votes = await prisma.legislativeVote.findMany({
    where: {
      source: { ingestedBy: { in: US_VOTE_PIPELINES } },
      topics: { not: null },
      voteDate: { not: null },
    },
    select: {
      voteDate: true,
      topics: true,
      memberVotes: {
        select: { memberState: true, vote: true },
      },
    },
    take: 50000,
  });

  // Aggregate per (state, year) for this specific topic
  const aggMap = new Map<
    string,
    { yea: number; total: number }
  >();

  for (const v of votes) {
    if (!v.voteDate) continue;
    const year = v.voteDate.getUTCFullYear();
    const topics = parseTopics(v.topics);
    if (!topics.includes(slug)) continue;
    if (!v.memberVotes || v.memberVotes.length === 0) continue;

    for (const mv of v.memberVotes) {
      if (!mv.memberState) continue;
      const state = mv.memberState.trim().toUpperCase();
      if (state.length !== 2) continue;
      const yea = isYea(mv.vote);
      const nay = isNay(mv.vote);
      if (!yea && !nay) continue;

      const key = `${state}|${year}`;
      const bucket = aggMap.get(key) ?? { yea: 0, total: 0 };
      if (yea) bucket.yea += 1;
      bucket.total += 1;
      aggMap.set(key, bucket);
    }
  }

  const rows: TopicDrillRow[] = [];
  for (const [key, bucket] of aggMap) {
    if (bucket.total < 3) continue;
    const constituentPct = opinionMap.get(key);
    if (constituentPct === undefined) continue;
    const delegationPct = (100 * bucket.yea) / bucket.total;
    const gap = Math.abs(delegationPct - constituentPct);
    const [state, yearStr] = key.split("|");
    rows.push({
      state,
      year: Number(yearStr),
      constituentPct,
      delegationPct,
      gap,
    });
  }

  rows.sort((a, b) => b.gap - a.gap);

  return NextResponse.json(
    { rows },
    { headers: { "Cache-Control": "s-maxage=600, stale-while-revalidate=3600" } }
  );
}
