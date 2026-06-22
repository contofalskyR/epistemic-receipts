"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

// design tokens — match settling-curve overview
const C = {
  bg: "#08080f",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#f0a000",
  blue: "#3690c0",
  green: "#1a9850",
  red: "#d73027",
  deep: "#08519c",
};

interface SurvivalPoint {
  yearsAfterEmergence: number;
  pctUnsettled: number;
}
interface DecadeStat {
  decade: string;
  decadeStart: number;
  n: number;
  pctSettled: number;
  medianYears: number | null;
  reversalRate: number;
}
interface FrontierPoint {
  year: number;
  cumulativeSettled: number;
}
interface Data {
  totalTrajectories: number;
  medianVelocityYears: number | null;
  meanVelocityYears: number | null;
  kmMedianYears: number | null;
  eventualSettleFraction: number;
  reversalRate: number;
  survivalCurve: SurvivalPoint[];
  decadeStats: DecadeStat[];
  cumulativeFrontier: FrontierPoint[];
}

function eraColor(start: number): string {
  if (start < 1700) return "#7b3294";
  if (start < 1800) return "#2c7fb8";
  if (start < 1900) return "#1b9e77";
  if (start < 2000) return "#d95f02";
  return "#e7298a";
}

function Skeleton({ h = 300 }: { h?: number }) {
  return (
    <div
      style={{
        height: h,
        background: C.panelEdge,
        borderRadius: 6,
        animation: "pulse 1.5s ease-in-out infinite",
      }}
    />
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelEdge}`,
        borderRadius: 8,
        padding: "14px 18px",
        flex: "1 1 160px",
      }}
    >
      <div style={{ fontSize: 12, color: C.mut, textTransform: "uppercase", letterSpacing: 0.5 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color: C.brand, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Panel({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <section
      style={{
        background: C.panel,
        border: `1px solid ${C.panelEdge}`,
        borderRadius: 10,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <h2 style={{ fontSize: 16, fontWeight: 600, color: C.ink, margin: "0 0 4px" }}>{title}</h2>
      {note && <p style={{ fontSize: 12, color: C.mut, margin: "0 0 14px" }}>{note}</p>}
      {children}
    </section>
  );
}

const tooltipStyle = {
  background: C.bg,
  border: `1px solid ${C.panelEdge}`,
  borderRadius: 6,
  color: C.ink,
  fontSize: 12,
};

export default function SettlingRateCharts() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analysis/settling-rate")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  const decadeData = data
    ? data.decadeStats.filter((d) => d.decadeStart >= 1600 && d.medianYears !== null)
    : [];
  const frontierData = data
    ? data.cumulativeFrontier.filter((p) => p.year >= 1500)
    : [];
  const survivalData = data
    ? data.survivalCurve.filter((p) => p.yearsAfterEmergence > 0)
    : [];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ marginBottom: 8 }}>
          <Link href="/settling-curve" style={{ color: C.mut, fontSize: 13, textDecoration: "none" }}>
            ← Settling Curve
          </Link>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 8px" }}>
          The Macro Settling Curve
        </h1>
        <p style={{ fontSize: 15, color: C.mut, maxWidth: 760, margin: "0 0 24px", lineHeight: 1.5 }}>
          How fast does knowledge settle in aggregate? Across every epistemic trajectory in the
          corpus, we measure the time from a claim&apos;s emergence to its first settlement, how that
          velocity has changed by decade, and when the cumulative frontier of settled knowledge
          accelerated.
        </p>

        {err && (
          <div style={{ color: C.red, padding: 16, border: `1px solid ${C.red}`, borderRadius: 8 }}>
            Failed to load: {err}
          </div>
        )}

        {/* headline stats */}
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 28 }}>
          {data ? (
            <>
              <Stat
                label="Median velocity"
                value={`${data.medianVelocityYears ?? "—"} yr`}
                sub="recorded → settled"
              />
              <Stat
                label="Eventually settles"
                value={`${data.eventualSettleFraction}%`}
                sub={`KM-median ≈ ${data.kmMedianYears ?? "—"} yr`}
              />
              <Stat label="Reversal rate" value={`${data.reversalRate}%`} sub="ever reversed / abandoned" />
              <Stat
                label="Trajectories"
                value={data.totalTrajectories.toLocaleString()}
                sub="with a known emergence date"
              />
            </>
          ) : (
            <Skeleton h={90} />
          )}
        </div>

        {/* Panel A — survival curve */}
        <Panel
          title="A · Knowledge survival curve"
          note="Kaplan-Meier-style: share of claims not yet settled, as a function of years since emergence (log scale). The curve flattens at the fraction that never settles."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={survivalData} margin={{ top: 10, right: 24, bottom: 28, left: 4 }}>
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="yearsAfterEmergence"
                  scale="log"
                  domain={[0.25, 500]}
                  type="number"
                  ticks={[0.25, 1, 2, 5, 10, 25, 50, 100, 250, 500]}
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  label={{
                    value: "Years since emergence (log)",
                    position: "insideBottom",
                    offset: -14,
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  unit="%"
                  label={{
                    value: "% unsettled",
                    angle: -90,
                    position: "insideLeft",
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${v}% unsettled`, ""]}
                  labelFormatter={(l) => `${l} yr after emergence`}
                />
                <Area
                  type="monotone"
                  dataKey="pctUnsettled"
                  stroke={C.blue}
                  fill={C.blue}
                  fillOpacity={0.14}
                  strokeWidth={2.4}
                  dot={false}
                />
                {data.medianVelocityYears && (
                  <ReferenceLine
                    x={data.medianVelocityYears}
                    stroke={C.green}
                    strokeWidth={1.6}
                    label={{
                      value: `median ${data.medianVelocityYears}yr`,
                      fill: C.green,
                      fontSize: 11,
                      position: "top",
                    }}
                  />
                )}
                {data.meanVelocityYears && (
                  <ReferenceLine
                    x={data.meanVelocityYears}
                    stroke={C.red}
                    strokeDasharray="5 4"
                    strokeWidth={1.4}
                    label={{
                      value: `mean ${Math.round(data.meanVelocityYears)}yr`,
                      fill: C.red,
                      fontSize: 11,
                      position: "top",
                    }}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        {/* Panel B — decade velocity */}
        <Panel
          title="B · Settlement velocity by decade"
          note="Median years-to-settle for claims that emerged in each decade (log scale). Modern claims settle in months; pre-modern claims often took decades or centuries."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={340}>
              <BarChart data={decadeData} margin={{ top: 10, right: 24, bottom: 44, left: 4 }}>
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="decade"
                  tick={{ fill: C.mut, fontSize: 9 }}
                  stroke={C.faint}
                  angle={-55}
                  textAnchor="end"
                  interval={0}
                  height={50}
                />
                <YAxis
                  scale="log"
                  domain={[0.01, "auto"]}
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  label={{
                    value: "Median yrs (log)",
                    angle: -90,
                    position: "insideLeft",
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v, _n, p) => {
                    const d = (p as { payload?: DecadeStat })?.payload;
                    return [`${v} yr · ${d?.pctSettled}% settled · n=${d?.n}`, "median"];
                  }}
                  labelFormatter={(l) => `${l}`}
                />
                <Bar dataKey="medianYears" radius={[2, 2, 0, 0]}>
                  {decadeData.map((d) => (
                    <Cell key={d.decade} fill={eraColor(d.decadeStart)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        {/* Panel C — cumulative frontier */}
        <Panel
          title="C · Cumulative settling frontier"
          note="Number of claims that had settled by each calendar year. The steepening slope after 1900 shows knowledge settling faster than ever before."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={frontierData} margin={{ top: 10, right: 24, bottom: 28, left: 4 }}>
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="year"
                  type="number"
                  domain={[1500, 2025]}
                  ticks={[1500, 1600, 1700, 1800, 1900, 2000]}
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  label={{
                    value: "Calendar year",
                    position: "insideBottom",
                    offset: -14,
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  label={{
                    value: "Claims settled",
                    angle: -90,
                    position: "insideLeft",
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${Number(v).toLocaleString()} settled`, ""]}
                  labelFormatter={(l) => `by ${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="cumulativeSettled"
                  stroke={C.deep}
                  fill={C.deep}
                  fillOpacity={0.2}
                  strokeWidth={2.4}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        <p style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          Velocity is the time from a claim&apos;s recorded emergence to its first
          RECORDED→SETTLED transition; the distribution is heavily right-skewed (ancient claims whose
          settlement markers postdate emergence by centuries inflate the mean), so the median is the
          headline figure. The survival curve uses each claim&apos;s first SETTLED transition.
        </p>
      </div>
    </div>
  );
}
