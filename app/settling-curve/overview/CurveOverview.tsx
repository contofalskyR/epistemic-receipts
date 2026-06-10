"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

// ---------------------------------------------------------------------------
// Design tokens — match SettlingCurve.tsx
// ---------------------------------------------------------------------------
const C = {
  bg: "#08080f",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#f0a000",
  reversed: "#f43f5e",
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface HistogramBucket {
  bucket: string;
  count: number;
}

interface TrendPoint {
  year: number;
  median_days: number;
  n: number;
}

interface CuratedLagItem {
  trajectory_id: string;
  title: string;
  expert_year: number;
  institutional_year: number | null;
  lag_years: number | null;
}

interface CurveStatsResponse {
  retraction_survival: {
    n: number;
    indeterminate_n: number;
    median_days: number;
    p25_days: number;
    p75_days: number;
    min_days: number;
    max_days: number;
    histogram: HistogramBucket[];
  };
  detection_trend: TrendPoint[];
  field_breakdown: {
    available: boolean;
    caveat: string;
    data?: Array<{ field: string; median_days: number; n: number }>;
  };
  curated_lag: CuratedLagItem[];
  curated_lag_n: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function fmt(days: number): string {
  if (days < 365) return `${days}d`;
  return `${(days / 365).toFixed(1)}yr`;
}

// Determine the median bucket label for the ReferenceLine
function medianBucketIndex(
  histogram: HistogramBucket[],
  medianDays: number
): number {
  const ORDER = ["0-1yr", "1-2yr", "2-3yr", "3-5yr", "5-10yr", "10+yr"];
  const bucketBounds = [365, 730, 1095, 1825, 3650, Infinity];
  const idx = bucketBounds.findIndex((bound) => medianDays <= bound);
  const bucket = ORDER[idx] ?? ORDER[ORDER.length - 1];
  return histogram.findIndex((h) => h.bucket === bucket);
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------
function Skeleton({ h = 200 }: { h?: number }) {
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

// ---------------------------------------------------------------------------
// Nav tab bar (shared between pages via this component)
// ---------------------------------------------------------------------------
function TabBar({ active }: { active: "individual" | "overview" }) {
  const tabStyle = (isActive: boolean): React.CSSProperties => ({
    padding: "6px 16px",
    borderRadius: 4,
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    background: isActive ? C.brand : "transparent",
    color: isActive ? C.bg : C.mut,
    border: isActive ? "none" : `1px solid ${C.panelEdge}`,
    cursor: "pointer",
    transition: "background 0.15s",
  });

  return (
    <div
      style={{
        display: "flex",
        gap: 8,
        marginBottom: 32,
        alignItems: "center",
      }}
    >
      <Link href="/settling-curve" style={tabStyle(active === "individual")}>
        Individual Trajectories
      </Link>
      <Link
        href="/settling-curve/overview"
        style={tabStyle(active === "overview")}
      >
        Distribution Overview
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for histogram
// ---------------------------------------------------------------------------
function HistoTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: HistogramBucket }>;
}) {
  if (!active || !payload?.length) return null;
  const { bucket, count } = payload[0].payload;
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelEdge}`,
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 13,
        color: C.ink,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{bucket}</div>
      <div style={{ color: C.mut }}>{count.toLocaleString()} retractions</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom tooltip for trend line
// ---------------------------------------------------------------------------
function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; payload: TrendPoint }>;
  label?: number;
}) {
  if (!active || !payload?.length) return null;
  const pt = payload[0].payload;
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelEdge}`,
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 13,
        color: C.ink,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 2 }}>{label}</div>
      <div>
        Median:{" "}
        <span style={{ color: C.brand }}>{fmt(payload[0].value)}</span>
      </div>
      <div style={{ color: C.mut }}>n = {pt.n}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function CurveOverview() {
  const [data, setData] = useState<CurveStatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/curve-stats")
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message));
  }, []);

  const panelStyle: React.CSSProperties = {
    background: C.panel,
    border: `1px solid ${C.panelEdge}`,
    borderRadius: 8,
    padding: "24px 28px",
    marginBottom: 24,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: C.mut,
    marginBottom: 6,
  };

  const headlineStyle: React.CSSProperties = {
    fontSize: 22,
    fontWeight: 700,
    color: C.ink,
    lineHeight: 1.3,
    marginBottom: 8,
  };

  const caveatStyle: React.CSSProperties = {
    fontSize: 12,
    color: C.faint,
    marginTop: 10,
    lineHeight: 1.6,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: C.bg,
        color: C.ink,
        fontFamily:
          "'Inter', 'Geist', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "40px 24px",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      {/* Page header */}
      <div style={{ marginBottom: 16 }}>
        <Link
          href="/"
          style={{ fontSize: 13, color: C.mut, textDecoration: "none" }}
        >
          ← Epistemic Receipts
        </Link>
      </div>

      <h1
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: C.ink,
          marginBottom: 6,
        }}
      >
        Retraction Distribution
      </h1>
      <p style={{ color: C.mut, fontSize: 15, marginBottom: 32 }}>
        How long do retracted findings stand in the literature?
      </p>

      <TabBar active="overview" />

      {/* Error state */}
      {error && (
        <div
          style={{
            ...panelStyle,
            borderColor: C.reversed,
            color: C.reversed,
          }}
        >
          Failed to load data: {error}
        </div>
      )}

      {/* ---- Hero histogram panel ---------------------------------------- */}
      <div style={panelStyle}>
        <div style={labelStyle}>Survival time distribution</div>

        {!data ? (
          <Skeleton h={260} />
        ) : (
          <>
            {(() => {
              const s = data.retraction_survival;
              const medianYears = Math.round(s.median_days / 365);
              const medianLabel =
                medianYears < 1 ? "less than 1 year" : `${medianYears} year${medianYears > 1 ? "s" : ""}`;
              const medianBucket =
                s.histogram[medianBucketIndex(s.histogram, s.median_days)]
                  ?.bucket ?? null;

              return (
                <>
                  <h2 style={headlineStyle}>
                    Half of retracted findings stood in the literature for more
                    than{" "}
                    <span style={{ color: C.brand }}>{medianLabel}</span>.
                  </h2>

                  <div
                    style={{
                      display: "flex",
                      gap: 32,
                      marginBottom: 20,
                      flexWrap: "wrap",
                    }}
                  >
                    {[
                      {
                        label: "Median",
                        value: fmt(s.median_days),
                        highlight: true,
                      },
                      { label: "25th pct", value: fmt(s.p25_days) },
                      { label: "75th pct", value: fmt(s.p75_days) },
                      {
                        label: "Valid pairs",
                        value: s.n.toLocaleString(),
                      },
                    ].map(({ label, value, highlight }) => (
                      <div key={label}>
                        <div style={{ ...labelStyle, marginBottom: 2 }}>
                          {label}
                        </div>
                        <div
                          style={{
                            fontSize: 20,
                            fontWeight: 700,
                            color: highlight ? C.brand : C.ink,
                          }}
                        >
                          {value}
                        </div>
                      </div>
                    ))}
                  </div>

                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart
                      data={s.histogram}
                      margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                    >
                      <XAxis
                        dataKey="bucket"
                        tick={{ fill: C.mut, fontSize: 12 }}
                        axisLine={{ stroke: C.faint }}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fill: C.mut, fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={(v: number) =>
                          v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
                        }
                      />
                      <Tooltip
                        content={<HistoTooltip />}
                        cursor={{ fill: C.panelEdge }}
                      />
                      <Bar dataKey="count" fill={C.brand} radius={[3, 3, 0, 0]} />
                      {medianBucket && (
                        <ReferenceLine
                          x={medianBucket}
                          stroke={C.reversed}
                          strokeDasharray="4 3"
                          label={{
                            value: `median`,
                            fill: C.reversed,
                            fontSize: 11,
                            position: "insideTopRight",
                          }}
                        />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </>
              );
            })()}
          </>
        )}

        {data && (
          <p style={caveatStyle}>
            n = {data.retraction_survival.n.toLocaleString()} valid pairs.{" "}
            {data.retraction_survival.indeterminate_n} retractions excluded —
            publication and retraction dates too imprecise to order.{" "}
            <a
              href="/api/curve-stats?format=csv"
              download
              style={{ color: C.brand, textDecoration: "none" }}
            >
              Download dataset (CSV)
            </a>
          </p>
        )}
      </div>

      {/* ---- Detection trend panel --------------------------------------- */}
      <div style={panelStyle}>
        <div style={labelStyle}>Median survival by retraction year</div>

        {!data ? (
          <Skeleton h={220} />
        ) : (
          <>
            <p
              style={{
                fontSize: 14,
                color: C.mut,
                marginBottom: 16,
                lineHeight: 1.6,
              }}
            >
              Median time-to-retraction by the year in which the retraction was
              recorded. Note: year-over-year variation is substantial; early
              years have small n and are less reliable.
            </p>

            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={data.detection_trend}
                margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
              >
                <CartesianGrid stroke={C.panelEdge} vertical={false} />
                <XAxis
                  dataKey="year"
                  tick={{ fill: C.mut, fontSize: 11 }}
                  axisLine={{ stroke: C.faint }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: C.mut, fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${Math.round(v / 365)}yr`}
                />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="median_days"
                  stroke={C.brand}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: C.brand }}
                />
              </LineChart>
            </ResponsiveContainer>

            <p style={caveatStyle}>
              Only years with n ≥ 5 shown. High variance in early years (2003–
              2010) reflects sparse data, not a genuine trend.
            </p>
          </>
        )}
      </div>

      {/* ---- Curated lag panel ------------------------------------------ */}
      <div style={panelStyle}>
        <div style={labelStyle}>Expert → institutional lag — curated cases</div>

        {!data ? (
          <Skeleton h={200} />
        ) : (
          <>
            <p
              style={{
                fontSize: 14,
                color: C.mut,
                marginBottom: 6,
                lineHeight: 1.6,
              }}
            >
              Across{" "}
              <strong style={{ color: C.ink }}>{data.curated_lag_n}</strong>{" "}
              curated cases with both expert-literature and institutional
              transitions. This is a separate population from the 5,700+
              retraction trajectories above — do not merge these statistics.
            </p>

            {(() => {
              const withLag = data.curated_lag.filter(
                (c) => c.lag_years !== null
              );
              if (withLag.length === 0) {
                return (
                  <p style={{ color: C.faint, fontSize: 13 }}>
                    No curated trajectories have both expert and institutional
                    transitions.
                  </p>
                );
              }
              return (
                <div style={{ marginTop: 12 }}>
                  {withLag.map((item, i) => (
                    <div
                      key={item.trajectory_id}
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                        padding: "10px 0",
                        borderBottom:
                          i < withLag.length - 1
                            ? `1px solid ${C.panelEdge}`
                            : "none",
                      }}
                    >
                      <div
                        style={{
                          minWidth: 28,
                          fontSize: 11,
                          color: C.faint,
                          paddingTop: 2,
                          textAlign: "right",
                        }}
                      >
                        {i + 1}.
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            fontSize: 13,
                            color: C.ink,
                            marginBottom: 3,
                            lineHeight: 1.4,
                          }}
                        >
                          {item.title}
                          {item.title.length === 120 ? "…" : ""}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: C.mut,
                            display: "flex",
                            gap: 16,
                            flexWrap: "wrap",
                          }}
                        >
                          <span>
                            Expert literature:{" "}
                            <span style={{ color: C.ink }}>
                              {item.expert_year}
                            </span>
                          </span>
                          {item.institutional_year !== null && (
                            <span>
                              Institutional:{" "}
                              <span style={{ color: C.ink }}>
                                {item.institutional_year}
                              </span>
                            </span>
                          )}
                          {item.lag_years !== null && (
                            <span>
                              Lag:{" "}
                              <span
                                style={{
                                  color: C.brand,
                                  fontWeight: 600,
                                }}
                              >
                                {item.lag_years}yr
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <p style={caveatStyle}>
              n = {data.curated_lag_n} cases shown (those with expert +
              institutional transitions). This is a manually curated set, not a
              random sample. Lags reflect the year of first institutional
              recognition, not final resolution.
            </p>
          </>
        )}
      </div>

      {/* ---- Field breakdown panel (conditional) ------------------------ */}
      {data?.field_breakdown.available && (
        <div style={panelStyle}>
          <div style={labelStyle}>Median survival by field</div>
          <p style={caveatStyle}>{data.field_breakdown.caveat}</p>
          <div style={{ marginTop: 16 }}>
            {data.field_breakdown.data?.map((item) => (
              <div
                key={item.field}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "6px 0",
                  borderBottom: `1px solid ${C.panelEdge}`,
                  fontSize: 13,
                }}
              >
                <span style={{ color: C.ink }}>{item.field}</span>
                <span style={{ color: C.brand }}>
                  {fmt(item.median_days)}{" "}
                  <span style={{ color: C.faint, fontSize: 11 }}>
                    (n={item.n})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Global footnote -------------------------------------------- */}
      {data && (
        <p
          style={{
            fontSize: 12,
            color: C.faint,
            marginTop: 12,
            lineHeight: 1.7,
          }}
        >
          {data.retraction_survival.indeterminate_n} retractions excluded —
          publication and retraction dates too imprecise to order. All
          aggregations computed in PostgreSQL (
          <code style={{ fontSize: 11 }}>percentile_cont</code>,{" "}
          <code style={{ fontSize: 11 }}>CASE</code> buckets). No row-level
          data is loaded into application memory.{" "}
          <a
            href="/api/curve-stats?format=csv"
            download
            style={{ color: C.brand, textDecoration: "none" }}
          >
            Download full dataset (CSV)
          </a>
        </p>
      )}
    </div>
  );
}
