import {
  getVotingAnalysis,
  type ChamberAnalysis,
  type PartyBreakdownRow,
  type UnityPoint,
} from "@/lib/voting-analysis";

const EU_PARTY_COLORS: Record<string, string> = {
  EPP: "#2563eb",
  SD: "#ef4444",
  RENEW: "#f59e0b",
  GREEN_EFA: "#10b981",
  ECR: "#0ea5e9",
  ID: "#8b5cf6",
  GUE_NGL: "#be123c",
};

const US_PARTY_COLORS: Record<string, string> = {
  D: "#3b82f6",
  R: "#ef4444",
  I: "#a3a3a3",
};

function fmtPct(n: number, digits = 1): string {
  return `${(n * 100).toFixed(digits)}%`;
}

function fmtNum(n: number, digits = 2): string {
  return n.toFixed(digits);
}

function ratioToColor(rate: number): string {
  if (rate >= 0.8) return "#16a34a";
  if (rate >= 0.6) return "#65a30d";
  if (rate >= 0.45) return "#ca8a04";
  if (rate >= 0.3) return "#ea580c";
  return "#dc2626";
}

function PartyBreakdownTable({
  parties,
  test,
  title,
  description,
}: {
  parties: PartyBreakdownRow[];
  test: ChamberAnalysis["test"];
  title: string;
  description: string;
}) {
  const hasData = parties.some((p) => p.total > 0);
  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{description}</p>
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        {!hasData ? (
          <p className="text-xs text-zinc-600 italic">No vote data available.</p>
        ) : (
          parties.map((p) => {
            const widthPct = p.yeaRate * 100;
            const color = ratioToColor(p.yeaRate);
            return (
              <div key={p.party} className="space-y-1">
                <div className="flex items-baseline justify-between gap-4">
                  <div>
                    <span className="text-zinc-100">{p.label}</span>
                    <span className="ml-2 text-xs text-zinc-500 font-mono">{p.party}</span>
                  </div>
                  <div className="text-xs text-zinc-400 tabular-nums whitespace-nowrap">
                    {p.total.toLocaleString()} votes ·{" "}
                    <span style={{ color }}>{fmtPct(p.yeaRate)}</span> yea
                  </div>
                </div>
                <div className="h-3 rounded-sm bg-zinc-900 overflow-hidden">
                  <div
                    className="h-full"
                    style={{ width: `${widthPct}%`, background: color }}
                  />
                </div>
                <div className="text-[10px] text-zinc-600 tabular-nums">
                  yea {p.yea.toLocaleString()} · nay {p.nay.toLocaleString()}
                </div>
              </div>
            );
          })
        )}
        <div className="pt-3 mt-2 border-t border-zinc-800 flex flex-wrap gap-x-6 gap-y-1 text-xs text-zinc-400">
          <span>
            χ² <span className="text-amber-300 tabular-nums">{fmtNum(test.chiSquare)}</span>{" "}
            <span className="text-zinc-600">(df={test.df})</span>
          </span>
          <span>
            p-value{" "}
            <span className="text-zinc-200 tabular-nums">{test.pValueLabel}</span>
          </span>
          <span>
            Cramér V{" "}
            <span className="text-blue-300 tabular-nums">{fmtNum(test.cramersV, 3)}</span>
          </span>
          <span>
            n <span className="text-zinc-500 tabular-nums">{test.n.toLocaleString()}</span>
          </span>
          <span className="font-mono text-red-300">
            {test.significance === "ns" ? "" : test.significance}
          </span>
        </div>
      </div>
    </section>
  );
}

type UnitySeries = { key: string; label: string; color: string; points: { year: number; rate: number }[] };

