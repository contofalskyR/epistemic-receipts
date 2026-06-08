import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractPartyCounts,
  CONTESTED_THRESHOLD,
  MIN_TOTAL,
  type PartyBreakdown,
} from "@/lib/voteAnalysis";

const PAGE_SIZE = 20;

// Build parent chain by walking up the nested parentTopic relations.
function buildParentChain(
  topic: { name: string; slug: string; parentTopic?: { name: string; slug: string; parentTopic?: { name: string; slug: string; parentTopic?: { name: string; slug: string } | null } | null } | null }
): { name: string; slug: string }[] {
  const chain: { name: string; slug: string }[] = [];
  let current = topic.parentTopic;
  while (current) {
    chain.unshift({ name: current.name, slug: current.slug });
    current = current.parentTopic ?? null;
  }
  return chain;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));
  const sort = req.nextUrl.searchParams.get("sort") ?? "emerged_desc";
  const party = req.nextUrl.searchParams.get("party") ?? "";
  const leader = req.nextUrl.searchParams.get("leader") ?? "";
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const topic = await prisma.topic.findUnique({
    where: { slug },
    include: {
      parentTopic: {
        include: {
          parentTopic: { include: { parentTopic: true } },
        },
      },
      children: {
        include: {
          _count: { select: { claims: true } },
          children: {
            include: { _count: { select: { claims: true } } },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!topic) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Sibling topics
  const siblings = topic.parentTopicId
    ? await prisma.topic.findMany({
        where: { parentTopicId: topic.parentTopicId, id: { not: topic.id } },
        include: { _count: { select: { claims: true } } },
        orderBy: { name: "asc" },
      })
    : [];

  const showDeprecated = req.nextUrl.searchParams.get("deprecated") === "1";
  const baseClaimFilter = {
    deleted: false,
    ...(showDeprecated ? {} : { NOT: { verificationStatus: "DEPRECATED" } }),
  };
  const pcFilter = party || leader ? {
    edges: {
      some: {
        source: {
          politicalContext: {
            ...(party ? { hogParty: party } : {}),
            ...(leader ? { headOfGovernment: leader } : {}),
          },
        },
      },
    },
  } : {};
  const qFilter = q ? { text: { contains: q, mode: "insensitive" as const } } : {};

  // Include claims from children and grandchildren so container topics
  // (Congress → Era → Session) aggregate all descendant claims.
  const grandchildIds = topic.children.flatMap(c => c.children.map((gc: { id: string }) => gc.id));
  const topicIds = [topic.id, ...topic.children.map(c => c.id), ...grandchildIds];
  const claimWhere = {
    topicId: { in: topicIds },
    claim: { ...baseClaimFilter, ...pcFilter, ...qFilter },
  };

  const claimOrderBy =
    sort === "most_sources"
      ? { claim: { edges: { _count: "desc" as const } } }
      : sort === "emerged_asc"
        ? { claim: { claimEmergedAt: "asc" as const } }
        : { claim: { claimEmergedAt: "desc" as const } };

  const [total, claimTopics] = await Promise.all([
    prisma.claimTopic.count({ where: claimWhere }),
    prisma.claimTopic.findMany({
      where: claimWhere,
      orderBy: claimOrderBy,
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        claim: {
          include: {
            _count: { select: { edges: { where: { deleted: false } } } },
            topics: { select: { topic: { select: { id: true, name: true, slug: true, domain: true } } } },
            edges: {
              where: { deleted: false },
              select: {
                source: {
                  select: {
                    politicalContext: { select: { hogParty: true, headOfGovernment: true } },
                    legislativeVotes: {
                      select: { chamber: true, yesCount: true, noCount: true, abstainCount: true, totalSeats: true },
                      take: 1,
                    },
                  },
                },
              },
              take: 5,
            },
          },
        },
      },
    }),
  ]);

  // Aggregate party/leader counts in a single query instead of N+1 per party/leader.
  const partyClaimRows = await prisma.claimTopic.findMany({
    where: { topicId: { in: topicIds }, claim: baseClaimFilter },
    select: {
      claim: {
        select: {
          edges: {
            where: { deleted: false },
            select: { source: { select: { politicalContext: { select: { hogParty: true, headOfGovernment: true } } } } },
            take: 1,
          },
        },
      },
    },
    take: 5000,
  });

  const partyCountMap = new Map<string, number>();
  const leaderCountMap = new Map<string, Map<string, number>>();
  for (const row of partyClaimRows) {
    for (const edge of row.claim.edges) {
      const p = edge.source.politicalContext?.hogParty;
      const l = edge.source.politicalContext?.headOfGovernment;
      if (p) partyCountMap.set(p, (partyCountMap.get(p) ?? 0) + 1);
      if (p && l) {
        if (!leaderCountMap.has(p)) leaderCountMap.set(p, new Map());
        const lm = leaderCountMap.get(p)!;
        lm.set(l, (lm.get(l) ?? 0) + 1);
      }
    }
  }

  const availableParties = Array.from(partyCountMap.entries())
    .map(([p, claimCount]) => ({ party: p, claimCount }))
    .sort((a, b) => b.claimCount - a.claimCount);

  const availableLeaders = party
    ? Array.from(leaderCountMap.get(party)?.entries() ?? [])
        .map(([leader, claimCount]) => ({ leader, claimCount }))
        .sort((a, b) => b.claimCount - a.claimCount)
    : [];

  // Topic-wide aggregates (ignore party/leader filter — these describe the topic as a whole).
  const topicClaimFilter = {
    ...baseClaimFilter,
    topics: { some: { topicId: { in: topicIds } } },
  };

  const [timelineClaims, topicVotes, sourceTagRows] = await Promise.all([
    prisma.claim.findMany({
      where: topicClaimFilter,
      select: { claimEmergedAt: true, createdAt: true },
      take: 5000,
    }),
    prisma.legislativeVote.findMany({
      where: {
        yesCount: { not: null },
        noCount: { not: null },
        source: {
          edges: {
            some: { deleted: false, claim: topicClaimFilter },
          },
        },
      },
      select: { id: true, yesCount: true, noCount: true, byPartyJson: true },
      take: 2000,
    }),
    prisma.claim.findMany({
      where: topicClaimFilter,
      select: { ingestedBy: true },
      distinct: ["ingestedBy"],
    }),
  ]);

  const yearCounts = new Map<number, number>();
  for (const c of timelineClaims) {
    const d = c.claimEmergedAt ?? c.createdAt;
    const year = d.getUTCFullYear();
    yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
  }
  const timeline = Array.from(yearCounts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // Vote stats: contested vs. unanimous, mean aye/nay percentages.
  type ScoredVote = { yes: number; no: number; total: number; ayePct: number; nayPct: number };
  const scored: ScoredVote[] = [];
  for (const v of topicVotes) {
    const yes = v.yesCount ?? 0;
    const no = v.noCount ?? 0;
    const t = yes + no;
    if (t < MIN_TOTAL) continue;
    scored.push({ yes, no, total: t, ayePct: (yes / t) * 100, nayPct: (no / t) * 100 });
  }
  const contestedCount = scored.filter(s => s.no / s.total > CONTESTED_THRESHOLD).length;
  const unanimousCount = scored.filter(s => s.no === 0).length;
  const voteStats = scored.length > 0
    ? {
        totalVotes: scored.length,
        contestedCount,
        contestedPct: (contestedCount / scored.length) * 100,
        unanimousCount,
        unanimousPct: (unanimousCount / scored.length) * 100,
        avgAyePct: scored.reduce((s, r) => s + r.ayePct, 0) / scored.length,
        avgNayPct: scored.reduce((s, r) => s + r.nayPct, 0) / scored.length,
        contestedThreshold: CONTESTED_THRESHOLD,
        minTotal: MIN_TOTAL,
      }
    : null;

  // Party tallies aggregated across LegislativeVote.byPartyJson for this topic.
  const partyTotals = new Map<string, PartyBreakdown & { billCount: number }>();
  let partyRowsParsed = 0;
  for (const v of topicVotes) {
    if (!v.byPartyJson) continue;
    let raw: unknown;
    try { raw = JSON.parse(v.byPartyJson); } catch { continue; }
    const parsed = extractPartyCounts(raw);
    if (Object.keys(parsed).length === 0) continue;
    partyRowsParsed++;
    for (const [party, counts] of Object.entries(parsed)) {
      const prev = partyTotals.get(party) ?? { yes: 0, no: 0, abstain: 0, billCount: 0 };
      prev.yes += counts.yes;
      prev.no += counts.no;
      prev.abstain += counts.abstain;
      prev.billCount += 1;
      partyTotals.set(party, prev);
    }
  }
  const partyVoteTallies = Array.from(partyTotals.entries())
    .map(([party, v]) => {
      const total = v.yes + v.no + v.abstain;
      return {
        party,
        yes: v.yes,
        no: v.no,
        abstain: v.abstain,
        billCount: v.billCount,
        totalVotes: total,
        yesPct: total > 0 ? (v.yes / total) * 100 : 0,
        noPct: total > 0 ? (v.no / total) * 100 : 0,
        abstainPct: total > 0 ? (v.abstain / total) * 100 : 0,
      };
    })
    .sort((a, b) => b.totalVotes - a.totalVotes);

  const sourceTags = sourceTagRows
    .map(r => r.ingestedBy)
    .filter(s => s && s !== "manual")
    .sort();

  const res = NextResponse.json({
    topic: {
      id: topic.id, name: topic.name, slug: topic.slug,
      domain: topic.domain, description: topic.description,
      parentTopicId: topic.parentTopicId,
      children: topic.children.map(c => ({
        id: c.id, name: c.name, slug: c.slug,
        claimCount: c._count.claims + c.children.reduce((sum: number, gc: { _count: { claims: number } }) => sum + gc._count.claims, 0),
      })),
    },
    parentChain: buildParentChain(topic),
    siblings: siblings.map(s => ({ id: s.id, name: s.name, slug: s.slug, claimCount: s._count.claims })),
    claims: claimTopics.map(ct => ct.claim),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
    availableParties,
    availableLeaders,
    timeline,
    voteStats,
    partyVoteTallies,
    partyRowsParsed,
    sourceTags,
  });
  res.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
  return res;
}
