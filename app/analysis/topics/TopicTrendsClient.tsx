"use client";

import { useMemo, useState } from "react";
import type { TopicTrendResult } from "@/lib/topic-trends";

const TOPIC_LABELS: Record<string, string> = {
  slavery: "Slavery",
  civil_rights: "Civil Rights",
  military: "Military",
  war: "War",
  defense: "Defense",
  tariff_trade: "Tariff & Trade",
  banking_finance: "Banking & Finance",
  taxation: "Taxation",
  immigration: "Immigration",
  public_lands: "Public Lands",
  native_affairs: "Native Affairs",
  infrastructure: "Infrastructure",
  postal: "Postal",
  judiciary: "Judiciary",
  foreign_policy: "Foreign Policy",
  health: "Health",
  education: "Education",
  environment: "Environment",
  agriculture: "Agriculture",
  labor: "Labor",
  housing: "Housing",
  appropriations: "Appropriations",
  social_welfare: "Social Welfare",
  prohibition: "Prohibition",
  technology: "Technology",
};

const TOPIC_COLORS: Record<string, string> = {
  slavery: "bg-red-900/40 border-red-700/60 text-red-200",
  civil_rights: "bg-amber-900/40 border-amber-700/60 text-amber-200",
  military: "bg-zinc-800/60 border-zinc-600/60 text-zinc-200",
  war: "bg-rose-900/40 border-rose-700/60 text-rose-200",
  defense: "bg-slate-800/60 border-slate-600/60 text-slate-200",
  tariff_trade: "bg-yellow-900/40 border-yellow-700/60 text-yellow-200",
  banking_finance: "bg-emerald-900/40 border-emerald-700/60 text-emerald-200",
  taxation: "bg-green-900/40 border-green-700/60 text-green-200",
  immigration: "bg-orange-900/40 border-orange-700/60 text-orange-200",
  public_lands: "bg-lime-900/40 border-lime-700/60 text-lime-200",
  native_affairs: "bg-amber-900/40 border-amber-700/60 text-amber-200",
  infrastructure: "bg-blue-900/40 border-blue-700/60 text-blue-200",
  postal: "bg-sky-900/40 border-sky-700/60 text-sky-200",
  judiciary: "bg-violet-900/40 border-violet-700/60 text-violet-200",
  foreign_policy: "bg-indigo-900/40 border-indigo-700/60 text-indigo-200",
  health: "bg-pink-900/40 border-pink-700/60 text-pink-200",
  education: "bg-purple-900/40 border-purple-700/60 text-purple-200",
  environment: "bg-teal-900/40 border-teal-700/60 text-teal-200",
  agriculture: "bg-lime-900/40 border-lime-700/60 text-lime-200",
  labor: "bg-cyan-900/40 border-cyan-700/60 text-cyan-200",
  housing: "bg-fuchsia-900/40 border-fuchsia-700/60 text-fuchsia-200",
  appropriations: "bg-gray-800/60 border-gray-600/60 text-gray-200",
  social_welfare: "bg-pink-900/40 border-pink-700/60 text-pink-200",
  prohibition: "bg-red-900/40 border-red-700/60 text-red-200",
  technology: "bg-blue-900/40 border-blue-700/60 text-blue-200",
};

function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug.replace(/_/g, " ");
}

function topicColor(slug: string): string {
  return TOPIC_COLORS[slug] ?? "bg-gray-800/60 border-gray-600/60 text-gray-200";
}

function decadeLabel(d: number): string {
  return `${d}s`;
}

function heatClass(intensity: number): string {
  if (intensity <= 0) return "bg-gray-900/40";
  if (intensity < 0.05) return "bg-blue-600/10";
  if (intensity < 0.1) return "bg-blue-600/20";
  if (intensity < 0.2) return "bg-blue-600/40";
  if (intensity < 0.3) return "bg-blue-600/60";
  if (intensity < 0.45) return "bg-blue-600/80";
  return "bg-blue-500";
}

