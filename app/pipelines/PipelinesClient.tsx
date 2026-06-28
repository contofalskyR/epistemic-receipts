"use client";

import Link from "next/link";
import { useState } from "react";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

const STATUS_META = {
  "in-production":     { label: "In production",       dot: "#22c55e", text: "#86efac", border: "rgba(34,197,94,0.3)",  bg: "rgba(34,197,94,0.1)" },
  "dry-run-complete":  { label: "Dry-run complete",     dot: "#facc15", text: "#fef08a", border: "rgba(250,204,21,0.3)", bg: "rgba(250,204,21,0.1)" },
  "awaiting-approval": { label: "Awaiting approval",   dot: "#fb923c", text: "#fdba74", border: "rgba(251,146,60,0.3)", bg: "rgba(251,146,60,0.1)" },
  "dry-run-pending":   { label: "Dry-run pending",      dot: "#64748b", text: "#94a3b8", border: "rgba(100,116,139,0.3)",bg: "rgba(100,116,139,0.1)" },
  "retired":           { label: "Retired",              dot: "#ef4444", text: "#fca5a5", border: "rgba(239,68,68,0.3)",  bg: "rgba(239,68,68,0.1)" },
} as const;
type PipelineStatus = keyof typeof STATUS_META;

export interface PipelineRow {
  tag: string;
  description: string;
  status: PipelineStatus;
  notes?: string;
  claims: number;
  sources: number;
}

export interface UnregisteredRow {
  tag: string;
  claims: number;
  sources: number;
}

export interface PipelinesStats {
  pipelineClaimTotal: number;
  pipelineSourceTotal: number;
  registeredCount: number;
  manualClaims: number;
  manualSources: number;
}