function aggregateSeries(
  points: UnityPoint[],
  colors: Record<string, string>,
  labels: Record<string, string>,
  chamberFilter?: string,
): UnitySeries[] {
  const filtered = chamberFilter
    ? points.filter((p) => p.chamber === chamberFilter)
    : points;
  // Bucket by party + year; if chamberFilter not set, sum across chambers.
  const byParty = new Map<string, Map<number, { yea: number; nay: number; total: number }>>();
  // We lost yea/nay here — points already are unityRate. We need to recompute.
  // But UnityPoint only stores unityRate + total. To merge across chambers we'd need raw counts.
  // Since EU has chamber=null only, we can pass through directly.
  // For US single-chamber view, we filter to that chamber and pass through.
  for (const p of filtered) {
    const inner = byParty.get(p.party) ?? new Map();
    inner.set(p.year, {
      yea: p.unityRate * p.total,
      nay: (1 - p.unityRate) * p.total,
      total: p.total,
    });
    byParty.set(p.party, inner);
  }
  const series: UnitySeries[] = [];
  for (const [party, inner] of byParty.entries()) {
    const points = Array.from(inner.entries())
      .map(([year, agg]) => ({
        year,
        rate: agg.total > 0 ? Math.max(agg.yea, agg.nay) / agg.total : 0,
      }))
      .sort((a, b) => a.year - b.year);
    series.push({
      key: party,
      label: labels[party] ?? party,
      color: colors[party] ?? "#a3a3a3",
      points,
    });
  }
  return series.sort((a, b) => a.label.localeCompare(b.label));
}

