import "server-only";
import { prisma } from "./prisma";

export const EU_PARTIES = [
  "EPP",
  "SD",
  "RENEW",
  "GREEN_EFA",
  "ECR",
  "ID",
  "GUE_NGL",
] as const;

export const US_PARTIES = ["D", "R", "I"] as const;

export const EU_PARTY_LABELS: Record<string, string> = {
  EPP: "European People's Party",
  SD: "Socialists & Democrats",
  RENEW: "Renew Europe",
  GREEN_EFA: "Greens / EFA",
  ECR: "European Conservatives & Reformists",
  ID: "Identity & Democracy",
  GUE_NGL: "The Left (GUE/NGL)",
};

export const US_PARTY_LABELS: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
};

export type PartyBreakdownRow = {
  party: string;
  label: string;
  yea: number;
  nay: number;
  total: number;
  yeaRate: number;
  posteriorMean: number;
  posteriorCiLower: number;
  posteriorCiUpper: number;
};

export type ChiSquareResult = {
  chiSquare: number;
  pValue: number;
  pValueLabel: string;
  significance: "***" | "**" | "*" | "ns";
  cramersV: number;
  n: number;
  df: number;
};

export type UnityPoint = {
  year: number;
  party: string;
  chamber: string | null;
  unityRate: number;
  total: number;
};

export type ChamberAnalysis = {
  parties: PartyBreakdownRow[];
  test: ChiSquareResult;
  unityOverTime: UnityPoint[];
};

export type VotingAnalysisResponse = {
  euParliament: ChamberAnalysis;
  usCongress: ChamberAnalysis;
  generatedAt: string;
};

type RawGroup = { memberParty: string; vote: string; count: number };
type RawYear = { year: number; memberParty: string; vote: string; count: number };
type RawYearChamber = {
  year: number;
  chamber: string;
  memberParty: string;
  vote: string;
  count: number;
};

function pValueDf6(chiSq: number): { p: number; label: string } {
  if (chiSq > 16.812) return { p: 0.001, label: "< 0.001" };
  if (chiSq > 12.592) return { p: 0.01, label: "< 0.01" };
  if (chiSq > 10.645) return { p: 0.05, label: "< 0.05" };
  return { p: 1, label: "≥ 0.05" };
}

function pValueDf2(chiSq: number): { p: number; label: string } {
  if (chiSq > 13.816) return { p: 0.001, label: "< 0.001" };
  if (chiSq > 9.21) return { p: 0.01, label: "< 0.01" };
  if (chiSq > 5.991) return { p: 0.05, label: "< 0.05" };
  return { p: 1, label: "≥ 0.05" };
}

function significanceFor(p: number): "***" | "**" | "*" | "ns" {
  if (p <= 0.001) return "***";
  if (p <= 0.01) return "**";
  if (p <= 0.05) return "*";
  return "ns";
}

function betaBinomialPosterior(yea: number, nay: number): {
  posteriorMean: number;
  posteriorCiLower: number;
  posteriorCiUpper: number;
} {
  const n = yea + nay;
  if (n === 0) {
    return { posteriorMean: 0.5, posteriorCiLower: 0, posteriorCiUpper: 1 };
  }
  const mean = (1 + yea) / (2 + n);
  const se = Math.sqrt((mean * (1 - mean)) / (n + 2));
  return {
    posteriorMean: mean,
    posteriorCiLower: Math.max(0, mean - 1.96 * se),
    posteriorCiUpper: Math.min(1, mean + 1.96 * se),
  };
}

function buildContingency(
  groups: RawGroup[],
  partyList: readonly string[],
  labels: Record<string, string>,
): { parties: PartyBreakdownRow[]; test: ChiSquareResult } {
  const tally = new Map<string, { yea: number; nay: number }>();
  for (const p of partyList) tally.set(p, { yea: 0, nay: 0 });

  for (const g of groups) {
    const cell = tally.get(g.memberParty);
    if (!cell) continue;
    if (g.vote === "Yea") cell.yea += g.count;
    else if (g.vote === "Nay") cell.nay += g.count;
  }

  let n = 0;
  let totalYea = 0;
  let totalNay = 0;
  const rowTotals = new Map<string, number>();
  const parties: PartyBreakdownRow[] = [];

  for (const p of partyList) {
    const c = tally.get(p)!;
    const rowTotal = c.yea + c.nay;
    rowTotals.set(p, rowTotal);
    n += rowTotal;
    totalYea += c.yea;
    totalNay += c.nay;
    const posterior = betaBinomialPosterior(c.yea, c.nay);
    parties.push({
      party: p,
      label: labels[p] ?? p,
      yea: c.yea,
      nay: c.nay,
      total: rowTotal,
      yeaRate: rowTotal > 0 ? c.yea / rowTotal : 0,
      posteriorMean: posterior.posteriorMean,
      posteriorCiLower: posterior.posteriorCiLower,
      posteriorCiUpper: posterior.posteriorCiUpper,
    });
  }

  let chiSquare = 0;
  if (n > 0) {
    for (const p of partyList) {
      const c = tally.get(p)!;
      const rowTotal = rowTotals.get(p)!;
      const expYea = (rowTotal * totalYea) / n;
      const expNay = (rowTotal * totalNay) / n;
      if (expYea > 0) chiSquare += Math.pow(c.yea - expYea, 2) / expYea;
      if (expNay > 0) chiSquare += Math.pow(c.nay - expNay, 2) / expNay;
    }
  }

  const df = (partyList.length - 1) * (2 - 1);
  const { p: pValue, label: pValueLabel } =
    df === 6 ? pValueDf6(chiSquare) : pValueDf2(chiSquare);
  const cramersV = n > 0 ? Math.sqrt(chiSquare / n) : 0;

  return {
    parties,
    test: {
      chiSquare,
      pValue,
      pValueLabel,
      significance: significanceFor(pValue),
      cramersV,
      n,
      df,
    },
  };
}

