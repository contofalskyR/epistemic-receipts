import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const revalidate = 3600;

export const metadata = {
  title: "Retraction Lag — Epistemic Receipts",
  description:
    "How long does it take for science to correct itself? Retraction lag across 11,326 original-paper / retraction pairs.",
};

type TopicRow = {
  topic: string;
  avg_lag: number;
  median_lag: number;
  n: number;
  earliest_paper: number;
  latest_retraction: number;
};

type DistRow = {
  lag_years: number;
  n: number;
};

type OverallRow = {
  total: number;
  median_lag: number;
  avg_lag: number;
};

async function loadData() {
  const [topics, dist, overall] = await Promise.all([
    prisma.$queryRaw<TopicRow[]>`
      SELECT
        t.name AS topic,
        ROUND(AVG(EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt")))::int AS avg_lag,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt"))::int AS median_lag,
        COUNT(*)::int AS n,
        MIN(EXTRACT(YEAR FROM c1."claimEmergedAt"))::int AS earliest_paper,
        MAX(EXTRACT(YEAR FROM c2."claimEmergedAt"))::int AS latest_retraction
      FROM "ClaimRelation" cr
      JOIN "Claim" c1 ON c1.id = cr."fromClaimId"
      JOIN "Claim" c2 ON c2.id = cr."toClaimId"
      JOIN "ClaimTopic" ct ON ct."claimId" = c1.id
      JOIN "Topic" t ON t.id = ct."topicId"
      WHERE cr."relationType" = 'REVERSED'
        AND c1."claimEmergedAt" IS NOT NULL
        AND c2."claimEmergedAt" IS NOT NULL
        AND c1.deleted = false
        AND c2.deleted = false
        AND (EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt")) >= 0
      GROUP BY t.name
      HAVING COUNT(*) >= 3
      ORDER BY n DESC
      LIMIT 30
    `,
    prisma.$queryRaw<DistRow[]>`
      SELECT
        (EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt"))::int AS lag_years,
        COUNT(*)::int AS n
      FROM "ClaimRelation" cr
      JOIN "Claim" c1 ON c1.id = cr."fromClaimId"
      JOIN "Claim" c2 ON c2.id = cr."toClaimId"
      WHERE cr."relationType" = 'REVERSED'
        AND c1."claimEmergedAt" IS NOT NULL
        AND c2."claimEmergedAt" IS NOT NULL
        AND c1.deleted = false AND c2.deleted = false
        AND (EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt")) >= 0
        AND (EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt")) <= 80
      GROUP BY lag_years
      ORDER BY lag_years
    `,
    prisma.$queryRaw<OverallRow[]>`
      SELECT
        COUNT(*)::int AS total,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt"))::int AS median_lag,
        ROUND(AVG(EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt")), 1)::float AS avg_lag
      FROM "ClaimRelation" cr
      JOIN "Claim" c1 ON c1.id = cr."fromClaimId"
      JOIN "Claim" c2 ON c2.id = cr."toClaimId"
      WHERE cr."relationType" = 'REVERSED'
        AND c1."claimEmergedAt" IS NOT NULL
        AND c2."claimEmergedAt" IS NOT NULL
        AND c1.deleted = false AND c2.deleted = false
        AND (EXTRACT(YEAR FROM c2."claimEmergedAt") - EXTRACT(YEAR FROM c1."claimEmergedAt")) >= 0
    `,
  ]);

  return { topics, dist, overall: overall[0] };
}

