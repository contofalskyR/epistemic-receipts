import { prisma } from "@/lib/prisma";
import {
  chiSquarePValue,
  logMarginalLikelihood,
} from "@/lib/stats";

export const CONTESTED_THRESHOLD = 0.10;
export const MIN_TOTAL = 10;

export const COUNTRY_LABELS: Record<string, string> = {
  uk_legislation_v1: "United Kingdom",
  eu_parliament_v1: "European Parliament",
  eu_parliament_votes_v2: "European Parliament",
  canada_bills_v1: "Canada",
  congress_v1: "United States",
};

// Minimum recorded votes a body needs in a decade before we plot a point for it.
// Smaller and the line jitters on noise; bigger and the historical decades
// (esp. 18th-century US House) drop off entirely.
export const MIN_DECADE_BODY_VOTES = 10;

// Body bucket for the per-body decade chart. US Congress is split by chamber
// (House / Senate); other pipelines collapse to their country label.
export function getBodyKey(ingestedBy: string, chamber: string | null | undefined): string {
  if (ingestedBy === "congress_v1") {
    const ch = (chamber ?? "").trim();
    if (/senate/i.test(ch)) return "US Senate";
    if (/house/i.test(ch)) return "US House";
    return "US Congress";
  }
  if (ingestedBy === "uk_legislation_v1") return "UK";
  if (ingestedBy === "eu_parliament_v1" || ingestedBy === "eu_parliament_votes_v2") return "EU Parliament";
  if (ingestedBy === "canada_bills_v1") return "Canada";
  return COUNTRY_LABELS[ingestedBy] ?? ingestedBy;
}

export type PartyBreakdown = { yes: number; no: number; abstain: number };
type PartyMap = Record<string, PartyBreakdown>;

// UK shape: { ayes: [{PartyName, VoteCount}], noes: [{PartyName, VoteCount}] }
type UkPartyArray = { PartyName?: string; VoteCount?: number }[];
type UkPartyShape = { ayes?: UkPartyArray; noes?: UkPartyArray; abstains?: UkPartyArray };

export function extractPartyCounts(raw: unknown): PartyMap {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  // UK-style shape: { ayes: [...], noes: [...] }
  if (Array.isArray(obj.ayes) || Array.isArray(obj.noes) || Array.isArray(obj.abstains)) {
    const out: PartyMap = {};
    const apply = (arr: unknown, slot: keyof PartyBreakdown) => {
      if (!Array.isArray(arr)) return;
      for (const entry of arr as UkPartyArray) {
        const name = entry?.PartyName?.trim();
        const count = Number(entry?.VoteCount ?? 0);
        if (!name || !Number.isFinite(count) || count <= 0) continue;
        const prev = out[name] ?? { yes: 0, no: 0, abstain: 0 };
        prev[slot] += count;
        out[name] = prev;
      }
    };
    apply(obj.ayes, "yes");
    apply(obj.noes, "no");
    apply(obj.abstains, "abstain");
    return out;
  }
  // Generic documented shape: { PartyName: { yes, no, abstain } }
  const out: PartyMap = {};
  for (const [party, counts] of Object.entries(obj)) {
    if (!counts || typeof counts !== "object") continue;
    const c = counts as Record<string, unknown>;
    const yes = Number(c.yes ?? 0);
    const no = Number(c.no ?? 0);
    const abstain = Number(c.abstain ?? 0);
    if (yes + no + abstain === 0) continue;
    out[party] = { yes, no, abstain };
  }
  return out;
}

export type BillRow = {
  legislativeVoteId: string;
  sourceId: string;
  sourceName: string | null;
  sourceUrl: string | null;
  ingestedBy: string;
  chamber: string;
  yesCount: number;
  noCount: number;
  total: number;
  contested: number;
  ayePct: number;
  nayPct: number;
  result?: string | null;
  voteDate?: string | null;
  chiSq?: number;
  chiDf?: number;
  chiP?: number;
  isPartisan?: boolean;
  polarizationScore?: number;
  bayesPartisanBF?: number;
};

