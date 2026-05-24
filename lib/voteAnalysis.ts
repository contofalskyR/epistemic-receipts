import { prisma } from "@/lib/prisma";

export const CONTESTED_THRESHOLD = 0.10;
export const MIN_TOTAL = 10;

export const COUNTRY_LABELS: Record<string, string> = {
  uk_legislation_v1: "United Kingdom",
  eu_parliament_v1: "European Parliament",
  canada_bills_v1: "Canada",
  congress_v1: "United States",
};

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

export type VoteAnalysis = {
  meta: {
    totalVotes: number;
    contestedThreshold: number;
    minTotal: number;
    partyRowsParsed: number;
  };
  countries: CountryStats[];
  globalContested: GlobalRow[];
  globalUnanimous: GlobalRow[];
  parties: PartyRow[];
};

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
      source: {
        select: { externalId: true, url: true, name: true, ingestedBy: true },
      },
    },
  });

  type ScoredRow = BillRow & { byPartyJson: string | null };
  const scored: ScoredRow[] = [];
  for (const v of votes) {
    const yes = v.yesCount ?? 0;
    const no = v.noCount ?? 0;
    const total = yes + no;
    if (total < MIN_TOTAL) continue;
    const contested = no / total;
    scored.push({
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
      byPartyJson: v.byPartyJson ?? null,
    });
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
  });

  const byCountry = new Map<string, ScoredRow[]>();
  for (const row of scored) {
    const arr = byCountry.get(row.ingestedBy) ?? [];
    arr.push(row);
    byCountry.set(row.ingestedBy, arr);
  }

  const countries: CountryStats[] = [];
  for (const [tag, rows] of byCountry.entries()) {
    const totalBills = rows.length;
    const contestedRows = rows.filter((r) => r.contested > CONTESTED_THRESHOLD);
    const unanimousRows = rows.filter((r) => r.contested === 0);
    const avgNayPct =
      rows.reduce((acc, r) => acc + r.nayPct, 0) / Math.max(1, totalBills);

    const sortedContested = [...rows].sort((a, b) => b.contested - a.contested).slice(0, 10);
    const sortedUnanimous = [...rows]
      .sort((a, b) => a.contested - b.contested || b.total - a.total)
      .slice(0, 5);

    countries.push({
      ingestedBy: tag,
      label: COUNTRY_LABELS[tag] ?? tag,
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

  const partyTotals: Record<string, PartyBreakdown & { billCount: number; country: string }> = {};
  let partyRowsParsed = 0;
  for (const r of scored) {
    if (!r.byPartyJson) continue;
    let raw: unknown;
    try {
      raw = JSON.parse(r.byPartyJson);
    } catch {
      continue;
    }
    const parsed = extractPartyCounts(raw);
    if (Object.keys(parsed).length === 0) continue;
    partyRowsParsed++;
    const country = COUNTRY_LABELS[r.ingestedBy] ?? r.ingestedBy;
    for (const [party, counts] of Object.entries(parsed)) {
      const key = `${r.ingestedBy}::${party}`;
      const prev = partyTotals[key] ?? { yes: 0, no: 0, abstain: 0, billCount: 0, country };
      prev.yes += counts.yes;
      prev.no += counts.no;
      prev.abstain += counts.abstain;
      prev.billCount += 1;
      partyTotals[key] = prev;
    }
  }

  const parties: PartyRow[] = Object.entries(partyTotals)
    .map(([key, v]) => {
      const [ingestedBy, party] = key.split("::");
      const total = v.yes + v.no + v.abstain;
      return {
        ingestedBy,
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

  return {
    meta: {
      totalVotes: scored.length,
      contestedThreshold: CONTESTED_THRESHOLD,
      minTotal: MIN_TOTAL,
      partyRowsParsed,
    },
    countries,
    globalContested,
    globalUnanimous,
    parties,
  };
}