function StatusBadge({ status }: { status: PipelineStatus }) {
  const m = STATUS_META[status];
  return (
    <span style={{
      fontSize: "0.68rem", fontWeight: 600, padding: "0.2rem 0.55rem", borderRadius: 9999,
      background: m.bg, border: `1px solid ${m.border}`, color: m.text,
    }}>
      {m.label}
    </span>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.25rem 0.75rem", borderRadius: 9999, fontSize: "0.75rem", fontWeight: 500,
        border: `1px solid ${active ? C.brand : hov ? `${C.brand}55` : C.panelEdge}`,
        background: active ? `${C.brand}22` : "transparent",
        color: active ? C.brand : hov ? `${C.brand}99` : C.mut,
        cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

function PipelineCard({ row }: { row: PipelineRow }) {
  const [open, setOpen] = useState(false);
  const [hov, setHov] = useState(false);
  const sm = STATUS_META[row.status];

  return (
    <div
      style={{
        borderRadius: 10,
        border: `1px solid ${open ? sm.border : hov ? `${sm.dot}44` : C.panelEdge}`,
        background: C.panel, overflow: "hidden", transition: "border-color 0.15s",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{ width: "100%", textAlign: "left", background: "none", border: "none", cursor: "pointer", padding: "0.85rem 1rem" }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.75rem", marginBottom: "0.4rem" }}>
          <span style={{ fontFamily: "monospace", fontSize: "0.78rem", color: C.mut, fontWeight: 500 }}>
            {row.tag}
          </span>
          <StatusBadge status={row.status} />
        </div>
        <div style={{ color: C.ink, fontSize: "0.83rem", lineHeight: 1.4, marginBottom: "0.5rem", textAlign: "left" }}>
          {row.description}
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", gap: "1rem" }}>
            <span style={{ fontSize: "0.72rem", color: C.faint }}>
              <span style={{ color: C.ink, fontWeight: 600, fontFamily: "monospace" }}>
                {row.claims > 0 ? row.claims.toLocaleString() : "—"}
              </span>{" "}claims
            </span>
            <span style={{ fontSize: "0.72rem", color: C.faint }}>
              <span style={{ color: C.ink, fontWeight: 600, fontFamily: "monospace" }}>
                {row.sources > 0 ? row.sources.toLocaleString() : "—"}
              </span>{" "}sources
            </span>
          </div>
          <span style={{ color: open ? sm.text : C.faint, fontSize: "0.72rem", transition: "color 0.15s" }}>
            {open ? "▲ details" : "▼ details"}
          </span>
        </div>
      </button>

      {open && (
        <div style={{
          borderTop: `1px solid ${C.panelEdge}`, background: "#0d0d1a",
          padding: "0.9rem 1rem", display: "flex", flexDirection: "column", gap: "0.75rem",
        }}>
          {row.notes && (
            <div>
              <div style={{ fontSize: "0.67rem", fontWeight: 700, color: sm.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
                Notes
              </div>
              <p style={{ color: C.mut, fontSize: "0.8rem", lineHeight: 1.5, margin: 0 }}>{row.notes}</p>
            </div>
          )}
          <div>
            <div style={{ fontSize: "0.67rem", fontWeight: 700, color: sm.text, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.3rem" }}>
              Ingester tag
            </div>
            <code style={{ fontSize: "0.78rem", color: C.mut, background: C.panelEdge, borderRadius: 4, padding: "0.1rem 0.4rem" }}>
              {row.tag}
            </code>
          </div>
          {row.claims > 0 && (
            <Link
              href={`/search?q=${encodeURIComponent(row.description.split(",")[0].split("—")[0].trim().split(" ").slice(0, 4).join(" "))}`}
              style={{
                display: "inline-flex", alignItems: "center", gap: "0.4rem",
                fontSize: "0.78rem", fontWeight: 600, color: sm.text,
                textDecoration: "none", border: `1px solid ${sm.border}`,
                background: sm.bg, borderRadius: 8, padding: "0.35rem 0.75rem",
                alignSelf: "flex-start",
              }}
            >
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5" cy="5" r="3.5"/><path d="m8.5 8.5 2 2"/>
              </svg>
              Browse {row.claims.toLocaleString()} claims →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_FILTER_OPTIONS: Array<{ label: string; value: string }> = [
  { label: "All", value: "all" },
  { label: "In production", value: "in-production" },
  { label: "Dry-run pending", value: "dry-run-pending" },
  { label: "Dry-run complete", value: "dry-run-complete" },
  { label: "Awaiting approval", value: "awaiting-approval" },
  { label: "Retired", value: "retired" },
];

export default function PipelinesClient({
  pipelines,
  stats,
  unregistered,
}: {
  pipelines: PipelineRow[];
  stats: PipelinesStats;
  unregistered: UnregisteredRow[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const q = query.trim().toLowerCase();

  const filtered = pipelines.filter((p) => {
    const matchStatus = statusFilter === "all" || p.status === statusFilter;
    const matchQuery = !q || p.tag.includes(q) || p.description.toLowerCase().includes(q);
    return matchStatus && matchQuery;
  });

  const inProd = pipelines.filter((p) => p.status === "in-production").length;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem" }}>
      {/* Sub-nav */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40,
        background: "rgba(10,10,10,0.85)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "0 1.5rem", display: "flex", alignItems: "center", gap: "0.5rem", height: "2.75rem",
      }}>
        <Link href="/" style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ fontSize: "1rem" }}>⬡</span> Epistemic Receipts
        </Link>
        <span style={{ color: C.panelEdge }}>/</span>
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Pipelines</span>
      </div>

      {/* Hero */}
      <div style={{
        background: "linear-gradient(160deg, #0f0f1e 0%, #0a0a0a 60%)",
        borderBottom: `1px solid ${C.panelEdge}`,
        padding: "3.5rem 1.5rem 3rem",
      }}>
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10,
              background: "rgba(212,168,83,0.12)", border: "1px solid rgba(212,168,83,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0,
            }}>
              🔧
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                Data Infrastructure
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Pipelines
              </h1>
            </div>
          </div>
          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "52rem", margin: "0 0 1.75rem" }}>
            Every ingestion pipeline that feeds the claim graph — its operational status, record counts, and technical notes. Click any pipeline to see its details and browse its claims.
          </p>
          <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
            {[
              { label: "Pipeline claims", value: stats.pipelineClaimTotal.toLocaleString(), color: C.brand },
              { label: "Registered pipelines", value: stats.registeredCount.toString(), color: "#93c5fd" },
              { label: "In production", value: inProd.toString(), color: "#86efac" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1, fontFamily: "monospace" }}>{s.value}</div>
                <div style={{ fontSize: "0.72rem", color: C.faint, marginTop: "0.2rem" }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "1.25rem 1.5rem 0" }}>
        <div style={{ position: "relative", marginBottom: "1rem" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search pipelines by tag or description…"
            style={{
              background: C.panel, border: `1px solid ${C.panelEdge}`,
              color: C.ink, borderRadius: 10, padding: "0.55rem 1rem 0.55rem 2.25rem",
              width: "100%", fontSize: "0.88rem", outline: "none", boxSizing: "border-box",
            }}
          />
          <span style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: C.faint }}>⌕</span>
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{ position: "absolute", right: "0.75rem", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: C.faint, cursor: "pointer" }}
            >✕</button>
          )}
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {STATUS_FILTER_OPTIONS.map((o) => (
            <Chip key={o.value} active={statusFilter === o.value} onClick={() => setStatusFilter(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
        <div style={{ padding: "0.6rem 0.1rem", fontSize: "0.75rem", color: C.faint }}>
          {filtered.length} pipeline{filtered.length !== 1 ? "s" : ""}
          {q ? ` matching "${query}"` : ""}
          {statusFilter !== "all" ? ` · ${STATUS_META[statusFilter as PipelineStatus]?.label}` : ""}
        </div>
      </div>

      {/* Cards */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "0 1.5rem" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "0.6rem", marginBottom: "2.5rem" }}>
          {filtered.map((p) => <PipelineCard key={p.tag} row={p} />)}
          {filtered.length === 0 && (
            <div style={{ gridColumn: "1/-1", padding: "3rem", textAlign: "center", color: C.mut, fontSize: "0.88rem" }}>
              No pipelines match.
            </div>
          )}
        </div>

        {/* Manual curated */}
        {stats.manualClaims > 0 && (
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ borderBottom: `1px solid ${C.panelEdge}`, paddingBottom: "0.6rem", marginBottom: "1rem" }}>
              <h2 style={{ color: C.mut, fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>Manually Curated</h2>
            </div>
            <div style={{ display: "flex", gap: "2rem", background: C.panel, border: `1px solid ${C.panelEdge}`, borderRadius: 10, padding: "1rem 1.25rem", marginBottom: "0.5rem" }}>
              <div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, fontFamily: "monospace" }}>{stats.manualClaims.toLocaleString()}</div>
                <div style={{ fontSize: "0.72rem", color: C.faint }}>claims</div>
              </div>
              <div>
                <div style={{ fontSize: "1.2rem", fontWeight: 700, color: C.ink, fontFamily: "monospace" }}>{stats.manualSources.toLocaleString()}</div>
                <div style={{ fontSize: "0.72rem", color: C.faint }}>sources</div>
              </div>
            </div>
            <p style={{ fontSize: "0.78rem", color: C.faint, fontStyle: "italic" }}>Records entered via the admin interface — not attributed to any automated pipeline.</p>
          </div>
        )}

        {/* Unregistered tags */}
        {unregistered.length > 0 && (
          <div style={{ paddingBottom: "4rem" }}>
            <div style={{ borderBottom: `1px solid ${C.panelEdge}`, paddingBottom: "0.6rem", marginBottom: "1rem" }}>
              <h2 style={{ color: C.mut, fontSize: "0.88rem", fontWeight: 700, margin: 0 }}>Unregistered Tags</h2>
            </div>
            <p style={{ fontSize: "0.78rem", color: C.faint, fontStyle: "italic", marginBottom: "0.75rem" }}>
              These ingester tags exist in the claim graph but are not yet in the pipeline registry.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
              {unregistered.map((u) => (
                <span key={u.tag} style={{
                  fontSize: "0.72rem", fontFamily: "monospace", color: C.faint,
                  background: C.panel, border: `1px solid ${C.panelEdge}`,
                  borderRadius: 6, padding: "0.2rem 0.5rem",
                }}>
                  {u.tag} ({u.claims.toLocaleString()})
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