function DistChart({ dist }: { dist: DistRow[] }) {
  if (!dist.length) return null;
  const maxN = Math.max(...dist.map((d) => d.n));
  const total = dist.reduce((a, d) => a + d.n, 0);
  // Cap the visible x-axis at 20 years; bucket the long tail into a final "20+" bar.
  const head = dist.filter((d) => d.lag_years < 20);
  const tailN = dist.filter((d) => d.lag_years >= 20).reduce((a, d) => a + d.n, 0);
  const bars: { label: string; n: number }[] = [
    ...head.map((d) => ({ label: String(d.lag_years), n: d.n })),
    ...(tailN > 0 ? [{ label: "20+", n: tailN }] : []),
  ];

  return (
    <div className="rounded border border-gray-800 bg-gray-900/40 p-5">
      <div className="flex items-end gap-1.5 h-56" role="img" aria-label="Retraction lag distribution">
        {bars.map((b) => {
          const h = maxN > 0 ? (b.n / maxN) * 100 : 0;
          const share = total > 0 ? (b.n / total) * 100 : 0;
          return (
            <div key={b.label} className="flex-1 flex flex-col items-center justify-end h-full group">
              <div className="text-[10px] text-gray-500 mb-1 tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                {b.n.toLocaleString()} · {share.toFixed(1)}%
              </div>
              <div
                className="w-full rounded-t bg-gradient-to-t from-indigo-700 to-cyan-500 hover:from-indigo-500 hover:to-cyan-300 transition-colors"
                style={{ height: `${Math.max(h, 0.6)}%` }}
                title={`${b.label} yr — ${b.n.toLocaleString()} pairs (${share.toFixed(1)}%)`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5 mt-2">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 text-center text-[10px] text-gray-500 tabular-nums">
            {b.label}
          </div>
        ))}
      </div>
      <div className="mt-2 text-center text-[11px] text-gray-600">
        Lag in years (publication → retraction). Hover a bar for counts.
      </div>
    </div>
  );
}

export default async function RetractionLagPage() {
  const { topics, dist, overall } = await loadData();

  return (
    <div className="max-w-5xl mx-auto space-y-10 text-sm text-gray-300">
      {/* Hero */}
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Analysis</p>
        <h1 className="mt-1 text-3xl font-semibold text-white leading-tight">
          How long does it take for science to correct itself?
        </h1>
        <p className="mt-3 text-gray-400 max-w-3xl leading-relaxed">
          Every retraction is a delay made visible: the gap between when a flawed
          paper entered the record and when the record finally caught up. This
          page measures that gap — the <span className="text-gray-200">retraction lag</span> —
          across {overall.total.toLocaleString()} original-paper / retraction pairs
          where both dates are known.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          <div className="rounded border border-gray-800 bg-gray-900 px-4 py-3">
            <div className="text-xs text-gray-500 mb-1">Reversed pairs</div>
            <div className="text-2xl font-semibold text-white tabular-nums">
              {overall.total.toLocaleString()}
            </div>
          </div>
          <div className="rounded border border-indigo-900/50 bg-indigo-950/30 px-4 py-3">
            <div className="text-xs text-indigo-400 mb-1">Median lag</div>
            <div className="text-2xl font-semibold text-indigo-200 tabular-nums">
              {overall.median_lag} {overall.median_lag === 1 ? "year" : "years"}
            </div>
          </div>
          <div className="rounded border border-cyan-900/50 bg-cyan-950/30 px-4 py-3">
            <div className="text-xs text-cyan-400 mb-1">Mean lag</div>
            <div className="text-2xl font-semibold text-cyan-200 tabular-nums">
              {overall.avg_lag} years
            </div>
          </div>
        </div>
      </div>

      {/* Section 1: distribution */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Overall lag distribution</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Most corrections land fast — a large share of retractions happen the
            same year or the year after the original publication — but a long tail
            of papers stays in the record for a decade or more before being pulled.
          </p>
        </div>
        <DistChart dist={dist} />
      </section>

      {/* Section 2: by topic */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-semibold text-white">Lag by topic</h2>
          <p className="text-xs text-gray-500 max-w-3xl leading-relaxed">
            Top {topics.length} topics by number of retracted papers. Each retracted
            paper inherits the topic tags of the original claim, so a single paper
            can appear under several broad fields. Topics with fewer than 3 pairs
            are excluded.
          </p>
        </div>
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Topic</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Papers retracted</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Median lag (yrs)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Mean lag (yrs)</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Earliest paper</th>
                <th className="px-3 py-2 text-right font-medium text-gray-500">Latest retraction</th>
              </tr>
            </thead>
            <tbody>
              {topics.map((r, i) => (
                <tr
                  key={r.topic}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 text-gray-100 align-top">{r.topic}</td>
                  <td className="px-3 py-2 text-right text-gray-200 tabular-nums">{r.n.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-indigo-300 tabular-nums">{r.median_lag}</td>
                  <td className="px-3 py-2 text-right text-cyan-300 tabular-nums">{r.avg_lag}</td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.earliest_paper}</td>
                  <td className="px-3 py-2 text-right text-gray-400 tabular-nums">{r.latest_retraction}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Framing note */}
      <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-3 text-[11px] text-gray-500 leading-relaxed max-w-3xl">
        This analysis uses {overall.total.toLocaleString()} pairs of original papers
        and their retractions, where both publication and retraction dates are known.
        Lag is measured in calendar years (retraction year − publication year); pairs
        with a negative computed lag are excluded as date-metadata artifacts.
      </div>

      <div className="border-t border-gray-800 pt-4 text-xs text-gray-600">
        Source:{" "}
        <Link href="/retraction-explorer" className="text-gray-500 hover:text-gray-300 underline">
          Retraction Explorer
        </Link>{" "}
        · derived from <span className="font-mono">REVERSED</span> claim relations in the graph.
      </div>
    </div>
  );
}
