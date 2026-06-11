import type { ReactNode } from "react";
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

const EU_LABELS_SHORT: Record<string, string> = {
  EPP: "EPP",
  SD: "S&D",
  RENEW: "Renew",
  GREEN_EFA: "Greens/EFA",
  ECR: "ECR",
  ID: "ID",
  GUE_NGL: "The Left",
};

const US_LABELS_SHORT: Record<string, string> = {
  D: "Democrat",
  R: "Republican",
  I: "Independent",
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

function Figure({ chart, caption }: { chart: ReactNode; caption: ReactNode }) {
  return (
    <figure className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="lg:flex-[3] w-full min-w-0">{chart}</div>
      <figcaption className="lg:flex-[2] w-full text-xs text-zinc-400 leading-relaxed space-y-2 lg:pt-1">
        {caption}
      </figcaption>
    </figure>
  );
}

function StatNote({ test }: { test: ChamberAnalysis["test"] }) {
  return (
    <p className="text-zinc-500">
      <em className="not-italic text-zinc-400">Statistical note.</em>{" "}
      χ²(df={test.df}) ={" "}
      <span className="text-amber-300 tabular-nums">{fmtNum(test.chiSquare)}</span>
      , p{" "}
      <span className="text-zinc-300 tabular-nums">{test.pValueLabel}</span>
      {test.significance !== "ns" && (
        <span className="font-mono text-red-300"> {test.significance}</span>
      )}
      , Cramér V ={" "}
      <span className="text-blue-300 tabular-nums">{fmtNum(test.cramersV, 3)}</span>
      , n ={" "}
      <span className="tabular-nums">{test.n.toLocaleString()}</span>.
    </p>
  );
}

function PartyBreakdownChart({ parties }: { parties: PartyBreakdownRow[] }) {
  const hasData = parties.some((p) => p.total > 0);
  return (
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
    </div>
  );
}

type UnitySeries = {
  key: string;
  label: string;
  color: string;
  points: { year: number; rate: number }[];
};

function aggregateSeries(
  points: UnityPoint[],
  colors: Record<string, string>,
  labels: Record<string, string>,
  chamberFilter?: string,
): UnitySeries[] {
  const filtered = chamberFilter
    ? points.filter((p) => p.chamber === chamberFilter)
    : points;
  const byParty = new Map<string, Map<number, { yea: number; nay: number; total: number }>>();
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
    const rows = Array.from(inner.entries())
      .map(([year, agg]) => ({
        year,
        rate: agg.total > 0 ? Math.max(agg.yea, agg.nay) / agg.total : 0,
      }))
      .sort((a, b) => a.year - b.year);
    series.push({
      key: party,
      label: labels[party] ?? party,
      color: colors[party] ?? "#a3a3a3",
      points: rows,
    });
  }
  return series.sort((a, b) => a.label.localeCompare(b.label));
}