export type GlobalRow = Omit<BillRow, "contested"> & { country: string };

export type CountryStats = {
  ingestedBy: string;
  label: string;
  totalBills: number;
  contestedBills: number;
  contestedPct: number;
  unanimousBills: number;
  unanimousPct: number;
  avgNayPct: number;
  mostContested: BillRow[];
  mostUnanimous: BillRow[];
};

export type PartyRow = {
  ingestedBy: string;
  country: string;
  party: string;
  billCount: number;
  totalVotes: number;
  yes: number;
  no: number;
  abstain: number;
  yesPct: number;
  noPct: number;
  abstainPct: number;
};

export type DecadeBucket = {
  decade: string;
  totalVotes: number;
  contestedVotes: number;
  contestedPct: number;
  unanimousPct: number;
};

// Per-decade × per-body contested rate, shaped for direct consumption by a
// multi-line chart. `contestedPct[body]` is undefined when that body had fewer
// than MIN_DECADE_BODY_VOTES recorded votes in the decade — avoids drawing
// spurious lines on a handful of samples.
export type DecadeBodyPoint = {
  decade: string;
  decadeStart: number;
  // Numeric value per body — keyed by body label (e.g., "US House").
  // Missing bodies (insufficient data) are simply absent so recharts skips them.
  contestedPct: Record<string, number>;
  totalVotes: Record<string, number>;
};

export type DecadeTrendByBody = {
  bodies: string[];
  points: DecadeBodyPoint[];
};

export type PartyLoyaltyRow = {
  memberName: string;
  memberParty: string;
  chamber: string;
  totalVotes: number;
  loyaltyPct: number;
  defectionCount: number;
};

export type LoyaltySummaryRow = {
  party: string;
  chamber: string;
  avgLoyalty: number;
  memberCount: number;
};

export type TopicPartyEntry = {
  party: string;
  billCount: number;
  yes: number;
  no: number;
  yesPct: number;
};

export type TopicPartyRow = {
  topic: string;
  parties: TopicPartyEntry[];
  totalBills: number;
};

export type TopicZRow = {
  topic: string;
  decades: { decade: string; z: number; raw: number }[];
};

export type VoteAnalysis = {
  meta: {
    totalVotes: number;
    contestedThreshold: number;
    minTotal: number;
    partyRowsParsed: number;
    memberVotesParsed: number;
  };
  countries: CountryStats[];
  globalContested: GlobalRow[];
  globalUnanimous: GlobalRow[];
  parties: PartyRow[];
  topPartisan: GlobalRow[];
  topBipartisan: GlobalRow[];
  mostPolarized: GlobalRow[];
  closeCalls: GlobalRow[];
  decadeTrend: DecadeBucket[];
  decadeTrendByBody: DecadeTrendByBody;
  partyLoyalty: PartyLoyaltyRow[];
  loyaltySummary: LoyaltySummaryRow[];
  topicPartyMatrix: TopicPartyRow[];
  strongPartisanBF: GlobalRow[];
  topicZScores: TopicZRow[];
};

// ----- helpers -----

function safeParseJson(s: string | null | undefined): unknown {
  if (!s) return null;
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function extractTopics(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t === "string") {
      const trimmed = t.trim();
      if (trimmed) out.push(trimmed);
    }
  }
  return out;
}

// chi-square partisan independence test
function computeChiSquare(parties: PartyMap): { chiSq: number; df: number; p: number } | null {
  const entries = Object.entries(parties).filter(([, v]) => v.yes + v.no >= 2);
  if (entries.length < 2) return null;
  const Y = entries.reduce((s, [, v]) => s + v.yes, 0);
  const N = entries.reduce((s, [, v]) => s + v.no, 0);
  const T = Y + N;
  if (T <= 0 || Y <= 0 || N <= 0) return null;
  const pYes = Y / T;
  const pNo = N / T;
  let chi = 0;
  for (const [, v] of entries) {
    const rowTotal = v.yes + v.no;
    const eYes = rowTotal * pYes;
    const eNo = rowTotal * pNo;
    if (eYes > 0) chi += Math.pow(v.yes - eYes, 2) / eYes;
    if (eNo > 0) chi += Math.pow(v.no - eNo, 2) / eNo;
  }
  const df = entries.length - 1;
  const p = chiSquarePValue(chi, df);
  return { chiSq: chi, df, p };
}