function UnityLineChart({
  series,
  title,
  description,
  caption,
}: {
  series: UnitySeries[];
  title: string;
  description: string;
  caption?: string;
}) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <section className="space-y-2">
        <div>
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <p className="text-xs text-zinc-500 mt-1">{description}</p>
        </div>
        <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
          <p className="text-xs text-zinc-600 italic">No time-series data.</p>
        </div>
      </section>
    );
  }

  const minYear = Math.min(...allPoints.map((p) => p.year));
  const maxYear = Math.max(...allPoints.map((p) => p.year));
  const yMin = 0.5;
  const yMax = 1;

  const xScale = (year: number) =>
    maxYear === minYear
      ? padding.left + innerW / 2
      : padding.left + ((year - minYear) / (maxYear - minYear)) * innerW;
  const yScale = (rate: number) =>
    padding.top + (1 - (rate - yMin) / (yMax - yMin)) * innerH;

  const yTicks = [0.5, 0.6, 0.7, 0.8, 0.9, 1];
  const yearSpan = maxYear - minYear;
  const xTickStep = yearSpan <= 6 ? 1 : yearSpan <= 20 ? 2 : yearSpan <= 50 ? 5 : 10;
  const xTicks: number[] = [];
  for (let y = Math.ceil(minYear / xTickStep) * xTickStep; y <= maxYear; y += xTickStep) {
    xTicks.push(y);
  }

  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-base font-semibold text-white">{title}</h3>
        <p className="text-xs text-zinc-500 mt-1">{description}</p>
      </div>
      <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            width="100%"
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={title}
            style={{ maxWidth: 720 }}
          >
            {/* Y gridlines + labels */}
            {yTicks.map((t) => (
              <g key={`y-${t}`}>
                <line
                  x1={padding.left}
                  x2={width - padding.right}
                  y1={yScale(t)}
                  y2={yScale(t)}
                  stroke="#27272a"
                  strokeDasharray="3 3"
                />
                <text
                  x={padding.left - 6}
                  y={yScale(t) + 3}
                  fill="#71717a"
                  fontSize={10}
                  textAnchor="end"
                >
                  {Math.round(t * 100)}%
                </text>
              </g>
            ))}
            {/* X labels */}
            {xTicks.map((y) => (
              <text
                key={`x-${y}`}
                x={xScale(y)}
                y={height - padding.bottom + 14}
                fill="#71717a"
                fontSize={10}
                textAnchor="middle"
              >
                {y}
              </text>
            ))}
            {/* Axes */}
            <line
              x1={padding.left}
              x2={padding.left}
              y1={padding.top}
              y2={height - padding.bottom}
              stroke="#3f3f46"
            />
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={height - padding.bottom}
              y2={height - padding.bottom}
              stroke="#3f3f46"
            />
            {/* Series */}
            {series.map((s) => {
              if (s.points.length === 0) return null;
              const d = s.points
                .map(
                  (p, i) => `${i === 0 ? "M" : "L"}${xScale(p.year).toFixed(2)},${yScale(p.rate).toFixed(2)}`,
                )
                .join(" ");
              return (
                <g key={s.key}>
                  <path d={d} stroke={s.color} strokeWidth={1.5} fill="none" />
                  {s.points.map((p) => (
                    <circle
                      key={`${s.key}-${p.year}`}
                      cx={xScale(p.year)}
                      cy={yScale(p.rate)}
                      r={2}
                      fill={s.color}
                    />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-3 h-0.5"
                style={{ background: s.color }}
              />
              <span className="text-zinc-300">{s.label}</span>
              <span className="text-zinc-600 font-mono">{s.key}</span>
            </span>
          ))}
        </div>
        {caption && <p className="text-xs text-zinc-600">{caption}</p>}
      </div>
    </section>
  );
}

export default async function VotingAnalysisSection() {
  const data = await getVotingAnalysis();
  const { euParliament, usCongress } = data;

  const euSeries = aggregateSeries(
    euParliament.unityOverTime,
    EU_PARTY_COLORS,
    {
      EPP: "EPP",
      SD: "S&D",
      RENEW: "Renew",
      GREEN_EFA: "Greens/EFA",
      ECR: "ECR",
      ID: "ID",
      GUE_NGL: "The Left",
    },
  );

  const houseSeries = aggregateSeries(
    usCongress.unityOverTime,
    US_PARTY_COLORS,
    { D: "Democrat", R: "Republican", I: "Independent" },
    "House",
  );
  const senateSeries = aggregateSeries(
    usCongress.unityOverTime,
    US_PARTY_COLORS,
    { D: "Democrat", R: "Republican", I: "Independent" },
    "Senate",
  );

  return (
    <>
      <div className="pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Phase 3</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Voting Pattern Analysis</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Per-member roll-call data from EU Parliament and US Congress. Chi-square independence
          tests treat party affiliation and yea/nay direction as categorical variables; party
          unity is the share of recorded yea+nay votes on the majority side.
        </p>
      </div>

      <PartyBreakdownTable
        parties={euParliament.parties}
        test={euParliament.test}
        title="EU Parliament — Yea Rate by Group"
        description="Share of recorded yea votes per group across all roll-calls. 7×2 contingency table on yea/nay (Not Voting + Present excluded). df = 6."
      />

      <PartyBreakdownTable
        parties={usCongress.parties}
        test={usCongress.test}
        title="US Congress — Yea Rate by Party"
        description="House + Senate roll-calls combined. 3×2 contingency table on yea/nay. df = 2."
      />

      <UnityLineChart
        series={euSeries}
        title="EU Parliament — Party Unity Over Time"
        description="Per-group unity rate by year — the share of recorded yea/nay votes that fell on the majority side. 100% = perfectly cohesive group."
        caption="Higher = more internal cohesion. A drop below ~70% indicates a fractured group."
      />

      <UnityLineChart
        series={houseSeries}
        title="US House — Party Unity Over Time"
        description="House-only unity rate per party by year, computed from per-member yea/nay records."
      />

      <UnityLineChart
        series={senateSeries}
        title="US Senate — Party Unity Over Time"
        description="Senate-only unity rate per party by year."
      />

      <p className="text-xs text-zinc-600">
        <span className="font-mono text-red-300">*</span> p&lt;0.05 ·{" "}
        <span className="font-mono text-red-300">**</span> p&lt;0.01 ·{" "}
        <span className="font-mono text-red-300">***</span> p&lt;0.001
      </p>
    </>
  );
}