function UnityLineChart({ series }: { series: UnitySeries[] }) {
  const width = 600;
  const height = 220;
  const padding = { top: 16, right: 16, bottom: 30, left: 40 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const allPoints = series.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <div className="rounded border border-zinc-800 bg-zinc-950 p-4">
        <p className="text-xs text-zinc-600 italic">No time-series data.</p>
      </div>
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
    <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          width="100%"
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Party unity over time"
          style={{ maxWidth: 720 }}
        >
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
          {series.map((s) => {
            if (s.points.length === 0) return null;
            const d = s.points
              .map(
                (p, i) =>
                  `${i === 0 ? "M" : "L"}${xScale(p.year).toFixed(2)},${yScale(p.rate).toFixed(2)}`,
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
    </div>
  );
}

function BayesianForest({
  parties,
  colors,
}: {
  parties: PartyBreakdownRow[];
  colors: Record<string, string>;
}) {
  const rows = parties.filter((p) => p.total > 0);
  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-4 space-y-3">
      <div className="grid grid-cols-[110px_1fr_130px] gap-3 text-[10px] text-zinc-600 tabular-nums">
        <span />
        <div className="relative h-4">
          {[0, 25, 50, 75, 100].map((g) => (
            <span
              key={g}
              className="absolute top-0"
              style={{ left: `${g}%`, transform: "translateX(-50%)" }}
            >
              {g}%
            </span>
          ))}
        </div>
        <span className="text-right text-zinc-500">Mean [95% CI]</span>
      </div>
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-xs text-zinc-600 italic">No vote data available.</p>
        ) : (
          rows.map((p) => {
            const mean = p.posteriorMean * 100;
            const lo = Math.max(0, p.posteriorCiLower * 100);
            const hi = Math.min(100, p.posteriorCiUpper * 100);
            const color = colors[p.party] ?? "#a3a3a3";
            return (
              <div
                key={p.party}
                className="grid grid-cols-[110px_1fr_130px] gap-3 items-center"
              >
                <div className="text-xs text-zinc-200 truncate" title={p.label}>
                  {p.label}
                  <span className="ml-1.5 text-[10px] text-zinc-600 font-mono">
                    {p.party}
                  </span>
                </div>
                <div className="relative h-5 bg-zinc-900 rounded-sm">
                  {[25, 50, 75].map((g) => (
                    <div
                      key={g}
                      className="absolute top-0 bottom-0 w-px bg-zinc-800"
                      style={{ left: `${g}%` }}
                    />
                  ))}
                  <div
                    className="absolute top-1/2 -translate-y-1/2 h-1 rounded-full"
                    style={{
                      left: `${lo}%`,
                      width: `${Math.max(0.2, hi - lo)}%`,
                      background: color,
                      opacity: 0.55,
                    }}
                  />
                  <div
                    className="absolute top-1/2 w-2.5 h-2.5 rounded-full border border-zinc-950 -translate-y-1/2 -translate-x-1/2"
                    style={{ left: `${mean}%`, background: color }}
                  />
                </div>
                <div className="text-[10px] text-zinc-500 tabular-nums text-right">
                  <span className="text-zinc-300">{mean.toFixed(1)}%</span>{" "}
                  <span className="text-zinc-600">
                    [{lo.toFixed(1)}–{hi.toFixed(1)}]
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default async function VotingAnalysisSection() {
  let data;
  try {
    data = await getVotingAnalysis();
  } catch (e) {
    console.error("[VotingAnalysisSection] failed to load:", e);
    return null;
  }
  const { euParliament, usCongress } = data;

  const euSeries = aggregateSeries(
    euParliament.unityOverTime,
    EU_PARTY_COLORS,
    EU_LABELS_SHORT,
  );

  const houseSeries = aggregateSeries(
    usCongress.unityOverTime,
    US_PARTY_COLORS,
    US_LABELS_SHORT,
    "House",
  );
  const senateSeries = aggregateSeries(
    usCongress.unityOverTime,
    US_PARTY_COLORS,
    US_LABELS_SHORT,
    "Senate",
  );

  const euN = euParliament.test.n.toLocaleString();
  const usN = usCongress.test.n.toLocaleString();

  return (
    <section className="space-y-8">
      <div className="pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Member-level</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Voting Pattern Analysis</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Per-member roll-call data from EU Parliament and US Congress. Chi-square independence
          tests treat party affiliation and yea/nay direction as categorical variables; party
          unity is the share of recorded yea+nay votes on the majority side. Bayesian estimates
          use a Beta(1,1) prior with a Binomial likelihood.
        </p>
      </div>

      <aside className="rounded border border-zinc-800 bg-zinc-900/40 p-4 text-xs text-zinc-400">
        <p>
          <span className="font-semibold text-zinc-200">Data coverage.</span>{" "}
          Per-member roll-call votes are available for EU Parliament (
          <span className="tabular-nums text-zinc-200">{euN}</span> votes) and US Congress (
          <span className="tabular-nums text-zinc-200">{usN}</span> votes). Canada Parliament
          and UK Parliament records contain only aggregate yea/nay totals without per-member
          party attribution and are therefore excluded from this analysis.
        </p>
      </aside>

      <Figure
        chart={<PartyBreakdownChart parties={euParliament.parties} />}
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 1. EU Parliament voting alignment by political group.
              </span>{" "}
              Each bar shows the proportion of recorded Yea votes cast by members of each
              political group across all roll-call votes (Not Voting and Present excluded).
              Groups span the standard EPP → S&amp;D → Renew → Greens/EFA → ECR → ID →
              GUE/NGL ordering; bar width is the yea rate (yea / yea+nay). Cramér V quantifies
              the strength of association between group membership and vote direction on a
              0–1 scale.
            </p>
            <StatNote test={euParliament.test} />
          </>
        }
      />

      <Figure
        chart={<PartyBreakdownChart parties={usCongress.parties} />}
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 2. US Congress voting alignment by party.
              </span>{" "}
              House and Senate roll-calls combined, with Democrat (D), Republican (R), and
              Independent (I) members tallied separately. Bar width is the yea rate per party.
              The 3×2 contingency table on party × {`{yea, nay}`} tests whether vote direction is
              independent of party affiliation.
            </p>
            <StatNote test={usCongress.test} />
          </>
        }
      />

      <Figure
        chart={<UnityLineChart series={euSeries} />}
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 3. EU Parliament party unity over time.
              </span>{" "}
              Annual cohesion rate per political group, defined as the share of recorded
              yea/nay votes falling on the majority side of the group. The Y axis is
              truncated to 50–100% — a value of 100% means the group voted as a bloc, while
              values below ~70% indicate substantial internal fracture on roll-call votes.
            </p>
            <p className="text-zinc-500">
              Each line represents one of the seven major political groups in the EU
              Parliament; markers indicate annual aggregates over the full per-member record.
            </p>
          </>
        }
      />

      <Figure
        chart={<UnityLineChart series={houseSeries} />}
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 4. US House party unity over time.
              </span>{" "}
              House-only cohesion rate per party, computed from per-member yea/nay records.
              Each line represents the share of recorded votes by members of that party
              falling on the majority side within their caucus for the given year.
            </p>
          </>
        }
      />

      <Figure
        chart={<UnityLineChart series={senateSeries} />}
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 5. US Senate party unity over time.
              </span>{" "}
              Senate-only cohesion rate per party, with Independents shown separately where
              recorded. With only 100 senators, year-over-year shifts are noisier than the
              House series in Figure 4.
            </p>
          </>
        }
      />

      <div className="pt-4 border-t border-zinc-800">
        <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
          Posterior estimates
        </p>
        <h2 className="mt-1 text-lg font-semibold text-white">
          Bayesian Vote Proportion Estimates
        </h2>
        <p className="mt-1 text-xs text-zinc-500">
          For each party, the posterior over the underlying yea proportion θ is{" "}
          Beta(1 + yea, 1 + nay), obtained from a uniform Beta(1, 1) prior and a
          Binomial likelihood. The posterior mean is (1 + yea) / (2 + n); the 95%
          credible interval is the normal approximation mean ± 1.96 · √(μ(1−μ) / (n + 2)),
          which is tight for the sample sizes here.
        </p>
      </div>

      <Figure
        chart={
          <BayesianForest parties={euParliament.parties} colors={EU_PARTY_COLORS} />
        }
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 6. Posterior Yea proportion by EU political group.
              </span>{" "}
              Dot indicates the posterior mean θ̂; horizontal bar indicates the 95% credible
              interval. Groups well above 50% favour Yea on the average roll-call, groups
              well below 50% favour Nay. Intervals are narrow because each group has
              {" "}<span className="tabular-nums">n &gt; 10⁴</span> recorded votes; differences
              between groups are credible at the posterior level.
            </p>
          </>
        }
      />

      <Figure
        chart={
          <BayesianForest parties={usCongress.parties} colors={US_PARTY_COLORS} />
        }
        caption={
          <>
            <p>
              <span className="text-zinc-100 font-semibold">
                Figure 7. Posterior Yea proportion by US party.
              </span>{" "}
              Same Beta-Binomial structure as Figure 6, computed over combined House +
              Senate per-member records. The Independent caucus, with smaller n, has the
              widest credible interval; the Democrat and Republican intervals are essentially
              point-identified at this sample size.
            </p>
          </>
        }
      />

      <p className="text-xs text-zinc-600">
        <span className="font-mono text-red-300">*</span> p&lt;0.05 ·{" "}
        <span className="font-mono text-red-300">**</span> p&lt;0.01 ·{" "}
        <span className="font-mono text-red-300">***</span> p&lt;0.001
      </p>
    </section>
  );
}
