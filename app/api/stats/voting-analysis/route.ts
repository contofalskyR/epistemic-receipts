import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

type PartyKey = "Democrat" | "Republican" | "Other";
const PARTY_KEYS: PartyKey[] = ["Democrat", "Republican", "Other"];

type PartyTally = { yes: number; no: number; abstain: number };

type TopicChiSquare = {
  topic: string;
  chiSquare: number;
  pValue: number;
  cramersV: number;
  n: number;
  significance: "***" | "**" | "*" | "";
};

type UnityRow = {
  year: number;
  party: PartyKey;
  unity_rate: number;
  total: number;
};

type BayesianRow = {
  topic: string;
  party: PartyKey;
  posterior_mean: number;
  ci_lower: number;
  ci_upper: number;
  yea: number;
  nay: number;
};

export type VotingAnalysisResponse = {
  chiSquareByTopic: TopicChiSquare[];
  partyUnityOverTime: UnityRow[];
  bayesianPosteriors: BayesianRow[];
};

function parsePartyJson(raw: string): Record<string, PartyTally> | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const out: Record<string, PartyTally> = {};
  for (const [party, counts] of Object.entries(parsed as Record<string, unknown>)) {
    if (!counts || typeof counts !== "object") continue;
    const c = counts as Record<string, unknown>;
    const yes = Number(c.yes ?? 0);
    const no = Number(c.no ?? 0);
    const abstain = Number(c.abstain ?? 0);
    if (!Number.isFinite(yes) || !Number.isFinite(no) || !Number.isFinite(abstain)) continue;
    out[party] = { yes, no, abstain };
  }
  return Object.keys(out).length > 0 ? out : null;
}

function parseTopicArray(raw: string): string[] | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  return parsed.filter((t): t is string => typeof t === "string");
}

function classifyParty(name: string): PartyKey {
  const lower = name.toLowerCase();
  if (lower.startsWith("democrat") || lower.startsWith("dem")) return "Democrat";
  if (lower.startsWith("republican") || lower.startsWith("rep")) return "Republican";
  return "Other";
}

function pValueDf2(chiSq: number): number {
  if (chiSq > 13.816) return 0.001;
  if (chiSq > 9.21) return 0.01;
  if (chiSq > 5.991) return 0.05;
  return 1;
}

function significanceStars(p: number): "***" | "**" | "*" | "" {
  if (p <= 0.001) return "***";
  if (p <= 0.01) return "**";
  if (p <= 0.05) return "*";
  return "";
}

function computeChiSquare(
  yeas: [number, number, number],
  nays: [number, number, number],
): { chiSq: number; n: number } {
  const observed: [number[], number[]] = [yeas, nays];
  const rowTotals = [
    yeas[0] + yeas[1] + yeas[2],
    nays[0] + nays[1] + nays[2],
  ];
  const colTotals: [number, number, number] = [
    yeas[0] + nays[0],
    yeas[1] + nays[1],
    yeas[2] + nays[2],
  ];
  const n = rowTotals[0] + rowTotals[1];
  if (n === 0) return { chiSq: 0, n: 0 };
  let chiSq = 0;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      const expected = (rowTotals[r] * colTotals[c]) / n;
      if (expected === 0) continue;
      const diff = observed[r][c] - expected;
      chiSq += (diff * diff) / expected;
    }
  }
  return { chiSq, n };
}