export default function TopicTrendsClient({ data }: { data: TopicTrendResult }) {
  const eras = data.hotTopics.map((h) => h.era);
  const [selectedEra, setSelectedEra] = useState<string>(eras[0] ?? "");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const selected = data.hotTopics.find((h) => h.era === selectedEra) ?? data.hotTopics[0];

  const maxJs = useMemo(
    () => data.klSequence.reduce((m, k) => Math.max(m, k.jsDivergence), 0),
    [data.klSequence],
  );

  // Determine top topics for heat map: pick topics ranked by overall share.
  const heatmapTopics = useMemo(() => {
    return Object.entries(data.overallDist)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 18)
      .map(([slug]) => slug);
  }, [data.overallDist]);

  // Per-topic max proportion across decades, so heat is relative within row.
  const topicMax = useMemo(() => {
    const m: Record<string, number> = {};
    for (const slug of heatmapTopics) {
      let mx = 0;
      for (const d of data.decades) mx = Math.max(mx, d.normalized[slug] ?? 0);
      m[slug] = mx;
    }
    return m;
  }, [data.decades, heatmapTopics]);

  return (
    <div className="space-y-10 text-sm text-gray-300">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Analysis</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          Congressional Topic Trends (1789–2026)
        </h1>
        <p className="mt-2 text-gray-400 max-w-2xl leading-relaxed">
          Which issues dominated each era? KL/JS divergence tracks when congressional attention
          shifted. Topics derived from {data.decades.reduce((s, d) => s + d.totalVotes, 0).toLocaleString()}{" "}
          Voteview roll-call descriptions, matched against a hand-curated keyword taxonomy.
        </p>
      </div>

      {/* Era hot topics */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-base font-semibold text-white">Hot topics by era</h2>
          <label className="text-xs text-gray-500 flex items-center gap-2">
            Era
            <select
              value={selectedEra}
              onChange={(e) => setSelectedEra(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
            >
              {eras.map((era) => (
                <option key={era} value={era}>
                  {era}
                </option>
              ))}
            </select>
          </label>
        </div>

        <p className="text-xs text-gray-500">
          Lift = P(topic | era) / P(topic | overall). Topics with lift &gt; 3× are strongly
          over-represented in this era relative to the 1789–2026 baseline.
        </p>

        <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-4">
          {selected && selected.hot.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.hot.map((h) => (
                <div
                  key={h.topic}
                  className={`px-3 py-1.5 rounded border text-xs ${topicColor(h.topic)}`}
                  title={`${h.count.toLocaleString()} votes`}
                >
                  <span className="font-medium">{topicLabel(h.topic)}</span>
                  <span className="ml-2 font-mono opacity-80">×{h.lift.toFixed(1)}</span>
                  <span className="ml-2 text-[10px] opacity-60">{h.count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No hot topics for this era.</p>
          )}
        </div>

        {/* All eras summary */}
        <div className="rounded border border-gray-800 overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-3 py-2 text-left font-medium text-gray-500">Era</th>
                <th className="px-3 py-2 text-left font-medium text-gray-500">
                  Top 3 over-represented topics
                </th>
              </tr>
            </thead>
            <tbody>
              {data.hotTopics.map((h, i) => (
                <tr
                  key={h.era}
                  className={`border-b border-gray-800/50 last:border-0 ${i % 2 === 0 ? "" : "bg-gray-900/20"}`}
                >
                  <td className="px-3 py-2 align-top whitespace-nowrap text-gray-100">{h.era}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {h.hot.slice(0, 3).map((t) => (
                        <span
                          key={t.topic}
                          className={`px-2 py-0.5 rounded border text-[11px] ${topicColor(t.topic)}`}
                        >
                          {topicLabel(t.topic)} <span className="font-mono opacity-70">×{t.lift.toFixed(1)}</span>
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Decade divergence timeline */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Decade-to-decade divergence</h2>
        <p className="text-xs text-gray-500">
          Jensen-Shannon divergence between consecutive decade topic distributions (0 = identical,
          1 = maximally different). Hover a bar to see which topics shifted most.
        </p>

        <div className="rounded border border-gray-800 bg-gray-900/40 p-4">
          <div className="relative">
            <div className="flex items-end gap-[2px] h-40">
              {data.klSequence.map((k, i) => {
                const hPct = maxJs > 0 ? (k.jsDivergence / maxJs) * 100 : 0;
                const isHigh = k.jsDivergence >= maxJs * 0.7;
                return (
                  <div
                    key={`${k.fromDecade}-${k.toDecade}`}
                    className="flex-1 flex flex-col items-center min-w-0"
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    <div
                      className={`w-full rounded-t transition-colors ${
                        isHigh ? "bg-amber-500/80 hover:bg-amber-400" : "bg-blue-700/70 hover:bg-blue-500"
                      } ${hoverIdx === i ? "ring-1 ring-white/40" : ""}`}
                      style={{ height: `${Math.max(2, hPct)}%` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[2px] mt-1">
              {data.klSequence.map((k, i) => (
                <div
                  key={`label-${k.fromDecade}-${k.toDecade}`}
                  className="flex-1 text-center text-[9px] font-mono text-gray-600 min-w-0"
                >
                  {i % 2 === 0 ? `${String(k.toDecade).slice(-2)}` : ""}
                </div>
              ))}
            </div>
          </div>

          {hoverIdx !== null && data.klSequence[hoverIdx] && (
            <div className="mt-4 border-t border-gray-800 pt-3 text-xs">
              <div className="text-gray-200 font-medium">
                {decadeLabel(data.klSequence[hoverIdx]!.fromDecade)} →{" "}
                {decadeLabel(data.klSequence[hoverIdx]!.toDecade)}
              </div>
              <div className="text-gray-500 mt-0.5">
                JS divergence:{" "}
                <span className="text-amber-300 font-mono">
                  {data.klSequence[hoverIdx]!.jsDivergence.toFixed(4)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {data.klSequence[hoverIdx]!.topChanges.slice(0, 3).map((c) => (
                  <span
                    key={c.topic}
                    className={`px-2 py-0.5 rounded border text-[11px] ${topicColor(c.topic)}`}
                  >
                    {topicLabel(c.topic)}{" "}
                    <span className="font-mono opacity-70">
                      {c.delta > 0 ? "+" : ""}
                      {(c.delta * 100).toFixed(1)}pp
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Heat map */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Topic intensity by decade</h2>
        <p className="text-xs text-gray-500">
          Cell darkness = topic's share of votes in that decade (normalized per row, so each topic
          row is shaded relative to its own peak decade).
        </p>

        <div className="rounded border border-gray-800 overflow-x-auto">
          <table className="text-[11px] min-w-full">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-2 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-900/80 z-10">
                  Topic
                </th>
                {data.decades.map((d) => (
                  <th
                    key={d.decade}
                    className="px-1 py-2 text-center font-mono text-[10px] text-gray-500 whitespace-nowrap"
                  >
                    {String(d.decade).slice(-2)}s
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapTopics.map((slug) => (
                <tr key={slug} className="border-b border-gray-800/40 last:border-0">
                  <td className="px-2 py-1 text-gray-200 whitespace-nowrap sticky left-0 bg-gray-950 z-10">
                    {topicLabel(slug)}
                  </td>
                  {data.decades.map((d) => {
                    const p = d.normalized[slug] ?? 0;
                    const max = topicMax[slug] ?? 0;
                    const intensity = max > 0 ? p / max : 0;
                    const count = d.topics[slug] ?? 0;
                    return (
                      <td
                        key={`${slug}-${d.decade}`}
                        className={`w-7 h-7 text-center align-middle ${heatClass(intensity)}`}
                        title={`${topicLabel(slug)} · ${decadeLabel(d.decade)}: ${count.toLocaleString()} votes (${(p * 100).toFixed(1)}%)`}
                      >
                        <span className="text-[9px] text-white/60 font-mono">
                          {count > 0 ? count : ""}
                        </span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="border-t border-gray-800 pt-4 text-xs text-gray-600">
        Data:{" "}
        <a href="/api/analysis/topic-trends" className="text-gray-500 hover:text-gray-300 underline">
          /api/analysis/topic-trends
        </a>{" "}
        · Source: <span className="font-mono">LegislativeVote</span> records ingested by{" "}
        <span className="font-mono">voteview_v1</span>, topic-tagged via keyword taxonomy on roll-call
        descriptions.
      </div>
    </div>
  );
}
