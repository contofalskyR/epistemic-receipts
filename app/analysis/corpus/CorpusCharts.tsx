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
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";

// design tokens — match settling-rate / settling-curve overview
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

// per-axis palette
const AXIS_COLOR: Record<string, string> = {
  RECORDED: "#3690c0",
  SETTLED: "#1a9850",
  CONTESTED: "#d73027",
  REVERSED: "#7b3294",
  OPEN: "#f0a000",
};
function axisColor(axis: string): string {
  return AXIS_COLOR[axis] ?? C.mut;
}

interface StatusPoint {
  axis: string;
  count: number;
  pct: number;
}
interface CommunityPoint {
  community: string;
  count: number;
  pct: number;
}
interface Transition {
  from: string;
  to: string;
  count: number;
}
interface YearPoint {
  year: number;
  count: number;
}
interface PipelinePoint {
  pipeline: string;
  count: number;
}
interface Data {
  totalHistoryRows: number;
  totalUniqueClaims: number;
  multiStepClaims: number;
  statusDistribution: StatusPoint[];
  communityDistribution: CommunityPoint[];
  topTransitions: Transition[];
  yearlyEmergence: YearPoint[];
  topPipelines: PipelinePoint[];
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

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

export default function CorpusCharts() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/analysis/corpus")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setErr(String(e)));
  }, []);

  const yearData = data ? data.yearlyEmergence.filter((p) => p.year >= 1800) : [];
  const pipelineData = data
    ? data.topPipelines.slice(0, 10).map((p) => ({
        ...p,
        label: truncate(p.pipeline, 32),
      }))
    : [];

  return (
    <div style={{ background: C.bg, minHeight: "100vh", color: C.ink }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 20px 80px" }}>
        <div style={{ marginBottom: 8 }}>
          <Link
            href="/settling-curve"
            style={{ color: C.mut, fontSize: 13, textDecoration: "none" }}
          >
            ← Settling Curve
          </Link>
        </div>
        <h1 style={{ fontSize: 30, fontWeight: 700, margin: "0 0 8px" }}>The Full Corpus</h1>
        <p
          style={{
            fontSize: 15,
            color: C.mut,
            maxWidth: 760,
            margin: "0 0 24px",
            lineHeight: 1.5,
          }}
        >
          A structural view of every epistemic baseline in the record — not the curated
          trajectories, but all{" "}
          {data ? data.totalHistoryRows.toLocaleString() : "1.6M"} ClaimStatusHistory rows. Where
          does knowledge enter the record, which communities ratify it, when did it emerge, and
          which pipelines produced it.
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
                label="Claims with baseline"
                value={data.totalUniqueClaims.toLocaleString()}
                sub="unique claims in the record"
              />
              <Stat
                label="Multi-step trajectories"
                value={data.multiStepClaims.toLocaleString()}
                sub="with >1 history step"
              />
              <Stat
                label="Total history rows"
                value={data.totalHistoryRows.toLocaleString()}
                sub="Layer-1 baseline + transitions"
              />
            </>
          ) : (
            <Skeleton h={90} />
          )}
        </div>

        {/* Panel A — initial status distribution */}
        <Panel
          title="A · Initial status distribution"
          note="The first recorded status for each claim (entry points, fromAxis = null). Where knowledge lands when it first enters the record."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={Math.max(180, data.statusDistribution.length * 48)}>
              <BarChart
                layout="vertical"
                data={data.statusDistribution}
                margin={{ top: 6, right: 90, bottom: 6, left: 20 }}
              >
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.mut, fontSize: 11 }} stroke={C.faint} />
                <YAxis
                  type="category"
                  dataKey="axis"
                  tick={{ fill: C.ink, fontSize: 12 }}
                  stroke={C.faint}
                  width={100}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: C.panelEdge, fillOpacity: 0.3 }}
                  formatter={(v, _n, p) => {
                    const d = (p as { payload?: StatusPoint })?.payload;
                    return [`${Number(v).toLocaleString()} · ${d?.pct}%`, "claims"];
                  }}
                />
                <Bar dataKey="count" radius={[0, 3, 3, 0]}>
                  {data.statusDistribution.map((d) => (
                    <Cell key={d.axis} fill={axisColor(d.axis)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        {/* Panel B — community breakdown */}
        <Panel
          title="B · Ratifying community"
          note="Which community established each claim's baseline status — institutional bodies, expert literature, courts, or computational verification."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart
                data={data.communityDistribution}
                margin={{ top: 10, right: 24, bottom: 44, left: 4 }}
              >
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="community"
                  tick={{ fill: C.mut, fontSize: 10 }}
                  stroke={C.faint}
                  angle={-25}
                  textAnchor="end"
                  interval={0}
                  height={50}
                />
                <YAxis
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  label={{
                    value: "Claims",
                    angle: -90,
                    position: "insideLeft",
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: C.panelEdge, fillOpacity: 0.3 }}
                  formatter={(v, _n, p) => {
                    const d = (p as { payload?: CommunityPoint })?.payload;
                    return [`${Number(v).toLocaleString()} · ${d?.pct}%`, "claims"];
                  }}
                />
                <Bar dataKey="count" fill={C.blue} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        {/* Panel C — yearly emergence */}
        <Panel
          title="C · Claims entering the record by year"
          note="When each claim's baseline status was first established (occurredAt, from 1800). The modern acceleration reflects both real growth and denser digital records."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart data={yearData} margin={{ top: 10, right: 24, bottom: 28, left: 4 }}>
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="year"
                  type="number"
                  domain={["dataMin", "dataMax"]}
                  tick={{ fill: C.mut, fontSize: 11 }}
                  stroke={C.faint}
                  label={{
                    value: "Year of emergence",
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
                    value: "Claims",
                    angle: -90,
                    position: "insideLeft",
                    fill: C.mut,
                    fontSize: 12,
                  }}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v) => [`${Number(v).toLocaleString()} claims`, ""]}
                  labelFormatter={(l) => `${l}`}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke={C.brand}
                  fill={C.brand}
                  fillOpacity={0.18}
                  strokeWidth={2.4}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        {/* Panel D — top pipelines */}
        <Panel
          title="D · Top 10 pipelines"
          note="Which ingestion pipelines produced the most baseline claims (by entry-point rows)."
        >
          {data ? (
            <ResponsiveContainer width="100%" height={Math.max(220, pipelineData.length * 34)}>
              <BarChart
                layout="vertical"
                data={pipelineData}
                margin={{ top: 6, right: 80, bottom: 6, left: 20 }}
              >
                <CartesianGrid stroke={C.panelEdge} strokeDasharray="2 4" horizontal={false} />
                <XAxis type="number" tick={{ fill: C.mut, fontSize: 11 }} stroke={C.faint} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: C.ink, fontSize: 11 }}
                  stroke={C.faint}
                  width={200}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: C.panelEdge, fillOpacity: 0.3 }}
                  formatter={(v, _n, p) => {
                    const d = (p as { payload?: PipelinePoint })?.payload;
                    return [`${Number(v).toLocaleString()} claims`, d?.pipeline ?? ""];
                  }}
                />
                <Bar dataKey="count" fill={C.blue} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <Skeleton />
          )}
        </Panel>

        {/* Transition matrix */}
        {data && data.topTransitions.length > 0 && (
          <Panel
            title="E · Top status transitions"
            note="Actual status changes (fromAxis is set) — how claims move between epistemic states once already in the record."
          >
            <div style={{ overflowX: "auto" }}>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ textAlign: "left", color: C.mut }}>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${C.panelEdge}` }}>
                      From
                    </th>
                    <th style={{ padding: "8px 12px", borderBottom: `1px solid ${C.panelEdge}` }}>
                      To
                    </th>
                    <th
                      style={{
                        padding: "8px 12px",
                        borderBottom: `1px solid ${C.panelEdge}`,
                        textAlign: "right",
                      }}
                    >
                      Count
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topTransitions.map((t) => (
                    <tr key={`${t.from}→${t.to}`}>
                      <td
                        style={{
                          padding: "7px 12px",
                          borderBottom: `1px solid ${C.panelEdge}`,
                          color: axisColor(t.from),
                          fontWeight: 600,
                        }}
                      >
                        {t.from}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          borderBottom: `1px solid ${C.panelEdge}`,
                          color: axisColor(t.to),
                          fontWeight: 600,
                        }}
                      >
                        {t.to}
                      </td>
                      <td
                        style={{
                          padding: "7px 12px",
                          borderBottom: `1px solid ${C.panelEdge}`,
                          textAlign: "right",
                          color: C.ink,
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {t.count.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <p style={{ fontSize: 12, color: C.faint, marginTop: 8, lineHeight: 1.5 }}>
          Distributions and pipeline counts use entry-point rows (fromAxis is null): the first
          recorded status for each claim. The transition table uses rows where fromAxis is set,
          i.e. genuine status changes. All figures are computed over the full ClaimStatusHistory
          corpus, not the curated settling-curve trajectories.
        </p>
      </div>
    </div>
  );
}
