import { prisma } from "@/lib/prisma";
import { ERAS } from "@/lib/us-presidents";

export type DecadeTopicDist = {
  decade: number;
  totalVotes: number;
  /** Votes with ≥1 topic tag — the honest denominator for `normalized`. */
  taggedVotes: number;
  /** taggedVotes / totalVotes — surfaced so the UI can show coverage. */
  coverage: number;
  topics: Record<string, number>;
  normalized: Record<string, number>;
};

export type KLResult = {
  fromDecade: number;
  toDecade: number;
  jsDivergence: number;
  topChanges: { topic: string; delta: number }[];
};

export type EraHot = {
  era: string;
  hot: { topic: string; lift: number; count: number }[];
};

export type TopicTrendResult = {
  decades: DecadeTopicDist[];
  klSequence: KLResult[];
  hotTopics: EraHot[];
  overallDist: Record<string, number>;
};

type VoteRow = { topics: string | null; voteDate: Date | null };

const SMOOTH = 1e-10;

function parseTopics(json: string | null): string[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    if (Array.isArray(v)) return v.filter((s): s is string => typeof s === "string");
    return [];
  } catch {
    return [];
  }
}

function normalize(counts: Record<string, number>, total: number): Record<string, number> {
  if (total <= 0) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(counts)) out[k] = v / total;
  return out;
}

function klDivergence(p: Record<string, number>, m: Record<string, number>, keys: string[]): number {
  let sum = 0;
  for (const k of keys) {
    const pk = (p[k] ?? 0) + SMOOTH;
    const mk = (m[k] ?? 0) + SMOOTH;
    sum += pk * Math.log(pk / mk);
  }
  return sum;
}

function jsDivergence(p: Record<string, number>, q: Record<string, number>): number {
  const keys = Array.from(new Set([...Object.keys(p), ...Object.keys(q)]));
  const m: Record<string, number> = {};
  for (const k of keys) m[k] = ((p[k] ?? 0) + (q[k] ?? 0)) / 2;
  const jsNats = (klDivergence(p, m, keys) + klDivergence(q, m, keys)) / 2;
  // Convert nats → log2 scale so 0 ≤ JS ≤ 1.
  return jsNats / Math.log(2);
}

export async function getTopicTrends(): Promise<TopicTrendResult> {
  const rows = await prisma.$queryRaw<VoteRow[]>`
    SELECT lv.topics AS topics, lv."voteDate" AS "voteDate"
    FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
      AND lv.topics IS NOT NULL
      AND lv."voteDate" IS NOT NULL
  `;

  const decadeMap = new Map<number, { total: number; tagged: number; counts: Record<string, number> }>();
  const overallCounts: Record<string, number> = {};
  let overallTagged = 0;

  for (const row of rows) {
    if (!(row.voteDate instanceof Date) || Number.isNaN(row.voteDate.getTime())) continue;
    const year = row.voteDate.getUTCFullYear();
    const decade = Math.floor(year / 10) * 10;
    let bucket = decadeMap.get(decade);
    if (!bucket) {
      bucket = { total: 0, tagged: 0, counts: {} };
      decadeMap.set(decade, bucket);
    }
    bucket.total++;
    const topics = parseTopics(row.topics);
    if (topics.length > 0) {
      bucket.tagged++;
      overallTagged++;
    }
    for (const t of topics) {
      bucket.counts[t] = (bucket.counts[t] ?? 0) + 1;
      overallCounts[t] = (overallCounts[t] ?? 0) + 1;
    }
  }

  // Denominator fix (2026-07-04 audit): shares are computed over TAGGED votes,
  // not all votes. Tagging coverage swings 44–71% across decades (procedural
  // titles defeat keywords, especially 2000s+), so dividing by all votes let
  // coverage leak into the "zeitgeist" signal. Coverage is exposed per decade
  // so the UI can show it instead of silently absorbing it.
  const decades: DecadeTopicDist[] = Array.from(decadeMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([decade, { total, tagged, counts }]) => ({
      decade,
      totalVotes: total,
      taggedVotes: tagged,
      coverage: total > 0 ? tagged / total : 0,
      topics: counts,
      normalized: normalize(counts, tagged),
    }));

  const klSequence: KLResult[] = [];
  for (let i = 1; i < decades.length; i++) {
    const prev = decades[i - 1]!;
    const cur = decades[i]!;
    const js = jsDivergence(prev.normalized, cur.normalized);
    const allKeys = Array.from(
      new Set([...Object.keys(prev.normalized), ...Object.keys(cur.normalized)]),
    );
    const deltas = allKeys
      .map((k) => ({ topic: k, delta: (cur.normalized[k] ?? 0) - (prev.normalized[k] ?? 0) }))
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 5);
    klSequence.push({
      fromDecade: prev.decade,
      toDecade: cur.decade,
      jsDivergence: js,
      topChanges: deltas,
    });
  }

  const overallDist = normalize(overallCounts, overallTagged);

  const hotTopics: EraHot[] = ERAS.map((era) => {
    const start = new Date(`${era.start}T00:00:00.000Z`).getTime();
    const end = new Date(`${era.end}T23:59:59.999Z`).getTime();
    const eraCounts: Record<string, number> = {};
    let eraTagged = 0;
    for (const row of rows) {
      if (!(row.voteDate instanceof Date)) continue;
      const t = row.voteDate.getTime();
      if (t < start || t > end) continue;
      const tps = parseTopics(row.topics);
      if (tps.length > 0) eraTagged++;
      for (const tp of tps) {
        eraCounts[tp] = (eraCounts[tp] ?? 0) + 1;
      }
    }
    const eraDist = normalize(eraCounts, eraTagged);
    const lifts = Object.entries(eraDist)
      .map(([topic, p]) => {
        const baseline = overallDist[topic] ?? 0;
        const lift = baseline > 0 ? p / baseline : 0;
        return { topic, lift, count: eraCounts[topic] ?? 0 };
      })
      .filter((x) => x.count >= 5)
      .sort((a, b) => b.lift - a.lift)
      .slice(0, 8);
    return { era: era.label, hot: lifts };
  });

  return { decades, klSequence, hotTopics, overallDist };
}
