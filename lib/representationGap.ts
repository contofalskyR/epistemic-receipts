import { prisma } from "@/lib/prisma";

export const US_VOTE_PIPELINES = ["congress_v1", "voteview_v1"];

export type StateTopicGapRow = {
  state: string;
  year: number;
  topicSlug: string;
  questionCode: string;
  billCount: number;
  memberVoteCount: number;
  delegationYeaPct: number; // 0–100
  constituentSupportPct: number; // 0–100 (liberal-direction support)
  gap: number; // |delegationYeaPct - constituentSupportPct|
  sampleSize: number; // CCES respondents
  demYeaPct: number | null;
  repYeaPct: number | null;
  demGap: number | null; // |demYeaPct - constituentSupportPct|
  repGap: number | null; // |repYeaPct - (100 - constituentSupportPct)|
};

export type TopicSummary = {
  topicSlug: string;
  questionCode: string;
  matchedRowCount: number;
  avgGap: number;
  avgDelegationYeaPct: number;
  avgConstituentSupportPct: number;
  avgDemGap: number | null;
  avgRepGap: number | null;
  topGapStates: { state: string; year: number; gap: number }[];
};

export type DecadeSummary = {
  decade: string;
  matchedRowCount: number;
  avgGap: number;
  avgDemGap: number | null;
  avgRepGap: number | null;
};

export type StateSummary = {
  state: string;
  matchedRowCount: number;
  avgGap: number;
  avgDemGap: number | null;
  avgRepGap: number | null;
  topTopics: { topicSlug: string; gap: number; year: number }[];
};

export type PartyComparison = {
  demAvgGap: number | null;
  repAvgGap: number | null;
  demRowCount: number;
  repRowCount: number;
  topicBreakdown: {
    topicSlug: string;
    demAvgGap: number | null;
    repAvgGap: number | null;
    sampleCount: number;
  }[];
};

export type RepresentationAnalysis = {
  meta: {
    constituentOpinionRows: number;
    legislativeVotesScanned: number;
    matchedRowCount: number;
    statesCovered: number;
    yearRange: [number, number] | null;
    topicsMatched: number;
  };
  topGapRows: StateTopicGapRow[]; // top 50 individual (state, year, topic) gaps
  topicSummaries: TopicSummary[];
  decadeSummaries: DecadeSummary[];
  stateSummaries: StateSummary[];
  partyComparison: PartyComparison;
};

type ConstituentRow = {
  state: string;
  year: number;
  topicSlug: string;
  questionCode: string;
  supportPct: number;
  sampleSize: number;
};

type AggregatedVote = {
  state: string;
  year: number;
  topicSlug: string;
  totalDelegationVotes: number;
  delegationYea: number;
  demVotes: number;
  demYea: number;
  repVotes: number;
  repYea: number;
  billIds: Set<string>;
};

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