export async function GET() {
  const votes = await prisma.legislativeVote.findMany({
    where: {
      source: { ingestedBy: "congress_v1" },
      byPartyJson: { not: null },
      topics: { not: null },
    },
    select: {
      voteDate: true,
      byPartyJson: true,
      topics: true,
    },
    take: 50000,
  });

  type TopicTally = {
    yeas: [number, number, number];
    nays: [number, number, number];
  };
  const topicMap = new Map<string, TopicTally>();
  const unityMap = new Map<
    string,
    { year: number; party: PartyKey; yes: number; no: number }
  >();
  const bayesMap = new Map<
    string,
    { topic: string; party: PartyKey; yes: number; no: number }
  >();

  for (const v of votes) {
    if (!v.byPartyJson || !v.topics) continue;
    const parties = parsePartyJson(v.byPartyJson);
    if (!parties) continue;
    const topicList = parseTopicArray(v.topics);
    if (!topicList || topicList.length === 0) continue;

    const buckets: Record<PartyKey, { yes: number; no: number }> = {
      Democrat: { yes: 0, no: 0 },
      Republican: { yes: 0, no: 0 },
      Other: { yes: 0, no: 0 },
    };
    for (const [name, tally] of Object.entries(parties)) {
      const key = classifyParty(name);
      buckets[key].yes += tally.yes;
      buckets[key].no += tally.no;
    }

    for (const topic of topicList) {
      const t = topicMap.get(topic) ?? {
        yeas: [0, 0, 0] as [number, number, number],
        nays: [0, 0, 0] as [number, number, number],
      };
      t.yeas[0] += buckets.Democrat.yes;
      t.yeas[1] += buckets.Republican.yes;
      t.yeas[2] += buckets.Other.yes;
      t.nays[0] += buckets.Democrat.no;
      t.nays[1] += buckets.Republican.no;
      t.nays[2] += buckets.Other.no;
      topicMap.set(topic, t);

      for (const party of PARTY_KEYS) {
        const k = `${topic}|${party}`;
        const acc = bayesMap.get(k) ?? { topic, party, yes: 0, no: 0 };
        acc.yes += buckets[party].yes;
        acc.no += buckets[party].no;
        bayesMap.set(k, acc);
      }
    }

    if (v.voteDate) {
      const year = v.voteDate.getUTCFullYear();
      const yearBuckets: Record<PartyKey, { yes: number; no: number }> = {
        Democrat: { yes: 0, no: 0 },
        Republican: { yes: 0, no: 0 },
        Other: { yes: 0, no: 0 },
      };
      for (const [name, tally] of Object.entries(parties)) {
        const key = classifyParty(name);
        yearBuckets[key].yes += tally.yes;
        yearBuckets[key].no += tally.no;
      }
      for (const party of PARTY_KEYS) {
        if (party === "Other") continue;
        const totals = yearBuckets[party];
        if (totals.yes + totals.no === 0) continue;
        const k = `${year}|${party}`;
        const acc = unityMap.get(k) ?? { year, party, yes: 0, no: 0 };
        acc.yes += totals.yes;
        acc.no += totals.no;
        unityMap.set(k, acc);
      }
    }
  }

  const chiSquareByTopic: TopicChiSquare[] = [];
  for (const [topic, t] of topicMap.entries()) {
    const { chiSq, n } = computeChiSquare(t.yeas, t.nays);
    if (n === 0) continue;
    const p = pValueDf2(chiSq);
    const cramersV = n > 0 ? Math.sqrt(chiSq / n) : 0;
    chiSquareByTopic.push({
      topic,
      chiSquare: chiSq,
      pValue: p,
      cramersV,
      n,
      significance: significanceStars(p),
    });
  }
  chiSquareByTopic.sort((a, b) => b.chiSquare - a.chiSquare);

  const partyUnityOverTime: UnityRow[] = Array.from(unityMap.values())
    .map(({ year, party, yes, no }) => {
      const total = yes + no;
      const unity_rate = total > 0 ? Math.max(yes, no) / total : 0;
      return { year, party, unity_rate, total };
    })
    .sort((a, b) => a.year - b.year || a.party.localeCompare(b.party));

  const bayesianPosteriors: BayesianRow[] = Array.from(bayesMap.values()).map(
    ({ topic, party, yes, no }) => {
      const mean = (1 + yes) / (2 + yes + no);
      const se = Math.sqrt((mean * (1 - mean)) / (yes + no + 2));
      return {
        topic,
        party,
        posterior_mean: mean,
        ci_lower: Math.max(0, mean - 1.96 * se),
        ci_upper: Math.min(1, mean + 1.96 * se),
        yea: yes,
        nay: no,
      };
    },
  );

  const body: VotingAnalysisResponse = {
    chiSquareByTopic: chiSquareByTopic.slice(0, 15),
    partyUnityOverTime,
    bayesianPosteriors,
  };

  return NextResponse.json(body);
}
