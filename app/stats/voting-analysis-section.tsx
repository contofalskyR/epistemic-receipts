"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PartyKey = "Democrat" | "Republican" | "Other";

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

type VotingAnalysisResponse = {
  chiSquareByTopic: TopicChiSquare[];
  partyUnityOverTime: UnityRow[];
  bayesianPosteriors: BayesianRow[];
};

type SortKey = "topic" | "chiSquare" | "pValue" | "cramersV";
type SortDir = "asc" | "desc";

const TOPIC_LABELS: Record<string, string> = {
  defense: "Defense",
  health: "Health",
  economy: "Economy",
  environment: "Environment",
  justice: "Justice",
  immigration: "Immigration",
  education: "Education",
  infrastructure: "Infrastructure",
  foreign_policy: "Foreign Policy",
  social: "Social",
};

const PARTY_COLORS: Record<PartyKey, string> = {
  Democrat: "#60a5fa",
  Republican: "#f87171",
  Other: "#a3a3a3",
};

function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug;
}

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtNum(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function pValueLabel(p: number): string {
  if (p <= 0.001) return "<0.001";
  if (p <= 0.01) return "<0.01";
  if (p <= 0.05) return "<0.05";
  return "≥0.05";
}

export default function VotingAnalysisSection() {
  const [data, setData] = useState<VotingAnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("chiSquare");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/stats/voting-analysis")
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as VotingAnalysisResponse;
      })
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "failed to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedChi = useMemo<TopicChiSquare[]>(() => {
    if (!data) return [];
    const arr = [...data.chiSquareByTopic];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      if (sortKey === "topic") return topicLabel(a.topic).localeCompare(topicLabel(b.topic)) * dir;
      if (sortKey === "pValue") return (a.pValue - b.pValue) * dir;
      if (sortKey === "cramersV") return (a.cramersV - b.cramersV) * dir;
      return (a.chiSquare - b.chiSquare) * dir;
    });
    return arr;
  }, [data, sortKey, sortDir]);

  const chartData = useMemo(() => {
    if (!data) return [];
    const byYear = new Map<number, { year: number; Democrat?: number; Republican?: number }>();
    for (const row of data.partyUnityOverTime) {
      if (row.party === "Other") continue;
      const entry = byYear.get(row.year) ?? { year: row.year };
      entry[row.party] = Number((row.unity_rate * 100).toFixed(2));
      byYear.set(row.year, entry);
    }
    return Array.from(byYear.values()).sort((a, b) => a.year - b.year);
  }, [data]);

  const topPolarized = useMemo(() => {
    if (!data) return [] as { topic: string; rows: BayesianRow[] }[];
    const topTopics = data.chiSquareByTopic.slice(0, 5).map((t) => t.topic);
    return topTopics.map((topic) => {
      const rows = data.bayesianPosteriors
        .filter((b) => b.topic === topic)
        .sort((a, b) => {
          const order: Record<PartyKey, number> = { Democrat: 0, Republican: 1, Other: 2 };
          return order[a.party] - order[b.party];
        });
      return { topic, rows };
    });
  }, [data]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "topic" ? "asc" : "desc");
    }
  }

  function sortIndicator(key: SortKey): string {
    if (sortKey !== key) return "";
    return sortDir === "asc" ? " ↑" : " ↓";
  }

  return (
    <>
      <div className="pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Phase 3</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Voting Pattern Analysis</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Chi-square independence tests, party unity over time, and Bayesian posteriors over
          Congress votes with party-level data.
        </p>
      </div>

      {error && (
        <p className="text-xs text-red-400">Failed to load voting analysis: {error}</p>
      )}
      {!data && !error && (
        <p className="text-xs text-zinc-500">Loading voting analysis…</p>
      )}

      {data && (
        <>
          {/* Chi-square table */}
          <section className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-white">Topic × Party Independence</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Pearson chi-square on a 2×3 yea/nay × Democrat/Republican/Other contingency table
                per topic. df=2. Cramér V quantifies effect size. Larger χ² = stronger party
                association.
              </p>
            </div>
            <div className="rounded border border-zinc-800 overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 bg-zinc-900/60">
                    <th
                      className="px-3 py-2 text-left font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
                      onClick={() => toggleSort("topic")}
                    >
                      Topic{sortIndicator("topic")}
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
                      onClick={() => toggleSort("chiSquare")}
                    >
                      χ²{sortIndicator("chiSquare")}
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
                      onClick={() => toggleSort("pValue")}
                    >
                      p-value{sortIndicator("pValue")}
                    </th>
                    <th
                      className="px-3 py-2 text-right font-medium text-zinc-500 cursor-pointer select-none hover:text-zinc-300"
                      onClick={() => toggleSort("cramersV")}
                    >
                      Cramér V{sortIndicator("cramersV")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-zinc-500">n</th>
                    <th className="px-3 py-2 text-left font-medium text-zinc-500">Sig.</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedChi.map((r, i) => (
                    <tr
                      key={r.topic}
                      className={`border-b border-zinc-800/50 last:border-0 ${
                        i % 2 === 0 ? "" : "bg-zinc-900/20"
                      }`}
                    >
                      <td className="px-3 py-2 text-zinc-300">{topicLabel(r.topic)}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-amber-300">
                        {fmtNum(r.chiSquare, 2)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                        {pValueLabel(r.pValue)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-300">
                        {fmtNum(r.cramersV, 3)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-zinc-500">
                        {r.n.toLocaleString()}
                      </td>
                      <td className="px-3 py-2 font-mono text-red-300">{r.significance}</td>
                    </tr>
                  ))}
                  {sortedChi.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-zinc-600">
                        No topic × party data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-zinc-600">
              <span className="font-mono text-red-300">*</span> p&lt;0.05 ·{" "}
              <span className="font-mono text-red-300">**</span> p&lt;0.01 ·{" "}
              <span className="font-mono text-red-300">***</span> p&lt;0.001
            </p>
          </section>

          {/* Party unity trend chart */}
          <section className="space-y-2">
            <div>
              <h3 className="text-base font-semibold text-white">Party Unity Over Time</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Share of party-aggregated yes/no votes that fell on the majority side per year. 1.0
                = perfect unity, 0.5 = even split.
              </p>
            </div>
            <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
              {chartData.length === 0 ? (
                <p className="text-xs text-zinc-600 italic">No party unity time-series data.</p>
              ) : (
                <div style={{ width: "100%", height: 280 }}>
                  <ResponsiveContainer>
                    <LineChart
                      data={chartData}
                      margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                    >
                      <CartesianGrid stroke="#27272a" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="year"
                        stroke="#71717a"
                        tick={{ fill: "#a1a1aa", fontSize: 11 }}
                      />
                      <YAxis
                        stroke="#71717a"
                        tick={{ fill: "#a1a1aa", fontSize: 11 }}
                        domain={[50, 100]}
                        tickFormatter={(v: number) => `${v}%`}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "#09090b",
                          border: "1px solid #3f3f46",
                          fontSize: 12,
                        }}
                        labelStyle={{ color: "#e4e4e7" }}
                        formatter={(v) => {
                          const n = typeof v === "number" ? v : Number(v);
                          return Number.isFinite(n) ? `${n.toFixed(1)}%` : String(v);
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, color: "#d4d4d8" }} />
                      <Line
                        type="monotone"
                        dataKey="Democrat"
                        stroke={PARTY_COLORS.Democrat}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="Republican"
                        stroke={PARTY_COLORS.Republican}
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </section>

          {/* Bayesian posteriors */}
          <section className="space-y-3">
            <div>
              <h3 className="text-base font-semibold text-white">
                Bayesian Posteriors — Top 5 Polarized Topics
              </h3>
              <p className="text-xs text-zinc-500 mt-1">
                Beta(1, 1) prior updated with yea/nay tallies per topic × party. Posterior mean is
                the estimated P(yea); 95% credible interval shown alongside. Non-overlapping
                intervals between parties indicate the data robustly separates them.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topPolarized.map(({ topic, rows }) => (
                <div
                  key={topic}
                  className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-zinc-100">{topicLabel(topic)}</p>
                    <p className="text-xs text-zinc-500 font-mono">{topic}</p>
                  </div>
                  <div className="space-y-3">
                    {rows.map((r) => {
                      const meanPct = r.posterior_mean * 100;
                      const leftPct = r.ci_lower * 100;
                      const widthPct = Math.max(0.5, (r.ci_upper - r.ci_lower) * 100);
                      return (
                        <div key={r.party} className="space-y-1">
                          <div className="flex items-baseline justify-between gap-2">
                            <span
                              className="text-xs font-medium"
                              style={{ color: PARTY_COLORS[r.party] }}
                            >
                              {r.party}
                            </span>
                            <span className="text-xs tabular-nums text-zinc-400">
                              {fmtPct(r.posterior_mean)} [{fmtPct(r.ci_lower)}–
                              {fmtPct(r.ci_upper)}]
                            </span>
                          </div>
                          <div className="relative h-2 rounded-sm bg-zinc-900 overflow-hidden">
                            <div
                              className="absolute inset-y-0 rounded-sm opacity-40"
                              style={{
                                left: `${leftPct}%`,
                                width: `${widthPct}%`,
                                background: PARTY_COLORS[r.party],
                              }}
                            />
                            <div
                              className="absolute inset-y-0 w-0.5"
                              style={{
                                left: `${meanPct}%`,
                                background: PARTY_COLORS[r.party],
                              }}
                            />
                          </div>
                          <div className="text-[10px] text-zinc-600 tabular-nums">
                            yea {r.yea.toLocaleString()} · nay {r.nay.toLocaleString()}
                          </div>
                        </div>
                      );
                    })}
                    {rows.length === 0 && (
                      <p className="text-xs text-zinc-600 italic">No party data for this topic.</p>
                    )}
                  </div>
                </div>
              ))}
              {topPolarized.length === 0 && (
                <p className="text-xs text-zinc-600 italic">No polarized topics to display.</p>
              )}
            </div>
          </section>
        </>
      )}
    </>
  );
}
