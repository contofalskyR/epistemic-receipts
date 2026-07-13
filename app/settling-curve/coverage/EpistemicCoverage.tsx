"use client";
import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import SettlingCurveNav from "../SettlingCurveNav";
import { AXIS_COLOR } from "@/lib/status";

const C = {
  bg: "#08080f",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#f0a000",
  settled: "#22c55e",
  recorded: "#94a3b8",
  reversed: "#ef4444",
  contested: "#f59e0b",
  abandoned: "#6b7280",
};


const COMMUNITY_LABEL: Record<string, string> = {
  INSTITUTIONAL: "Institutional",
  EXPERT_LITERATURE: "Expert Literature",
  JUDICIAL: "Judicial",
  PUBLIC: "Public",
  MARKET: "Market",
};

const PIPELINE_LABEL: Record<string, string> = {
  openalex_v1: "OpenAlex (research papers)",
  nara_catalog_v1: "US National Archives",
  voteview_v1: "Congressional Roll-Call Votes",
  openfda_labels_v1: "FDA Drug Labels",
  hungary_legislation_v1: "Hungarian Legislation",
  chebi_v1: "ChEBI Chemical Entities",
  worldbank_v1: "World Bank Economic Data",
  drugsatfda_v1: "FDA Drug Approvals",
  jacar_v1: "Japan Asian Historical Records",
  who_gho_v1: "WHO Global Health Observatory",
  crossref_retractions_v1: "Crossref Retractions",
  congress_v1: "US Congress Bills (Enacted)",
  vdem_v1: "V-Dem Democracy Dataset",
  courtlistener_scotus_v1: "SCOTUS Opinions",
  courtlistener_circuits_v1: "Federal Circuit Court Opinions",
};

function fmt(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return n.toString();
}

function fmtFull(n: number) {
  return n.toLocaleString();
}

interface CoverageData {
  total: number;
  byAxis: { axis: string; count: number }[];
  byCommunity: { community: string; count: number }[];
  byDecade: { decade: number; count: number }[];
  topPipelines: { pipeline: string; count: number }[];
}

function StatCard({
  label,
  value,
  color,
  pct,
}: {
  label: string;
  value: number;
  color: string;
  pct: number;
}) {
  return (
    <div
      style={{
        background: C.panel,
        border: `1px solid ${C.panelEdge}`,
        borderRadius: 8,
        padding: "16px 20px",
        flex: 1,
        minWidth: 140,
      }}
    >
      <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 700, color, lineHeight: 1 }}>
        {fmt(value)}
      </div>
      <div style={{ fontSize: 12, color: C.faint, marginTop: 4 }}>
        {pct.toFixed(1)}% of covered
      </div>
    </div>
  );
}

export default function EpistemicCoverage() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    fetch("/api/epistemic-coverage")
      .then((r) => r.json())
      .then(setData)
      .catch(() => setErr(true));
  }, []);

  const maxCommunity = data ? Math.max(...data.byCommunity.map((b) => b.count)) : 1;
  const maxPipeline = data ? Math.max(...data.topPipelines.map((p) => p.count)) : 1;

  return (
    <div style={{ background: C.bg, color: C.ink, marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem", minHeight: "100vh" }}>
      <SettlingCurveNav active="coverage" />

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px 64px" }}>
        {/* Hero */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 13, color: C.brand, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
            Epistemic Coverage
          </div>
          {data ? (
            <>
              <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, marginBottom: 8 }}>
                {fmtFull(data.total)}
              </div>
              <div style={{ fontSize: 16, color: C.mut }}>
                claims now have a typed epistemic entry point — status, ratifying community, and date.
              </div>
            </>
          ) : err ? (
            <div style={{ color: C.reversed }}>Failed to load coverage data.</div>
          ) : (
            <div style={{ fontSize: 32, color: C.faint }}>Loading…</div>
          )}
        </div>

        {data && (
          <>
            {/* Axis breakdown cards */}
            <section style={{ marginBottom: 40 }}>
              <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
                By Epistemic Status
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {data.byAxis.map((a) => (
                  <StatCard
                    key={a.axis}
                    label={a.axis}
                    value={a.count}
                    color={AXIS_COLOR[a.axis] ?? C.ink}
                    pct={(a.count / data.total) * 100}
                  />
                ))}
              </div>
            </section>

            {/* Community breakdown */}
            <section
              style={{
                background: C.panel,
                border: `1px solid ${C.panelEdge}`,
                borderRadius: 8,
                padding: "20px 24px",
                marginBottom: 40,
              }}
            >
              <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                By Ratifying Community
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {data.byCommunity.map((c) => (
                  <div key={c.community}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: C.ink }}>
                        {COMMUNITY_LABEL[c.community] ?? c.community}
                      </span>
                      <span style={{ color: C.mut }}>{fmtFull(c.count)}</span>
                    </div>
                    <div style={{ height: 6, background: C.panelEdge, borderRadius: 3, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(c.count / maxCommunity) * 100}%`,
                          background: C.brand,
                          borderRadius: 3,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Timeline chart */}
            <section
              style={{
                background: C.panel,
                border: `1px solid ${C.panelEdge}`,
                borderRadius: 8,
                padding: "20px 24px",
                marginBottom: 40,
              }}
            >
              <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
                Entry Points by Decade
              </div>
              <div style={{ fontSize: 12, color: C.faint, marginBottom: 16 }}>
                When did each claim first enter the epistemic record?
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byDecade} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.panelEdge} vertical={false} />
                  <XAxis
                    dataKey="decade"
                    tick={{ fill: C.faint, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `${v}s`}
                  />
                  <YAxis
                    tick={{ fill: C.faint, fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => fmt(v)}
                    width={40}
                  />
                  <Tooltip
                    contentStyle={{ background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: C.ink }}
                    formatter={(v) => [fmtFull(Number(v)), "Claims"]}
                    labelFormatter={(l) => `${l}s`}
                  />
                  <Bar dataKey="count" fill={C.brand} radius={[3, 3, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </section>

            {/* Top pipelines */}
            <section
              style={{
                background: C.panel,
                border: `1px solid ${C.panelEdge}`,
                borderRadius: 8,
                padding: "20px 24px",
              }}
            >
              <div style={{ fontSize: 11, color: C.mut, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 16 }}>
                Top Sources by Coverage
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {data.topPipelines.map((p, i) => (
                  <div key={p.pipeline}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                      <span style={{ color: i < 3 ? C.ink : C.mut }}>
                        <span style={{ color: C.faint, marginRight: 8, fontSize: 11, fontVariantNumeric: "tabular-nums" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        {PIPELINE_LABEL[p.pipeline] ?? p.pipeline}
                      </span>
                      <span style={{ color: C.mut, fontVariantNumeric: "tabular-nums" }}>{fmtFull(p.count)}</span>
                    </div>
                    <div style={{ height: 4, background: C.panelEdge, borderRadius: 2, overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${(p.count / maxPipeline) * 100}%`,
                          background: i < 3 ? C.brand : C.faint,
                          borderRadius: 2,
                          transition: "width 0.6s ease",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