// population stddev of per-party yes-share (0..1), scaled to 0..100
function computePolarization(parties: PartyMap): number | null {
  const shares: number[] = [];
  for (const v of Object.values(parties)) {
    const denom = v.yes + v.no;
    if (denom < 5) continue;
    shares.push(v.yes / denom);
  }
  if (shares.length < 2) return null;
  const mean = shares.reduce((s, x) => s + x, 0) / shares.length;
  const variance = shares.reduce((s, x) => s + (x - mean) * (x - mean), 0) / shares.length;
  return Math.sqrt(variance) * 100;
}

// Bayes Factor: independent-rates per party vs single pooled rate.
// BF10 > 1 = partisan signal; BF10 < 1 = bipartisan.
function computeBayesBF(parties: PartyMap): number | null {
  const entries = Object.entries(parties).filter(([, v]) => v.yes + v.no >= 5);
  if (entries.length < 2) return null;
  let Y = 0;
  let N = 0;
  let logH1 = 0;
  for (const [, v] of entries) {
    const yi = v.yes;
    const ni = v.yes + v.no;
    Y += yi;
    N += ni;
    logH1 += logMarginalLikelihood(yi, ni);
  }
  const logH0 = logMarginalLikelihood(Y, N);
  const logBF10 = logH1 - logH0;
  return Math.exp(logBF10);
}

// ----- main -----

