"use client";

import { useEffect, useMemo, useState } from "react";
import type { TopicTrendResult } from "@/lib/topic-trends";
import { ERAS } from "@/lib/us-presidents";

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

type EraStyle = { barBg: string; headerBg: string; headerText: string; abbr: string };

const ERA_STYLES: Record<string, EraStyle> = {
  "Founding Era":               { barBg: "bg-amber-950/30",  headerBg: "bg-amber-950/60",  headerText: "text-amber-400",  abbr: "Founding" },
  "Jacksonian Era":             { barBg: "bg-amber-900/20",  headerBg: "bg-amber-900/50",  headerText: "text-amber-300",  abbr: "Jacksonian" },
  "Civil War & Reconstruction": { barBg: "bg-red-950/30",    headerBg: "bg-red-950/60",    headerText: "text-red-300",    abbr: "Civil War" },
  "Gilded Age":                 { barBg: "bg-orange-950/20", headerBg: "bg-orange-950/50", headerText: "text-orange-300", abbr: "Gilded Age" },
  "Progressive Era":            { barBg: "bg-yellow-950/20", headerBg: "bg-yellow-950/50", headerText: "text-yellow-300", abbr: "Progressive" },
  "New Deal & WWII":            { barBg: "bg-green-950/20",  headerBg: "bg-green-950/50",  headerText: "text-green-300",  abbr: "New Deal" },
  "Cold War":                   { barBg: "bg-blue-950/20",   headerBg: "bg-blue-950/50",   headerText: "text-blue-300",   abbr: "Cold War" },
  "Post-Cold War":              { barBg: "bg-purple-950/20", headerBg: "bg-purple-950/50", headerText: "text-purple-300", abbr: "Post-CW" },
  "Modern":                     { barBg: "bg-slate-800/20",  headerBg: "bg-slate-800/50",  headerText: "text-slate-300",  abbr: "Modern" },
};

function topicLabel(slug: string): string {
  return TOPIC_LABELS[slug] ?? slug.replace(/_/g, " ");
}