function buildUnity(
  rows: {
    year: number;
    party: string;
    chamber: string | null;
    vote: string;
    count: number;
  }[],
): UnityPoint[] {
  const acc = new Map<
    string,
    { year: number; party: string; chamber: string | null; yea: number; nay: number }
  >();
  for (const r of rows) {
    const k = `${r.year}|${r.party}|${r.chamber ?? ""}`;
    let entry = acc.get(k);
    if (!entry) {
      entry = { year: r.year, party: r.party, chamber: r.chamber, yea: 0, nay: 0 };
      acc.set(k, entry);
    }
    if (r.vote === "Yea") entry.yea += r.count;
    else if (r.vote === "Nay") entry.nay += r.count;
  }
  return Array.from(acc.values())
    .map((e) => {
      const total = e.yea + e.nay;
      return {
        year: e.year,
        party: e.party,
        chamber: e.chamber,
        unityRate: total > 0 ? Math.max(e.yea, e.nay) / total : 0,
        total,
      };
    })
    .sort(
      (a, b) =>
        a.year - b.year ||
        (a.chamber ?? "").localeCompare(b.chamber ?? "") ||
        a.party.localeCompare(b.party),
    );
}

async function loadEU(): Promise<ChamberAnalysis> {
  const groups = await prisma.$queryRaw<RawGroup[]>`
    SELECT "memberParty", vote, COUNT(*)::int AS count
    FROM "MemberVote"
    WHERE chamber = 'European Parliament'
      AND vote IN ('Yea', 'Nay')
      AND "memberParty" IN ('EPP', 'SD', 'RENEW', 'GREEN_EFA', 'ECR', 'ID', 'GUE_NGL')
    GROUP BY "memberParty", vote
  `;
  const yearRows = await prisma.$queryRaw<RawYear[]>`
    SELECT EXTRACT(YEAR FROM lv."voteDate")::int AS year,
           mv."memberParty",
           mv.vote,
           COUNT(*)::int AS count
    FROM "MemberVote" mv
    JOIN "LegislativeVote" lv ON mv."legislativeVoteId" = lv.id
    WHERE mv.chamber = 'European Parliament'
      AND mv.vote IN ('Yea', 'Nay')
      AND mv."memberParty" IN ('EPP', 'SD', 'RENEW', 'GREEN_EFA', 'ECR', 'ID', 'GUE_NGL')
      AND lv."voteDate" IS NOT NULL
    GROUP BY year, mv."memberParty", mv.vote
    ORDER BY year
  `;
  const { parties, test } = buildContingency(groups, EU_PARTIES, EU_PARTY_LABELS);
  const unityOverTime = buildUnity(
    yearRows.map((r) => ({
      year: r.year,
      party: r.memberParty,
      chamber: null,
      vote: r.vote,
      count: r.count,
    })),
  );
  return { parties, test, unityOverTime };
}

async function loadUS(): Promise<ChamberAnalysis> {
  const groups = await prisma.$queryRaw<RawGroup[]>`
    SELECT "memberParty", vote, COUNT(*)::int AS count
    FROM "MemberVote"
    WHERE chamber IN ('House', 'Senate')
      AND vote IN ('Yea', 'Nay')
      AND "memberParty" IN ('D', 'R', 'I')
    GROUP BY "memberParty", vote
  `;
  const yearRows = await prisma.$queryRaw<RawYearChamber[]>`
    SELECT EXTRACT(YEAR FROM lv."voteDate")::int AS year,
           mv.chamber,
           mv."memberParty",
           mv.vote,
           COUNT(*)::int AS count
    FROM "MemberVote" mv
    JOIN "LegislativeVote" lv ON mv."legislativeVoteId" = lv.id
    WHERE mv.chamber IN ('House', 'Senate')
      AND mv.vote IN ('Yea', 'Nay')
      AND mv."memberParty" IN ('D', 'R', 'I')
      AND lv."voteDate" IS NOT NULL
    GROUP BY year, mv.chamber, mv."memberParty", mv.vote
    ORDER BY year
  `;
  const { parties, test } = buildContingency(groups, US_PARTIES, US_PARTY_LABELS);
  const unityOverTime = buildUnity(
    yearRows.map((r) => ({
      year: r.year,
      party: r.memberParty,
      chamber: r.chamber,
      vote: r.vote,
      count: r.count,
    })),
  );
  return { parties, test, unityOverTime };
}

export async function getVotingAnalysis(): Promise<VotingAnalysisResponse> {
  const [euParliament, usCongress] = await Promise.all([loadEU(), loadUS()]);
  return {
    euParliament,
    usCongress,
    generatedAt: new Date().toISOString(),
  };
}
