import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractPartyCounts } from "@/lib/voteAnalysis";

export const revalidate = 300;

const PAGE_SIZE = 50;

function parseTopics(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const page = Math.max(1, parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10));

  const event = await prisma.historicalEvent.findUnique({
    where: { slug },
    include: {
      _count: { select: { claims: true, votes: true, polities: true } },
      polities: {
        include: {
          polity: {
            select: {
              id: true,
              name: true,
              countryCode: true,
              startYear: true,
              endYear: true,
              governmentType: true,
              wikidataId: true,
            },
          },
        },
      },
    },
  });
  if (!event) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Paginated linked votes (sorted by date desc) — for the table.
  const [voteLinks, totalVotes] = await Promise.all([
    prisma.historicalEventVote.findMany({
      where: { eventId: event.id },
      orderBy: { vote: { voteDate: "desc" } },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        vote: {
          select: {
            id: true,
            voteDate: true,
            chamber: true,
            result: true,
            yesCount: true,
            noCount: true,
            abstainCount: true,
            dataSource: true,
            topics: true,
            source: { select: { id: true, name: true, url: true } },
          },
        },
      },
    }),
    prisma.historicalEventVote.count({ where: { eventId: event.id } }),
  ]);

  // Aggregate stats across ALL linked votes for this event (not just current page).
  // Pull minimal fields so this stays cheap even for 28k-link events (Cold War).
  const allVotes = await prisma.historicalEventVote.findMany({
    where: { eventId: event.id },
    select: {
      vote: {
        select: {
          voteDate: true,
          result: true,
          yesCount: true,
          noCount: true,
          chamber: true,
          byPartyJson: true,
        },
      },
    },
  });

  // Result breakdown
  const resultBreakdown: Record<string, number> = {};
  for (const link of allVotes) {
    const r = link.vote.result ?? "unknown";
    resultBreakdown[r] = (resultBreakdown[r] ?? 0) + 1;
  }

  // Yearly timeline
  const yearMap = new Map<number, { passed: number; failed: number; other: number; total: number }>();
  for (const link of allVotes) {
    const d = link.vote.voteDate;
    if (!d) continue;
    const year = d.getUTCFullYear();
    let bucket = yearMap.get(year);
    if (!bucket) {
      bucket = { passed: 0, failed: 0, other: 0, total: 0 };
      yearMap.set(year, bucket);
    }
    bucket.total++;
    const r = link.vote.result ?? "unknown";
    if (r === "passed") bucket.passed++;
    else if (r === "failed") bucket.failed++;
    else bucket.other++;
  }
  const timeline = Array.from(yearMap.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([year, c]) => ({ year, ...c }));

  // Chamber breakdown
  const chamberMap = new Map<string, { passed: number; failed: number; total: number }>();
  for (const link of allVotes) {
    const ch = link.vote.chamber || "unknown";
    let b = chamberMap.get(ch);
    if (!b) {
      b = { passed: 0, failed: 0, total: 0 };
      chamberMap.set(ch, b);
    }
    b.total++;
    if (link.vote.result === "passed") b.passed++;
    else if (link.vote.result === "failed") b.failed++;
  }
  const chambers = Array.from(chamberMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([chamber, c]) => ({ chamber, ...c }));

  // Party breakdown — only for votes carrying byPartyJson (sparse in our corpus).
  const partyTotals = new Map<string, { yes: number; no: number; abstain: number; billCount: number }>();
  let partyRowsParsed = 0;
  for (const link of allVotes) {
    if (!link.vote.byPartyJson) continue;
    let raw: unknown;
    try { raw = JSON.parse(link.vote.byPartyJson); } catch { continue; }
    const parsed = extractPartyCounts(raw);
    if (Object.keys(parsed).length === 0) continue;
    partyRowsParsed++;
    for (const [party, counts] of Object.entries(parsed)) {
      const cur = partyTotals.get(party) ?? { yes: 0, no: 0, abstain: 0, billCount: 0 };
      cur.yes += counts.yes;
      cur.no += counts.no;
      cur.abstain += counts.abstain;
      cur.billCount += 1;
      partyTotals.set(party, cur);
    }
  }
  const parties = Array.from(partyTotals.entries())
    .map(([party, c]) => ({
      party,
      yes: c.yes,
      no: c.no,
      abstain: c.abstain,
      billCount: c.billCount,
      total: c.yes + c.no + c.abstain,
    }))
    .filter((p) => p.billCount >= 1)
    .sort((a, b) => b.total - a.total);

  // Recent linked claims (top 20).
  const claimLinks = await prisma.claimHistoricalEvent.findMany({
    where: { historicalEventId: event.id },
    take: 20,
    orderBy: { createdAt: "desc" },
    include: {
      claim: {
        select: {
          id: true,
          text: true,
          currentStatus: true,
          claimType: true,
          verificationStatus: true,
          createdAt: true,
          claimEmergedAt: true,
        },
      },
    },
  });

  return NextResponse.json({
    event: {
      id: event.id,
      slug: event.slug,
      name: event.name,
      description: event.description,
      startDate: event.startDate?.toISOString() ?? null,
      endDate: event.endDate?.toISOString() ?? null,
      category: event.category,
      claimCount: event._count.claims,
      voteCount: event._count.votes,
      polityCount: event._count.polities,
    },
    pagination: {
      page,
      pageSize: PAGE_SIZE,
      total: totalVotes,
      pageCount: Math.max(1, Math.ceil(totalVotes / PAGE_SIZE)),
    },
    votes: voteLinks.map((l) => ({
      voteId: l.vote.id,
      matchReason: l.matchReason,
      voteDate: l.vote.voteDate?.toISOString() ?? null,
      chamber: l.vote.chamber,
      result: l.vote.result,
      yesCount: l.vote.yesCount,
      noCount: l.vote.noCount,
      abstainCount: l.vote.abstainCount,
      dataSource: l.vote.dataSource,
      topics: parseTopics(l.vote.topics),
      sourceName: l.vote.source?.name ?? null,
      sourceUrl: l.vote.source?.url ?? null,
    })),
    polities: event.polities
      .map((p) => ({
        polityId: p.polity.id,
        role: p.role,
        name: p.polity.name,
        countryCode: p.polity.countryCode,
        governmentType: p.polity.governmentType,
        startYear: p.polity.startYear,
        endYear: p.polity.endYear,
        wikidataId: p.polity.wikidataId,
      }))
      .sort((a, b) => {
        const roleOrder = (r: string) =>
          r === "primary" ? 0 : r === "adversary" ? 1 : r === "involved" ? 2 : 3;
        return roleOrder(a.role) - roleOrder(b.role) || a.name.localeCompare(b.name);
      }),
    claims: claimLinks.map((l) => ({
      id: l.claim.id,
      text: l.claim.text,
      currentStatus: l.claim.currentStatus,
      claimType: l.claim.claimType,
      verificationStatus: l.claim.verificationStatus,
      createdAt: l.claim.createdAt.toISOString(),
      claimEmergedAt: l.claim.claimEmergedAt?.toISOString() ?? null,
    })),
    stats: {
      resultBreakdown,
      timeline,
      chambers,
      parties,
      partyRowsParsed,
    },
  });
}