export async function buildVoteAnalysis(): Promise<VoteAnalysis> {
  const votes = await prisma.legislativeVote.findMany({
    where: { yesCount: { not: null }, noCount: { not: null } },
    select: {
      id: true,
      sourceId: true,
      chamber: true,
      yesCount: true,
      noCount: true,
      byPartyJson: true,
      voteDate: true,
      result: true,
      topics: true,
      source: {
        select: { externalId: true, url: true, name: true, ingestedBy: true },
      },
    },
    take: 50000,
  });

  type ScoredRow = BillRow & {
    byPartyJson: string | null;
    topicsRaw: string | null;
    partyMap: PartyMap | null;
  };
  const scored: ScoredRow[] = [];
  for (const v of votes) {
    const yes = v.yesCount ?? 0;
    const no = v.noCount ?? 0;
    const total = yes + no;
    if (total < MIN_TOTAL) continue;
    const contested = no / total;

    let partyMap: PartyMap | null = null;
    if (v.byPartyJson) {
      const parsed = extractPartyCounts(safeParseJson(v.byPartyJson));
      if (Object.keys(parsed).length > 0) partyMap = parsed;
    }

    const row: ScoredRow = {
      legislativeVoteId: v.id,
      sourceId: v.sourceId,
      sourceName: v.source?.name ?? null,
      sourceUrl: v.source?.url ?? null,
      ingestedBy: v.source?.ingestedBy ?? "unknown",
      chamber: v.chamber,
      yesCount: yes,
      noCount: no,
      total,
      contested,
      ayePct: (yes / total) * 100,
      nayPct: (no / total) * 100,
      result: v.result ?? null,
      voteDate: v.voteDate ? v.voteDate.toISOString() : null,
      byPartyJson: v.byPartyJson ?? null,
      topicsRaw: v.topics ?? null,
      partyMap,
    };

    if (partyMap) {
      const chi = computeChiSquare(partyMap);
      if (chi) {
        row.chiSq = chi.chiSq;
        row.chiDf = chi.df;
        row.chiP = chi.p;
        row.isPartisan = chi.p < 0.05;
      }
      const pol = computePolarization(partyMap);
      if (pol !== null) row.polarizationScore = pol;
      const bf = computeBayesBF(partyMap);
      if (bf !== null) row.bayesPartisanBF = bf;
    }

    scored.push(row);
  }

  const strip = (r: ScoredRow): BillRow => ({
    legislativeVoteId: r.legislativeVoteId,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    ingestedBy: r.ingestedBy,
    chamber: r.chamber,
    yesCount: r.yesCount,
    noCount: r.noCount,
    total: r.total,
    contested: r.contested,
    ayePct: r.ayePct,
    nayPct: r.nayPct,
    result: r.result ?? null,
    voteDate: r.voteDate ?? null,
    chiSq: r.chiSq,
    chiDf: r.chiDf,
    chiP: r.chiP,
    isPartisan: r.isPartisan,
    polarizationScore: r.polarizationScore,
    bayesPartisanBF: r.bayesPartisanBF,
  });

  const stripGlobal = (r: ScoredRow): GlobalRow => ({
    legislativeVoteId: r.legislativeVoteId,
    sourceId: r.sourceId,
    sourceName: r.sourceName,
    sourceUrl: r.sourceUrl,
    ingestedBy: r.ingestedBy,
    country: COUNTRY_LABELS[r.ingestedBy] ?? r.ingestedBy,
    chamber: r.chamber,
    yesCount: r.yesCount,
    noCount: r.noCount,
    total: r.total,
    ayePct: r.ayePct,
    nayPct: r.nayPct,
    result: r.result ?? null,
    voteDate: r.voteDate ?? null,
    chiSq: r.chiSq,
    chiDf: r.chiDf,
    chiP: r.chiP,
    isPartisan: r.isPartisan,
    polarizationScore: r.polarizationScore,
    bayesPartisanBF: r.bayesPartisanBF,
  });

  // Bucket by COUNTRY_LABEL so multi-pipeline bodies (e.g. EU Parliament's
  // eu_parliament_v1 + eu_parliament_votes_v2) collapse into a single row.
  const byCountry = new Map<string, ScoredRow[]>();
  for (const row of scored) {
    const label = COUNTRY_LABELS[row.ingestedBy] ?? row.ingestedBy;
    const arr = byCountry.get(label) ?? [];
    arr.push(row);
    byCountry.set(label, arr);
  }

  const countries: CountryStats[] = [];
  for (const [label, rows] of byCountry.entries()) {
    const totalBills = rows.length;
    const contestedRows = rows.filter((r) => r.contested > CONTESTED_THRESHOLD);
    const unanimousRows = rows.filter((r) => r.contested === 0);
    const avgNayPct =
      rows.reduce((acc, r) => acc + r.nayPct, 0) / Math.max(1, totalBills);

    const sortedContested = [...rows].sort((a, b) => b.contested - a.contested).slice(0, 10);
    const sortedUnanimous = [...rows]
      .sort((a, b) => a.contested - b.contested || b.total - a.total)
      .slice(0, 5);

    // Pick the dominant ingestedBy tag for downstream reference (highest volume).
    const tagCounts = new Map<string, number>();
    for (const r of rows) tagCounts.set(r.ingestedBy, (tagCounts.get(r.ingestedBy) ?? 0) + 1);
    const tag = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? rows[0]!.ingestedBy;

    countries.push({
      ingestedBy: tag,
      label,
      totalBills,
      contestedBills: contestedRows.length,
      contestedPct: (contestedRows.length / Math.max(1, totalBills)) * 100,
      unanimousBills: unanimousRows.length,
      unanimousPct: (unanimousRows.length / Math.max(1, totalBills)) * 100,
      avgNayPct,
      mostContested: sortedContested.map(strip),
      mostUnanimous: sortedUnanimous.map(strip),
    });
  }
  countries.sort((a, b) => b.totalBills - a.totalBills);

  const globalContested = [...scored]
    .sort((a, b) => b.contested - a.contested)
    .slice(0, 10)
    .map(stripGlobal);

  const globalUnanimous = [...scored]
    .filter((r) => r.contested === 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map(stripGlobal);

  // ----- party aggregates -----
  // Bucket by country label so EU Parliament rows from both
  // eu_parliament_v1 and eu_parliament_votes_v2 collapse into one party row.
  const partyTotals: Record<string, PartyBreakdown & { billCount: number; country: string; ingestedBy: string }> = {};
  let partyRowsParsed = 0;
  for (const r of scored) {
    if (!r.partyMap) continue;
    partyRowsParsed++;
    const country = COUNTRY_LABELS[r.ingestedBy] ?? r.ingestedBy;
    for (const [party, counts] of Object.entries(r.partyMap)) {
      const key = `${country}::${party}`;
      const prev = partyTotals[key] ?? { yes: 0, no: 0, abstain: 0, billCount: 0, country, ingestedBy: r.ingestedBy };
      prev.yes += counts.yes;
      prev.no += counts.no;
      prev.abstain += counts.abstain;
      prev.billCount += 1;
      partyTotals[key] = prev;
    }
  }

  const parties: PartyRow[] = Object.entries(partyTotals)
    .map(([key, v]) => {
      const party = key.split("::")[1];
      const total = v.yes + v.no + v.abstain;
      return {
        ingestedBy: v.ingestedBy,
        country: v.country,
        party,
        billCount: v.billCount,
        totalVotes: total,
        yes: v.yes,
        no: v.no,
        abstain: v.abstain,
        yesPct: total > 0 ? (v.yes / total) * 100 : 0,
        noPct: total > 0 ? (v.no / total) * 100 : 0,
        abstainPct: total > 0 ? (v.abstain / total) * 100 : 0,
      };
    })
    .filter((p) => p.billCount >= 3)
    .sort((a, b) => b.totalVotes - a.totalVotes);

  // ----- 1. chi-square partisan rankings -----
  const partisanCandidates = scored.filter((r) => r.chiSq !== undefined);
  const topPartisan = [...partisanCandidates]
    .sort((a, b) => (b.chiSq ?? 0) - (a.chiSq ?? 0))
    .slice(0, 10)
    .map(stripGlobal);
  const topBipartisan = [...partisanCandidates]
    .filter((r) => (r.chiP ?? 0) > 0.5 && r.total >= 50)
    .sort((a, b) => (a.chiSq ?? 0) - (b.chiSq ?? 0))
    .slice(0, 10)
    .map(stripGlobal);

  // ----- 2. polarization ranking -----
  const mostPolarized = scored
    .filter((r) => r.polarizationScore !== undefined)
    .sort((a, b) => (b.polarizationScore ?? 0) - (a.polarizationScore ?? 0))
    .slice(0, 10)
    .map(stripGlobal);

  // ----- 3. close calls -----
  const closeCalls = scored
    .filter((r) => Math.abs(r.nayPct - 50) < 5)
    .sort((a, b) => Math.abs(a.nayPct - 50) - Math.abs(b.nayPct - 50))
    .slice(0, 25)
    .map(stripGlobal);

  // ----- 4. decade trend -----
  const decadeAccum = new Map<number, { total: number; contested: number; unanimous: number }>();
  // Per body × decade — `${body}::${decade}` → { total, contested }
  const decadeByBodyAccum = new Map<string, { total: number; contested: number; body: string; decade: number }>();
  for (const r of scored) {
    if (!r.voteDate) continue;
    const year = new Date(r.voteDate).getFullYear();
    if (!Number.isFinite(year)) continue;
    const decade = Math.floor(year / 10) * 10;
    if (decade < 1780 || decade > 2020) continue;
    const acc = decadeAccum.get(decade) ?? { total: 0, contested: 0, unanimous: 0 };
    acc.total += 1;
    if (r.contested > CONTESTED_THRESHOLD) acc.contested += 1;
    if (r.contested === 0) acc.unanimous += 1;
    decadeAccum.set(decade, acc);

    const body = getBodyKey(r.ingestedBy, r.chamber);
    const bKey = `${body}::${decade}`;
    const bAcc = decadeByBodyAccum.get(bKey) ?? { total: 0, contested: 0, body, decade };
    bAcc.total += 1;
    if (r.contested > CONTESTED_THRESHOLD) bAcc.contested += 1;
    decadeByBodyAccum.set(bKey, bAcc);
  }
  const decadeTrend: DecadeBucket[] = [];
  for (let d = 1780; d <= 2020; d += 10) {
    const acc = decadeAccum.get(d);
    if (!acc || acc.total < 10) continue;
    decadeTrend.push({
      decade: `${d}s`,
      totalVotes: acc.total,
      contestedVotes: acc.contested,
      contestedPct: (acc.contested / acc.total) * 100,
      unanimousPct: (acc.unanimous / acc.total) * 100,
    });
  }

  // Per-body decade points: include every body that meets MIN_DECADE_BODY_VOTES
  // in at least one decade. Decade is rendered only if at least one body has
  // enough samples (avoids drawing an empty x-tick).
  const bodyTotals = new Map<string, number>();
  for (const acc of decadeByBodyAccum.values()) {
    bodyTotals.set(acc.body, (bodyTotals.get(acc.body) ?? 0) + acc.total);
  }
  const bodies = [...bodyTotals.entries()]
    .filter(([, total]) => total >= MIN_DECADE_BODY_VOTES)
    .sort((a, b) => b[1] - a[1])
    .map(([body]) => body);

  const decadeBodyPoints: DecadeBodyPoint[] = [];
  for (let d = 1780; d <= 2020; d += 10) {
    const contestedPct: Record<string, number> = {};
    const totalVotes: Record<string, number> = {};
    let anyBody = false;
    for (const body of bodies) {
      const acc = decadeByBodyAccum.get(`${body}::${d}`);
      if (!acc || acc.total < MIN_DECADE_BODY_VOTES) continue;
      contestedPct[body] = (acc.contested / acc.total) * 100;
      totalVotes[body] = acc.total;
      anyBody = true;
    }
    if (!anyBody) continue;
    decadeBodyPoints.push({
      decade: `${d}s`,
      decadeStart: d,
      contestedPct,
      totalVotes,
    });
  }
  const decadeTrendByBody: DecadeTrendByBody = {
    bodies,
    points: decadeBodyPoints,
  };

  // ----- 5. party loyalty (from MemberVote) -----
  const memberVotes = await prisma.memberVote.findMany({
    where: { memberParty: { not: null }, vote: { in: ["Yea", "Nay"] } },
    select: {
      legislativeVoteId: true,
      memberName: true,
      memberId: true,
      memberParty: true,
      chamber: true,
      vote: true,
    },
    take: 500000,
  });

  // Step 1: per (legislativeVoteId, party), tally votes to determine majority
  const billPartyTallies = new Map<string, { yea: number; nay: number }>();
  for (const mv of memberVotes) {
    if (!mv.memberParty) continue;
    const key = `${mv.legislativeVoteId}::${mv.memberParty}`;
    const t = billPartyTallies.get(key) ?? { yea: 0, nay: 0 };
    if (mv.vote === "Yea") t.yea += 1;
    else if (mv.vote === "Nay") t.nay += 1;
    billPartyTallies.set(key, t);
  }
  const billPartyMajority = new Map<string, "Yea" | "Nay" | null>();
  for (const [k, t] of billPartyTallies.entries()) {
    if (t.yea === t.nay) billPartyMajority.set(k, null);
    else billPartyMajority.set(k, t.yea > t.nay ? "Yea" : "Nay");
  }

  // Step 2: per (memberKey), count partisan votes and defections
  type MemberAcc = {
    memberName: string;
    memberParty: string;
    chamber: string;
    total: number;
    withMajority: number;
  };
  const memberAcc = new Map<string, MemberAcc>();
  for (const mv of memberVotes) {
    if (!mv.memberParty) continue;
    const majority = billPartyMajority.get(`${mv.legislativeVoteId}::${mv.memberParty}`);
    if (!majority) continue;
    const memberKey = `${mv.memberId ?? mv.memberName}::${mv.chamber}::${mv.memberParty}`;
    const acc = memberAcc.get(memberKey) ?? {
      memberName: mv.memberName,
      memberParty: mv.memberParty,
      chamber: mv.chamber,
      total: 0,
      withMajority: 0,
    };
    acc.total += 1;
    if (mv.vote === majority) acc.withMajority += 1;
    memberAcc.set(memberKey, acc);
  }

  const allMembers: PartyLoyaltyRow[] = [];
  for (const acc of memberAcc.values()) {
    if (acc.total < 10) continue;
    allMembers.push({
      memberName: acc.memberName,
      memberParty: acc.memberParty,
      chamber: acc.chamber,
      totalVotes: acc.total,
      loyaltyPct: (acc.withMajority / acc.total) * 100,
      defectionCount: acc.total - acc.withMajority,
    });
  }
  const partyLoyalty = [...allMembers]
    .sort((a, b) => b.defectionCount - a.defectionCount)
    .slice(0, 50);

  // loyalty summary by party/chamber across all qualifying members
  const summaryAcc = new Map<string, { sum: number; count: number; party: string; chamber: string }>();
  for (const m of allMembers) {
    const key = `${m.memberParty}::${m.chamber}`;
    const s = summaryAcc.get(key) ?? { sum: 0, count: 0, party: m.memberParty, chamber: m.chamber };
    s.sum += m.loyaltyPct;
    s.count += 1;
    summaryAcc.set(key, s);
  }
  const loyaltySummary: LoyaltySummaryRow[] = [];
  for (const s of summaryAcc.values()) {
    loyaltySummary.push({
      party: s.party,
      chamber: s.chamber,
      avgLoyalty: s.count > 0 ? s.sum / s.count : 0,
      memberCount: s.count,
    });
  }
  loyaltySummary.sort((a, b) => b.memberCount - a.memberCount);

  // ----- 6. topic × party matrix -----
  type TopicPartyAcc = {
    yes: number;
    no: number;
    bills: Set<string>;
  };
  type TopicAcc = {
    bills: Set<string>;
    parties: Map<string, TopicPartyAcc>;
  };
  const topicAccum = new Map<string, TopicAcc>();
  for (const r of scored) {
    if (!r.partyMap || !r.topicsRaw) continue;
    const topics = extractTopics(safeParseJson(r.topicsRaw));
    if (topics.length === 0) continue;
    for (const topic of topics) {
      const acc = topicAccum.get(topic) ?? {
        bills: new Set<string>(),
        parties: new Map<string, TopicPartyAcc>(),
      };
      acc.bills.add(r.legislativeVoteId);
      for (const [party, counts] of Object.entries(r.partyMap)) {
        const pAcc = acc.parties.get(party) ?? { yes: 0, no: 0, bills: new Set<string>() };
        pAcc.yes += counts.yes;
        pAcc.no += counts.no;
        pAcc.bills.add(r.legislativeVoteId);
        acc.parties.set(party, pAcc);
      }
      topicAccum.set(topic, acc);
    }
  }
  const topicPartyMatrix: TopicPartyRow[] = [];
  for (const [topic, acc] of topicAccum.entries()) {
    if (acc.bills.size < 3) continue;
    const partyRows: TopicPartyEntry[] = [];
    for (const [party, pAcc] of acc.parties.entries()) {
      if (pAcc.bills.size < 2) continue;
      const total = pAcc.yes + pAcc.no;
      partyRows.push({
        party,
        billCount: pAcc.bills.size,
        yes: pAcc.yes,
        no: pAcc.no,
        yesPct: total > 0 ? (pAcc.yes / total) * 100 : 0,
      });
    }
    if (partyRows.length === 0) continue;
    partyRows.sort((a, b) => b.billCount - a.billCount);
    topicPartyMatrix.push({
      topic,
      parties: partyRows,
      totalBills: acc.bills.size,
    });
  }
  topicPartyMatrix.sort((a, b) => b.totalBills - a.totalBills);
  const topicPartyMatrixTop = topicPartyMatrix.slice(0, 15);

  // ----- 7. strong partisan BF -----
  const strongPartisanBF = scored
    .filter((r) => r.bayesPartisanBF !== undefined && (r.bayesPartisanBF ?? 0) > 3)
    .sort((a, b) => (b.bayesPartisanBF ?? 0) - (a.bayesPartisanBF ?? 0))
    .slice(0, 10)
    .map(stripGlobal);

  // ----- 8. topic trajectory z-scores -----
  // For each topic, compute its proportion of votes per decade, then z-score
  // that trajectory against the topic's own mean. Red = anomalously high vs.
  // baseline; blue = anomalously low.
  const topicDecadeCounts = new Map<string, Map<number, number>>();
  const decadeTotalsForZ = new Map<number, number>();
  for (const r of scored) {
    if (!r.voteDate || !r.topicsRaw) continue;
    const year = new Date(r.voteDate).getFullYear();
    if (!Number.isFinite(year)) continue;
    const decade = Math.floor(year / 10) * 10;
    decadeTotalsForZ.set(decade, (decadeTotalsForZ.get(decade) ?? 0) + 1);
    const topics = extractTopics(safeParseJson(r.topicsRaw));
    if (topics.length === 0) continue;
    for (const topic of topics) {
      const inner = topicDecadeCounts.get(topic) ?? new Map<number, number>();
      inner.set(decade, (inner.get(decade) ?? 0) + 1);
      topicDecadeCounts.set(topic, inner);
    }
  }

  const validDecades = [...decadeTotalsForZ.entries()]
    .filter(([, total]) => total >= 50)
    .map(([d]) => d)
    .sort((a, b) => a - b);

  const topicZRows: TopicZRow[] = [];
  for (const [topic, decadeCounts] of topicDecadeCounts.entries()) {
    const rawByDecade: { decade: number; raw: number }[] = [];
    for (const d of validDecades) {
      const count = decadeCounts.get(d) ?? 0;
      const total = decadeTotalsForZ.get(d) ?? 0;
      if (total <= 0) continue;
      rawByDecade.push({ decade: d, raw: count / total });
    }
    if (rawByDecade.length < 3) continue;
    const values = rawByDecade.map((p) => p.raw);
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const variance =
      values.reduce((s, v) => s + (v - mean) * (v - mean), 0) / values.length;
    const std = Math.sqrt(variance);
    const decades = rawByDecade.map((p) => ({
      decade: `${p.decade}s`,
      raw: p.raw,
      z: std === 0 ? 0 : (p.raw - mean) / std,
    }));
    const maxAbsZ = decades.reduce((m, d) => Math.max(m, Math.abs(d.z)), 0);
    if (maxAbsZ < 1.0) continue;
    topicZRows.push({ topic, decades });
  }
  topicZRows.sort((a, b) => {
    const ma = a.decades.reduce((m, d) => Math.max(m, Math.abs(d.z)), 0);
    const mb = b.decades.reduce((m, d) => Math.max(m, Math.abs(d.z)), 0);
    return mb - ma;
  });
  const topicZScores = topicZRows.slice(0, 20);

  return {
    meta: {
      totalVotes: scored.length,
      contestedThreshold: CONTESTED_THRESHOLD,
      minTotal: MIN_TOTAL,
      partyRowsParsed,
      memberVotesParsed: memberVotes.length,
    },
    countries,
    globalContested,
    globalUnanimous,
    parties,
    topPartisan,
    topBipartisan,
    mostPolarized,
    closeCalls,
    decadeTrend,
    decadeTrendByBody,
    partyLoyalty,
    loyaltySummary,
    topicPartyMatrix: topicPartyMatrixTop,
    strongPartisanBF,
    topicZScores,
  };
}