function normalizeParty(p: string | null | undefined): "D" | "R" | "I" | null {
  if (!p) return null;
  const s = p.trim().toUpperCase();
  if (s === "D" || s.startsWith("DEM")) return "D";
  if (s === "R" || s.startsWith("REP")) return "R";
  if (s === "I" || s === "ID" || s.startsWith("IND")) return "I";
  return null;
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

export async function buildRepresentationAnalysis(): Promise<RepresentationAnalysis> {
  // Pull every ConstituentOpinion row keyed by (state, year, topicSlug).
  const opinions = await prisma.constituentOpinion.findMany({
    select: {
      state: true,
      year: true,
      topicSlug: true,
      questionCode: true,
      supportPct: true,
      sampleSize: true,
    },
  });
  const opinionByKey = new Map<string, ConstituentRow>();
  for (const o of opinions) {
    if (!o.questionCode) continue;
    const key = `${o.state}|${o.year}|${o.topicSlug}`;
    // Prefer the "primary" question code per topic (the one extract.py set as
    // the topic's mapped direction). Since we only emitted one row per
    // (state, year, topic, questionCode) and the topic→direction map is
    // 1:1, there's only one row per key.
    opinionByKey.set(key, {
      state: o.state,
      year: o.year,
      topicSlug: o.topicSlug,
      questionCode: o.questionCode,
      supportPct: o.supportPct,
      sampleSize: o.sampleSize,
    });
  }

  // Pull all US LegislativeVote rows with topics + member votes.
  const votes = await prisma.legislativeVote.findMany({
    where: {
      source: { ingestedBy: { in: US_VOTE_PIPELINES } },
      topics: { not: null },
      voteDate: { not: null },
    },
    select: {
      id: true,
      voteDate: true,
      topics: true,
      memberVotes: {
        select: { memberState: true, memberParty: true, vote: true },
      },
    },
    take: 50000,
  });

  const aggMap = new Map<string, AggregatedVote>();
  let legislativeVotesScanned = 0;
  for (const v of votes) {
    if (!v.voteDate) continue;
    const year = v.voteDate.getUTCFullYear();
    const topics = parseTopics(v.topics);
    if (topics.length === 0) continue;
    if (!v.memberVotes || v.memberVotes.length === 0) continue;
    legislativeVotesScanned += 1;

    for (const t of topics) {
      // Group member votes by state
      const byState: Record<string, { y: number; n: number; dy: number; dn: number; ry: number; rn: number }> = {};
      for (const mv of v.memberVotes) {
        if (!mv.memberState) continue;
        const st = mv.memberState.trim().toUpperCase();
        if (st.length !== 2) continue;
        const yea = isYea(mv.vote);
        const nay = isNay(mv.vote);
        if (!yea && !nay) continue;
        const bucket = (byState[st] ??= { y: 0, n: 0, dy: 0, dn: 0, ry: 0, rn: 0 });
        if (yea) bucket.y += 1;
        else bucket.n += 1;
        const p = normalizeParty(mv.memberParty);
        if (p === "D") {
          if (yea) bucket.dy += 1;
          else bucket.dn += 1;
        } else if (p === "R") {
          if (yea) bucket.ry += 1;
          else bucket.rn += 1;
        }
      }
      for (const [state, b] of Object.entries(byState)) {
        const key = `${state}|${year}|${t}`;
        const agg = aggMap.get(key) ?? {
          state,
          year,
          topicSlug: t,
          totalDelegationVotes: 0,
          delegationYea: 0,
          demVotes: 0,
          demYea: 0,
          repVotes: 0,
          repYea: 0,
          billIds: new Set<string>(),
        };
        agg.totalDelegationVotes += b.y + b.n;
        agg.delegationYea += b.y;
        agg.demVotes += b.dy + b.dn;
        agg.demYea += b.dy;
        agg.repVotes += b.ry + b.rn;
        agg.repYea += b.ry;
        agg.billIds.add(v.id);
        aggMap.set(key, agg);
      }
    }
  }

  const rows: StateTopicGapRow[] = [];
  for (const [key, agg] of aggMap) {
    if (agg.totalDelegationVotes < 3) continue; // need at least a few votes
    const opinion = opinionByKey.get(key);
    if (!opinion) continue;
    const delegationYeaPct = (100 * agg.delegationYea) / agg.totalDelegationVotes;
    const supportPct = opinion.supportPct;
    const gap = Math.abs(delegationYeaPct - supportPct);
    const demYeaPct = agg.demVotes > 0 ? (100 * agg.demYea) / agg.demVotes : null;
    const repYeaPct = agg.repVotes > 0 ? (100 * agg.repYea) / agg.repVotes : null;
    const demGap = demYeaPct === null ? null : Math.abs(demYeaPct - supportPct);
    // Republicans are assumed to align with the opposite (non-liberal) direction
    const repGap = repYeaPct === null ? null : Math.abs(repYeaPct - (100 - supportPct));
    rows.push({
      state: agg.state,
      year: agg.year,
      topicSlug: agg.topicSlug,
      questionCode: opinion.questionCode,
      billCount: agg.billIds.size,
      memberVoteCount: agg.totalDelegationVotes,
      delegationYeaPct,
      constituentSupportPct: supportPct,
      gap,
      sampleSize: opinion.sampleSize,
      demYeaPct,
      repYeaPct,
      demGap,
      repGap,
    });
  }

  // Top individual gaps
  const topGapRows = [...rows]
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 50);

  // Topic summaries
  const byTopic = new Map<string, StateTopicGapRow[]>();
  for (const r of rows) {
    const arr = byTopic.get(r.topicSlug) ?? [];
    arr.push(r);
    byTopic.set(r.topicSlug, arr);
  }
  const topicSummaries: TopicSummary[] = [];
  for (const [topicSlug, arr] of byTopic) {
    if (arr.length < 5) continue;
    const sumGap = arr.reduce((s, r) => s + r.gap, 0);
    const sumDel = arr.reduce((s, r) => s + r.delegationYeaPct, 0);
    const sumSup = arr.reduce((s, r) => s + r.constituentSupportPct, 0);
    const demArr = arr.filter((r) => r.demGap !== null);
    const repArr = arr.filter((r) => r.repGap !== null);
    const sumDemGap = demArr.reduce((s, r) => s + (r.demGap ?? 0), 0);
    const sumRepGap = repArr.reduce((s, r) => s + (r.repGap ?? 0), 0);
    const top = [...arr]
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)
      .map((r) => ({ state: r.state, year: r.year, gap: r.gap }));
    topicSummaries.push({
      topicSlug,
      questionCode: arr[0].questionCode,
      matchedRowCount: arr.length,
      avgGap: sumGap / arr.length,
      avgDelegationYeaPct: sumDel / arr.length,
      avgConstituentSupportPct: sumSup / arr.length,
      avgDemGap: demArr.length > 0 ? sumDemGap / demArr.length : null,
      avgRepGap: repArr.length > 0 ? sumRepGap / repArr.length : null,
      topGapStates: top,
    });
  }
  topicSummaries.sort((a, b) => b.avgGap - a.avgGap);

  // Decade summaries
  const byDecade = new Map<string, StateTopicGapRow[]>();
  for (const r of rows) {
    const d = `${Math.floor(r.year / 10) * 10}s`;
    const arr = byDecade.get(d) ?? [];
    arr.push(r);
    byDecade.set(d, arr);
  }
  const decadeSummaries: DecadeSummary[] = [];
  for (const [decade, arr] of byDecade) {
    if (arr.length < 5) continue;
    const sumGap = arr.reduce((s, r) => s + r.gap, 0);
    const demArr = arr.filter((r) => r.demGap !== null);
    const repArr = arr.filter((r) => r.repGap !== null);
    const sumDemGap = demArr.reduce((s, r) => s + (r.demGap ?? 0), 0);
    const sumRepGap = repArr.reduce((s, r) => s + (r.repGap ?? 0), 0);
    decadeSummaries.push({
      decade,
      matchedRowCount: arr.length,
      avgGap: sumGap / arr.length,
      avgDemGap: demArr.length > 0 ? sumDemGap / demArr.length : null,
      avgRepGap: repArr.length > 0 ? sumRepGap / repArr.length : null,
    });
  }
  decadeSummaries.sort((a, b) => (a.decade < b.decade ? -1 : 1));

  // State summaries (top 25 by avg gap)
  const byState = new Map<string, StateTopicGapRow[]>();
  for (const r of rows) {
    const arr = byState.get(r.state) ?? [];
    arr.push(r);
    byState.set(r.state, arr);
  }
  const stateSummaries: StateSummary[] = [];
  for (const [state, arr] of byState) {
    if (arr.length < 3) continue;
    const sumGap = arr.reduce((s, r) => s + r.gap, 0);
    const demArr = arr.filter((r) => r.demGap !== null);
    const repArr = arr.filter((r) => r.repGap !== null);
    const sumDemGap = demArr.reduce((s, r) => s + (r.demGap ?? 0), 0);
    const sumRepGap = repArr.reduce((s, r) => s + (r.repGap ?? 0), 0);
    const top = [...arr]
      .sort((a, b) => b.gap - a.gap)
      .slice(0, 5)
      .map((r) => ({ topicSlug: r.topicSlug, gap: r.gap, year: r.year }));
    stateSummaries.push({
      state,
      matchedRowCount: arr.length,
      avgGap: sumGap / arr.length,
      avgDemGap: demArr.length > 0 ? sumDemGap / demArr.length : null,
      avgRepGap: repArr.length > 0 ? sumRepGap / repArr.length : null,
      topTopics: top,
    });
  }
  stateSummaries.sort((a, b) => b.avgGap - a.avgGap);

  // Party comparison
  const demRows = rows.filter((r) => r.demGap !== null);
  const repRows = rows.filter((r) => r.repGap !== null);
  const demAvgGap = demRows.length > 0
    ? demRows.reduce((s, r) => s + (r.demGap ?? 0), 0) / demRows.length
    : null;
  const repAvgGap = repRows.length > 0
    ? repRows.reduce((s, r) => s + (r.repGap ?? 0), 0) / repRows.length
    : null;
  const partyTopicMap = new Map<string, { dem: number[]; rep: number[]; total: number }>();
  for (const r of rows) {
    const e = partyTopicMap.get(r.topicSlug) ?? { dem: [], rep: [], total: 0 };
    if (r.demGap !== null) e.dem.push(r.demGap);
    if (r.repGap !== null) e.rep.push(r.repGap);
    e.total += 1;
    partyTopicMap.set(r.topicSlug, e);
  }
  const topicBreakdown = [...partyTopicMap.entries()]
    .filter(([, v]) => v.total >= 5)
    .map(([topicSlug, v]) => ({
      topicSlug,
      demAvgGap: v.dem.length > 0 ? v.dem.reduce((a, b) => a + b, 0) / v.dem.length : null,
      repAvgGap: v.rep.length > 0 ? v.rep.reduce((a, b) => a + b, 0) / v.rep.length : null,
      sampleCount: v.total,
    }))
    .sort((a, b) => b.sampleCount - a.sampleCount);

  const partyComparison: PartyComparison = {
    demAvgGap,
    repAvgGap,
    demRowCount: demRows.length,
    repRowCount: repRows.length,
    topicBreakdown,
  };

  const years = rows.map((r) => r.year);
  const yearRange: [number, number] | null = years.length > 0
    ? [Math.min(...years), Math.max(...years)]
    : null;

  return {
    meta: {
      constituentOpinionRows: opinions.length,
      legislativeVotesScanned,
      matchedRowCount: rows.length,
      statesCovered: new Set(rows.map((r) => r.state)).size,
      yearRange,
      topicsMatched: byTopic.size,
    },
    topGapRows,
    topicSummaries,
    decadeSummaries,
    stateSummaries: stateSummaries.slice(0, 25),
    partyComparison,
  };
}