function topicColor(slug: string): string {
  return TOPIC_COLORS[slug] ?? "bg-gray-800/60 border-gray-600/60 text-gray-200";
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

function eraForDecade(decade: number): string {
  for (const era of ERAS) {
    const start = parseInt(era.start.slice(0, 4), 10);
    const end = parseInt(era.end.slice(0, 4), 10);
    if (decade >= start && decade <= end) return era.label;
  }
  return "Modern";
}

function getEraStyle(eraLabel: string): EraStyle {
  return (
    ERA_STYLES[eraLabel] ?? {
      barBg: "",
      headerBg: "bg-gray-800/30",
      headerText: "text-gray-400",
      abbr: eraLabel.slice(0, 8),
    }
  );
}

type VoteItem = {
  id: string;
  title: string;
  voteDate: string | null;
  chamber: string;
  result: string | null;
  yesCount: number | null;
  noCount: number | null;
  url: string | null;
};

type DrawerState = { topic: string; eraLabel: string } | null;

// ── Topic timeline (the zeitgeist lens): one topic's share of congressional
//    attention, decade by decade, 1789→present. Dots open the vote drawer. ──
function TopicTimeline({
  decades,
  slug,
  eraBoundaries,
  onDecadeClick,
}: {
  decades: TopicTrendResult["decades"];
  slug: string;
  eraBoundaries: Set<number>;
  onDecadeClick: (decade: number) => void;
}) {
  const pts = decades.map((d) => ({
    decade: d.decade,
    p: d.normalized[slug] ?? 0,
    count: d.topics[slug] ?? 0,
  }));
  const maxP = Math.max(...pts.map((x) => x.p), 0.0001);
  const peak = pts.reduce((best, x) => (x.p > best.p ? x : best), pts[0]);
  const W = 920, H = 170, padL = 40, padR = 12, padT = 16, padB = 22;
  const x = (i: number) => padL + (i * (W - padL - padR)) / Math.max(1, pts.length - 1);
  const y = (p: number) => padT + (1 - p / maxP) * (H - padT - padB);
  const line = pts.map((pt, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(pt.p).toFixed(1)}`).join(" ");
  const area = `${line} L${x(pts.length - 1).toFixed(1)},${H - padB} L${x(0).toFixed(1)},${H - padB} Z`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
      aria-label={`${topicLabel(slug)} share of congressional votes per decade`}>
      {/* era boundaries */}
      {pts.map((pt, i) =>
        eraBoundaries.has(pt.decade) ? (
          <line key={`b${pt.decade}`} x1={x(i)} x2={x(i)} y1={padT} y2={H - padB}
            stroke="#374151" strokeWidth={1} strokeDasharray="2,3" />
        ) : null,
      )}
      {/* baseline + max label */}
      <line x1={padL} x2={W - padR} y1={H - padB} y2={H - padB} stroke="#1f2937" strokeWidth={1} />
      <text x={4} y={padT + 8} fontSize={9} fill="#6b7280" fontFamily="monospace">
        {(maxP * 100).toFixed(0)}%
      </text>
      <text x={4} y={H - padB} fontSize={9} fill="#4b5563" fontFamily="monospace">0%</text>
      {/* decade ticks (every other, to breathe) */}
      {pts.map((pt, i) =>
        i % 2 === 0 ? (
          <text key={`t${pt.decade}`} x={x(i)} y={H - 8} fontSize={8} fill="#4b5563"
            fontFamily="monospace" textAnchor="middle">
            {String(pt.decade).slice(2)}s
          </text>
        ) : null,
      )}
      <path d={area} fill="#2563eb" opacity={0.14} />
      <path d={line} fill="none" stroke="#3b82f6" strokeWidth={1.8} />
      {pts.map((pt, i) => (
        <circle key={pt.decade} cx={x(i)} cy={y(pt.p)} r={pt.count > 0 ? 3.5 : 2}
          fill={pt.count > 0 ? "#60a5fa" : "#374151"}
          className={pt.count > 0 ? "cursor-pointer hover:opacity-70" : undefined}
          onClick={() => pt.count > 0 && onDecadeClick(pt.decade)}>
          <title>{`${pt.decade}s — ${(pt.p * 100).toFixed(1)}% of votes (${pt.count.toLocaleString()} votes). Click for the receipts.`}</title>
        </circle>
      ))}
      {/* peak annotation */}
      {peak && peak.p > 0 && (
        <text x={x(pts.indexOf(peak))} y={Math.max(10, y(peak.p) - 8)} fontSize={9}
          fill="#93c5fd" fontFamily="monospace" textAnchor="middle">
          peak {peak.decade}s · {(peak.p * 100).toFixed(1)}%
        </text>
      )}
    </svg>
  );
}

export default function TopicTrendsClient({ data }: { data: TopicTrendResult }) {
  const eras = data.hotTopics.map((h) => h.era);
  const [selectedEra, setSelectedEra] = useState<string>(eras[0] ?? "");
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  // Drawer state
  const [drawerState, setDrawerState] = useState<DrawerState>(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerVotes, setDrawerVotes] = useState<VoteItem[]>([]);
  const [drawerTotal, setDrawerTotal] = useState(0);
  const [drawerOffset, setDrawerOffset] = useState(0);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const selected = data.hotTopics.find((h) => h.era === selectedEra) ?? data.hotTopics[0];

  const maxJs = useMemo(
    () => data.klSequence.reduce((m, k) => Math.max(m, k.jsDivergence), 0),
    [data.klSequence],
  );

  const heatmapTopics = useMemo(() => {
    return Object.entries(data.overallDist)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 18)
      .map(([slug]) => slug);
  }, [data.overallDist]);

  // The zeitgeist lens: which single topic is being traced across decades.
  const [focusTopic, setFocusTopic] = useState<string>(
    () =>
      Object.entries(data.overallDist).sort(([, a], [, b]) => b - a)[0]?.[0] ?? "civil_rights",
  );

  // Biggest decade-to-decade shifts in congressional attention.
  const topShifts = useMemo(
    () => [...data.klSequence].sort((a, b) => b.jsDivergence - a.jsDivergence).slice(0, 5),
    [data.klSequence],
  );

  const topicMax = useMemo(() => {
    const m: Record<string, number> = {};
    for (const slug of heatmapTopics) {
      let mx = 0;
      for (const d of data.decades) mx = Math.max(mx, d.normalized[slug] ?? 0);
      m[slug] = mx;
    }
    return m;
  }, [data.decades, heatmapTopics]);

  // Group consecutive decades by era for heatmap header
  const decadeEraGroups = useMemo(() => {
    const groups: { eraLabel: string; cols: number }[] = [];
    for (const d of data.decades) {
      const era = eraForDecade(d.decade);
      const last = groups[groups.length - 1];
      if (last && last.eraLabel === era) {
        last.cols++;
      } else {
        groups.push({ eraLabel: era, cols: 1 });
      }
    }
    return groups;
  }, [data.decades]);

  // Set of decade values that are the first in their era group (for era-boundary borders)
  const eraBoundaryDecades = useMemo(() => {
    const boundaries = new Set<number>();
    let idx = 0;
    for (const g of decadeEraGroups) {
      if (idx > 0) boundaries.add(data.decades[idx]?.decade);
      idx += g.cols;
    }
    return boundaries;
  }, [decadeEraGroups, data.decades]);

  // Escape key closes drawer
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drawerState) closeDrawer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [drawerState]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch votes when drawer opens
  useEffect(() => {
    if (!drawerState) return;
    setDrawerLoading(true);
    setDrawerVotes([]);
    setDrawerTotal(0);
    setDrawerOffset(0);
    fetch(
      `/api/analysis/topic-trends/votes?topic=${encodeURIComponent(drawerState.topic)}&era=${encodeURIComponent(drawerState.eraLabel)}&limit=20&offset=0`,
    )
      .then((r) => r.json())
      .then((data) => {
        setDrawerVotes(data.votes ?? []);
        setDrawerTotal(data.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setDrawerLoading(false));
  }, [drawerState]);

  // Sync drawerVisible when drawerState opens (one tick delay for CSS transition)
  useEffect(() => {
    if (!drawerState) return;
    const id = setTimeout(() => setDrawerVisible(true), 0);
    return () => clearTimeout(id);
  }, [drawerState]);

  function openDrawer(topic: string, eraLabel: string) {
    setDrawerState({ topic, eraLabel });
  }

  function closeDrawer() {
    setDrawerVisible(false);
    setTimeout(() => setDrawerState(null), 280);
  }

  function loadMore() {
    if (!drawerState || drawerLoading) return;
    const nextOffset = drawerOffset + 20;
    setDrawerLoading(true);
    setDrawerOffset(nextOffset);
    fetch(
      `/api/analysis/topic-trends/votes?topic=${encodeURIComponent(drawerState.topic)}&era=${encodeURIComponent(drawerState.eraLabel)}&limit=20&offset=${nextOffset}`,
    )
      .then((r) => r.json())
      .then((data) => {
        setDrawerVotes((prev) => [...prev, ...(data.votes ?? [])]);
      })
      .catch(() => {})
      .finally(() => setDrawerLoading(false));
  }

  return (
    <div className="space-y-10 text-sm text-gray-300">
      <div>
        <p className="text-xs text-gray-500 font-mono uppercase tracking-widest">Analysis</p>
        <h1 className="mt-1 text-2xl font-semibold text-white">
          Congressional Topic Trends (1789–2026)
        </h1>
        <p className="mt-2 text-gray-400 max-w-2xl leading-relaxed">
          The congressional zeitgeist, measured: what Congress actually spent its votes on, era by
          era, from{" "}
          {data.decades.reduce((s, d) => s + d.totalVotes, 0).toLocaleString()} Voteview roll-calls
          since 1789. Trace one topic&apos;s rise and fall, see the decades where attention
          shifted hardest, and click anything — every chip, dot, and cell opens the actual votes
          behind the number.
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
          over-represented in this era relative to the 1789–2026 baseline. Click a chip to see
          votes.
        </p>

        <div className="rounded border border-gray-800 bg-gray-900/40 px-4 py-4">
          {selected && selected.hot.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selected.hot.map((h) => (
                <button
                  key={h.topic}
                  className={`px-3 py-1.5 rounded border text-xs cursor-pointer transition-opacity hover:opacity-80 ${topicColor(h.topic)}`}
                  title={`${h.count.toLocaleString()} votes — click to see vote list`}
                  style={{ touchAction: 'manipulation' }}
                  onClick={() => openDrawer(h.topic, selected.era)}
                >
                  <span className="font-medium">{topicLabel(h.topic)}</span>
                  <span className="ml-2 font-mono opacity-80">×{h.lift.toFixed(1)}</span>
                  <span className="ml-2 text-[10px] opacity-60">{h.count.toLocaleString()}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-500">No hot topics for this era.</p>
          )}
        </div>

        {/* All eras summary — rows are clickable */}
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
                  className={`border-b border-gray-800/50 last:border-0 cursor-pointer transition-colors ${
                    selectedEra === h.era
                      ? "bg-blue-950/40 ring-1 ring-inset ring-blue-800/40"
                      : i % 2 === 0
                        ? "hover:bg-gray-800/30"
                        : "bg-gray-900/20 hover:bg-gray-800/30"
                  }`}
                  onClick={() => setSelectedEra(h.era)}
                >
                  <td className="px-3 py-2 align-top whitespace-nowrap text-gray-100">{h.era}</td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-1.5">
                      {h.hot.slice(0, 3).map((t) => (
                        <button
                          key={t.topic}
                          className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer hover:opacity-80 transition-opacity ${topicColor(t.topic)}`}
                          style={{ touchAction: 'manipulation' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDrawer(t.topic, h.era);
                          }}
                        >
                          {topicLabel(t.topic)}{" "}
                          <span className="font-mono opacity-70">×{t.lift.toFixed(1)}</span>
                        </button>
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
          1 = maximally different). Background tint shows historical era. Amber bars = high-shift
          decades. Hover for details.
        </p>

        <div className="rounded border border-gray-800 bg-gray-900/40 p-4">
          <div className="relative">
            {/* Bar chart — fixed 160px height, era-colored column backgrounds */}
            <div className="flex h-40 gap-[2px]">
              {data.klSequence.map((k, i) => {
                const barHeight = maxJs > 0 ? Math.max(4, (k.jsDivergence / maxJs) * 160) : 4;
                const isHigh = k.jsDivergence >= maxJs * 0.7;
                const eraBg = getEraStyle(eraForDecade(k.toDecade)).barBg;
                return (
                  <div
                    key={`${k.fromDecade}-${k.toDecade}`}
                    className={`flex-1 flex flex-col justify-end min-w-0 ${eraBg}`}
                    onMouseEnter={() => setHoverIdx(i)}
                    onMouseLeave={() => setHoverIdx(null)}
                  >
                    <div
                      className={`w-full rounded-t transition-colors ${
                        isHigh
                          ? "bg-amber-500/80 hover:bg-amber-400"
                          : "bg-blue-700/70 hover:bg-blue-500"
                      } ${hoverIdx === i ? "ring-1 ring-white/40" : ""}`}
                      style={{ height: `${barHeight}px` }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Axis labels — full decade on every 4th bar */}
            <div className="flex gap-[2px] mt-1">
              {data.klSequence.map((k, i) => (
                <div
                  key={`label-${k.fromDecade}-${k.toDecade}`}
                  className="flex-1 text-center min-w-0 overflow-hidden"
                >
                  {i % 4 === 0 ? (
                    <span className="text-[8px] font-mono text-gray-600 whitespace-nowrap">
                      {String(k.toDecade).slice(2)}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {/* Era legend below axis */}
            <div className="flex gap-[2px] mt-1">
              {(() => {
                const groups: { eraLabel: string; cols: number; startIdx: number }[] = [];
                data.klSequence.forEach((k, i) => {
                  const era = eraForDecade(k.toDecade);
                  const last = groups[groups.length - 1];
                  if (last && last.eraLabel === era) {
                    last.cols++;
                  } else {
                    groups.push({ eraLabel: era, cols: 1, startIdx: i });
                  }
                });
                return groups.map((g) => {
                  const s = getEraStyle(g.eraLabel);
                  return (
                    <div
                      key={g.eraLabel}
                      className={`text-[7px] font-mono text-center overflow-hidden whitespace-nowrap ${s.headerText} opacity-70`}
                      style={{ flex: g.cols }}
                    >
                      {g.cols >= 3 ? s.abbr : ""}
                    </div>
                  );
                });
              })()}
            </div>
          </div>

          {hoverIdx !== null && data.klSequence[hoverIdx] && (
            <div className="mt-4 border-t border-gray-800 pt-3 text-xs">
              <div className="text-gray-200 font-medium">
                {data.klSequence[hoverIdx]!.fromDecade}s →{" "}
                {data.klSequence[hoverIdx]!.toDecade}s
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

      {/* Trace one topic — the zeitgeist lens */}
      <section id="topic-timeline" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4 flex-wrap">
          <h2 className="text-base font-semibold text-white">Trace one topic through time</h2>
          <label className="text-xs text-gray-500 flex items-center gap-2">
            Topic
            <select
              value={focusTopic}
              onChange={(e) => setFocusTopic(e.target.value)}
              className="bg-gray-900 border border-gray-700 rounded px-2 py-1 text-gray-200 text-xs"
            >
              {heatmapTopics.map((slug) => (
                <option key={slug} value={slug}>
                  {topicLabel(slug)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="text-xs text-gray-500">
          One topic&apos;s share of all congressional roll-calls, decade by decade since 1789 —
          the zeitgeist as a line. Dotted verticals mark era boundaries. Click any decade dot
          to open the actual votes behind it.
        </p>
        <div className="rounded border border-gray-800 bg-gray-900/40 p-4">
          <div className="mb-2">
            <span className={`px-2 py-0.5 rounded border text-[11px] ${topicColor(focusTopic)}`}>
              {topicLabel(focusTopic)}
            </span>
          </div>
          <TopicTimeline
            decades={data.decades}
            slug={focusTopic}
            eraBoundaries={eraBoundaryDecades}
            onDecadeClick={(decade) => openDrawer(focusTopic, eraForDecade(decade))}
          />
        </div>
      </section>

      {/* Biggest zeitgeist shifts */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">The biggest zeitgeist shifts</h2>
        <p className="text-xs text-gray-500">
          The five decade transitions where congressional attention changed most (Jensen-Shannon
          divergence between consecutive decades). ▲ rising topics, ▼ fading — click a chip to
          see the votes that drove the shift.
        </p>
        <div className="rounded border border-gray-800 bg-gray-900/40 divide-y divide-gray-800/60">
          {topShifts.map((k) => (
            <div key={`${k.fromDecade}-${k.toDecade}`} className="px-4 py-3 flex items-center gap-4 flex-wrap">
              <span className="font-mono text-xs text-gray-300 shrink-0 w-32">
                {k.fromDecade}s → {k.toDecade}s
              </span>
              <span className="font-mono text-[10px] text-gray-600 shrink-0" title="Jensen-Shannon divergence (0 = identical decades, 1 = maximally different)">
                JS {k.jsDivergence.toFixed(2)}
              </span>
              <span className="flex flex-wrap gap-1.5">
                {k.topChanges.slice(0, 4).map((c) => (
                  <button
                    key={c.topic}
                    onClick={() => openDrawer(c.topic, eraForDecade(k.toDecade))}
                    className={`px-2 py-0.5 rounded border text-[11px] cursor-pointer hover:opacity-80 transition-opacity ${topicColor(c.topic)}`}
                    title={`${topicLabel(c.topic)}: ${c.delta >= 0 ? "+" : ""}${(c.delta * 100).toFixed(1)} percentage points of attention`}
                  >
                    {c.delta >= 0 ? "▲" : "▼"} {topicLabel(c.topic)}{" "}
                    <span className="font-mono opacity-70">
                      {c.delta >= 0 ? "+" : ""}{(c.delta * 100).toFixed(1)}pp
                    </span>
                  </button>
                ))}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Heat map */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold text-white">Topic intensity by decade</h2>
        <p className="text-xs text-gray-500">
          Cell darkness = topic&apos;s share of votes in that decade (normalized per row).
          Column headers show full decade; era bands above group them historically.
        </p>

        <div className="rounded border border-gray-800 overflow-x-auto">
          <table className="text-[11px] min-w-full">
            <thead>
              {/* Era band header row */}
              <tr className="border-b border-gray-700">
                <th className="px-2 py-1 sticky left-0 bg-gray-900/80 z-10 text-left text-[9px] font-semibold text-gray-500 uppercase tracking-wide">
                  Era
                </th>
                {decadeEraGroups.map((g, i) => {
                  const s = getEraStyle(g.eraLabel);
                  return (
                    <th
                      key={g.eraLabel}
                      colSpan={g.cols}
                      className={`px-1 py-1 text-center text-[8px] font-medium ${s.headerBg} ${s.headerText} whitespace-nowrap ${i > 0 ? "border-l-2 border-l-gray-500" : ""}`}
                    >
                      {g.cols >= 2 ? s.abbr : "·"}
                    </th>
                  );
                })}
              </tr>
              {/* Decade header row */}
              <tr className="border-b border-gray-800 bg-gray-900/50">
                <th className="px-2 py-2 text-left font-medium text-gray-500 sticky left-0 bg-gray-900/80 z-10">
                  Topic
                </th>
                {data.decades.map((d) => (
                  <th
                    key={d.decade}
                    className={`px-1 py-2 text-center font-mono text-[10px] text-gray-500 whitespace-nowrap ${eraBoundaryDecades.has(d.decade) ? "border-l-2 border-l-gray-600" : ""}`}
                  >
                    {d.decade}s
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {heatmapTopics.map((slug) => (
                <tr key={slug} className="border-b border-gray-800/40 last:border-0">
                  <td className="px-2 py-1 whitespace-nowrap sticky left-0 bg-gray-950 z-10">
                    <button
                      onClick={() => {
                        setFocusTopic(slug);
                        document.getElementById("topic-timeline")?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}
                      className="text-gray-200 hover:text-blue-300 transition-colors cursor-pointer"
                      title={`Trace ${topicLabel(slug)} through time ↑`}
                    >
                      {topicLabel(slug)}
                    </button>
                  </td>
                  {data.decades.map((d) => {
                    const p = d.normalized[slug] ?? 0;
                    const max = topicMax[slug] ?? 0;
                    const intensity = max > 0 ? p / max : 0;
                    const count = d.topics[slug] ?? 0;
                    return (
                      <td
                        key={`${slug}-${d.decade}`}
                        onClick={() => count > 0 && openDrawer(slug, eraForDecade(d.decade))}
                        className={`w-7 h-7 text-center align-middle ${heatClass(intensity)} ${eraBoundaryDecades.has(d.decade) ? "border-l-2 border-l-gray-600" : ""} ${count > 0 ? "cursor-pointer hover:ring-1 hover:ring-inset hover:ring-blue-400/70" : ""}`}
                        title={`${topicLabel(slug)} · ${d.decade}s: ${count.toLocaleString()} votes (${(p * 100).toFixed(1)}%)${count > 0 ? " — click for the votes" : ""}`}
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
        <a
          href="/api/analysis/topic-trends"
          className="text-gray-500 hover:text-gray-300 underline"
        >
          /api/analysis/topic-trends
        </a>{" "}
        · Source: <span className="font-mono">LegislativeVote</span> records ingested by{" "}
        <span className="font-mono">voteview_v1</span>, topic-tagged via keyword taxonomy on
        roll-call descriptions.
      </div>

      {/* Vote drawer */}
      {drawerState && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 z-40"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          {/* Drawer panel */}
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${topicLabel(drawerState.topic)} votes — ${drawerState.eraLabel}`}
            className="fixed right-0 top-0 h-full w-full md:w-[520px] bg-gray-950 border-l border-gray-800 z-50 flex flex-col shadow-2xl transition-transform duration-[280ms] ease-out"
            style={{ transform: drawerVisible ? "translateX(0)" : "translateX(100%)" }}
          >
            {/* Header */}
            <div className="flex items-start justify-between px-5 py-4 border-b border-gray-800 gap-3">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {topicLabel(drawerState.topic)} votes
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{drawerState.eraLabel}</p>
              </div>
              <button
                onClick={closeDrawer}
                className="shrink-0 text-gray-500 hover:text-gray-300 transition-colors mt-0.5"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
              {drawerLoading && drawerVotes.length === 0 ? (
                <p className="text-xs text-gray-500 py-8 text-center">Loading…</p>
              ) : drawerVotes.length === 0 ? (
                <p className="text-xs text-gray-500 py-8 text-center">
                  No votes found for {topicLabel(drawerState.topic)} in {drawerState.eraLabel}.
                </p>
              ) : (
                <>
                  <p className="text-xs text-gray-600 pb-1">
                    {drawerTotal.toLocaleString()} vote{drawerTotal !== 1 ? "s" : ""} total
                  </p>
                  {drawerVotes.map((v) => (
                    <div
                      key={v.id}
                      className="rounded border border-gray-800 bg-gray-900/40 p-3 space-y-1.5"
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                            v.chamber === "House"
                              ? "bg-blue-950/40 border-blue-800/60 text-blue-300"
                              : "bg-purple-950/40 border-purple-800/60 text-purple-300"
                          }`}
                        >
                          {v.chamber}
                        </span>
                        {v.result && (
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${
                              v.result === "passed"
                                ? "bg-green-950/40 border-green-800/60 text-green-300"
                                : v.result === "failed"
                                  ? "bg-red-950/40 border-red-800/60 text-red-300"
                                  : "bg-gray-800/60 border-gray-600/60 text-gray-300"
                            }`}
                          >
                            {v.result}
                          </span>
                        )}
                        {v.voteDate && (
                          <span className="text-[10px] text-gray-600 font-mono">
                            {new Date(v.voteDate).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      {v.url ? (
                        <a
                          href={v.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-300 hover:text-blue-300 line-clamp-2 underline decoration-gray-700 hover:decoration-blue-400 transition-colors"
                          title={v.title}
                        >
                          {v.title}
                        </a>
                      ) : (
                        <p className="text-xs text-gray-300 line-clamp-2" title={v.title}>
                          {v.title}
                        </p>
                      )}
                      {(v.yesCount != null || v.noCount != null) && (
                        <div className="flex gap-3 text-[10px] font-mono">
                          {v.yesCount != null && (
                            <span className="text-green-600">✓ {v.yesCount.toLocaleString()}</span>
                          )}
                          {v.noCount != null && (
                            <span className="text-red-600">✗ {v.noCount.toLocaleString()}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {drawerVotes.length < drawerTotal && (
                    <button
                      onClick={loadMore}
                      disabled={drawerLoading}
                      className="w-full py-2.5 text-xs text-gray-500 border border-gray-800 rounded hover:bg-gray-800/50 transition-colors disabled:opacity-50 mt-2"
                    >
                      {drawerLoading
                        ? "Loading…"
                        : `Load more (${(drawerTotal - drawerVotes.length).toLocaleString()} remaining)`}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
