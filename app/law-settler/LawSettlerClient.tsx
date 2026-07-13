"use client";

import Link from "next/link";
import { useState } from "react";
import SettlingCurveMini from "../components/SettlingCurveMini";
import { AXIS_COLOR } from "@/lib/status";

const C = {
  bg: "#0a0a0a",
  panel: "#10101c",
  panelEdge: "#23233a",
  ink: "#e9e9f2",
  mut: "#8b8ba3",
  faint: "#55556e",
  brand: "#d4a853",
} as const;

const AXIS_META: Record<string, { label: string; color: string; border: string; bg: string }> = {
  SETTLED:   { label: "Settled",   color: AXIS_COLOR["SETTLED"],   border: "rgba(34,197,94,0.4)",   bg: "rgba(34,197,94,0.1)" },
  CONTESTED: { label: "Contested", color: AXIS_COLOR["CONTESTED"], border: "rgba(245,158,11,0.4)",  bg: "rgba(245,158,11,0.1)" },
  REVERSED:  { label: "Reversed",  color: AXIS_COLOR["REVERSED"],  border: "rgba(239,68,68,0.4)",   bg: "rgba(239,68,68,0.1)" },
  OPEN:      { label: "Open",      color: AXIS_COLOR["OPEN"],      border: "rgba(56,189,248,0.4)",  bg: "rgba(56,189,248,0.1)" },
  RECORDED:  { label: "Recorded",  color: AXIS_COLOR["RECORDED"],  border: "rgba(148,163,184,0.4)", bg: "rgba(148,163,184,0.1)" },
  ABANDONED: { label: "Abandoned", color: AXIS_COLOR["ABANDONED"], border: "rgba(107,114,128,0.4)", bg: "rgba(107,114,128,0.1)" },
};

const FILTERS = [
  { value: "all",       label: "All" },
  { value: "SETTLED",   label: "Settled" },
  { value: "REVERSED",  label: "Reversed" },
  { value: "CONTESTED", label: "Contested" },
] as const;

type MiniMilestone = { year: number; axis: string; community: string };

type LawTrajectory = {
  id: string;
  claimId: string;
  claim: string;
  currentAxis: string | null;
  firstYear: number | null;
  lastYear: number | null;
  milestones: MiniMilestone[];
};

function TrajectoryCard({ traj }: { traj: LawTrajectory }) {
  const [hovered, setHovered] = useState(false);
  const axis = traj.currentAxis ?? "OPEN";
  const meta = AXIS_META[axis] ?? AXIS_META.RECORDED;

  const span = traj.firstYear && traj.lastYear
    ? `${traj.firstYear} – ${traj.lastYear}`
    : traj.firstYear
    ? `${traj.firstYear} –`
    : "—";

  return (
    <Link
      href={`/settling-curve?t=${traj.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "block",
        background: C.panel,
        border: `1px solid ${hovered ? meta.color : C.panelEdge}`,
        borderRadius: 12,
        padding: "1.25rem",
        textDecoration: "none",
        transition: "border-color 0.15s",
      }}
    >
      {/* Status + year span */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 700,
            padding: "0.2rem 0.6rem",
            borderRadius: 9999,
            background: meta.bg,
            color: meta.color,
            border: `1px solid ${meta.border}`,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          {meta.label}
        </span>
        <span style={{ fontSize: "0.72rem", color: C.faint, fontFamily: "monospace" }}>
          {span}
        </span>
      </div>

      {/* Mini sparkline */}
      <div style={{ marginBottom: "0.75rem" }}>
        <SettlingCurveMini milestones={traj.milestones} animate={false} />
      </div>

      {/* Claim text */}
      <p
        style={{
          color: C.mut,
          fontSize: "0.82rem",
          lineHeight: 1.5,
          margin: 0,
          display: "-webkit-box",
          WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        {traj.claim}
      </p>

      {/* Milestone count footer */}
      <div style={{ marginTop: "0.75rem", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.72rem", color: C.faint }}>
          {traj.milestones.length} ruling{traj.milestones.length !== 1 ? "s" : ""}
        </span>
        <span style={{ fontSize: "0.72rem", color: hovered ? C.brand : C.faint, transition: "color 0.15s", fontWeight: 500 }}>
          Full trajectory →
        </span>
      </div>
    </Link>
  );
}

function Chip({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean;
  onClick: () => void;
  color?: string;
  children: React.ReactNode;
}) {
  const [hov, setHov] = useState(false);
  const activeColor = color ?? C.brand;
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "0.3rem 0.85rem",
        borderRadius: 9999,
        fontSize: "0.78rem",
        fontWeight: 500,
        border: `1px solid ${active ? activeColor : hov ? `${activeColor}66` : C.panelEdge}`,
        background: active ? `${activeColor}22` : "transparent",
        color: active ? activeColor : hov ? `${activeColor}aa` : C.mut,
        cursor: "pointer",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export default function LawSettlerClient({ trajectories }: { trajectories: LawTrajectory[] }) {
  const [filter, setFilter] = useState<"all" | "SETTLED" | "REVERSED" | "CONTESTED">("all");

  const visible = filter === "all"
    ? trajectories
    : trajectories.filter((t) => t.currentAxis === filter);

  const reversedCount = trajectories.filter((t) => t.currentAxis === "REVERSED").length;
  const settledCount = trajectories.filter((t) => t.currentAxis === "SETTLED").length;

  return (
    <div style={{ background: C.bg, minHeight: "100vh", marginTop: "-2rem", marginLeft: "-1.5rem", marginRight: "-1.5rem" }}>
      {/* Sub-nav */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          background: "rgba(10,10,10,0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: `1px solid ${C.panelEdge}`,
          padding: "0 1.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.5rem",
          height: "2.75rem",
        }}
      >
        <Link href="/" style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none", display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <span style={{ fontSize: "1rem" }}>⬡</span> Epistemic Receipts
        </Link>
        <span style={{ color: C.panelEdge }}>/</span>
        <Link href="/settling-curve" style={{ color: C.faint, fontSize: "0.78rem", textDecoration: "none" }}>
          Settling Curve
        </Link>
        <span style={{ color: C.panelEdge }}>/</span>
        <span style={{ color: C.mut, fontSize: "0.78rem" }}>Law</span>
      </div>

      {/* Hero */}
      <div
        style={{
          background: "linear-gradient(160deg, #0f0f1e 0%, #0a0a0a 60%)",
          borderBottom: `1px solid ${C.panelEdge}`,
          padding: "3.5rem 1.5rem 3rem",
        }}
      >
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1rem" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: "rgba(212,168,83,0.12)",
                border: "1px solid rgba(212,168,83,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2rem",
                flexShrink: 0,
              }}
            >
              ⚖
            </div>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: C.brand, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.2rem" }}>
                Settling Curve · Law
              </div>
              <h1 style={{ color: C.ink, fontSize: "1.75rem", fontWeight: 700, margin: 0, lineHeight: 1.1 }}>
                Law Settler Curve
              </h1>
            </div>
          </div>

          <p style={{ color: C.mut, fontSize: "0.95rem", lineHeight: 1.6, maxWidth: "52rem", margin: "0 0 1.75rem" }}>
            Legal doctrine is not fixed — it settles, gets contested, and sometimes shatters. Each trajectory traces how a constitutional question moved through courts and institutions over decades. The epistemic arc of law, rendered as data.
          </p>

          {/* Stat row */}
          <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
            {[
              { label: "Trajectories", value: trajectories.length, color: C.brand },
              { label: "Reversed rulings", value: reversedCount, color: "#ef4444" },
              { label: "Settled doctrine", value: settledCount, color: "#22c55e" },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: "1.5rem", fontWeight: 700, color: s.color, lineHeight: 1 }}>
                  {s.value}
                </div>
                <div style={{ fontSize: "0.72rem", color: C.faint, marginTop: "0.2rem" }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter + grid */}
      <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "1.5rem 1.5rem 4rem" }}>
        {/* Filter chips */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}>
          {FILTERS.map((f) => {
            const meta = f.value === "all" ? null : AXIS_META[f.value];
            return (
              <Chip
                key={f.value}
                active={filter === f.value}
                onClick={() => setFilter(f.value as typeof filter)}
                color={meta?.color}
              >
                {f.label}
              </Chip>
            );
          })}
          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: C.faint, alignSelf: "center" }}>
            {visible.length} trajectory{visible.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Grid */}
        {visible.length === 0 ? (
          <div style={{ padding: "3rem", textAlign: "center", color: C.mut, fontSize: "0.88rem" }}>
            No trajectories match this filter.
          </div>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
              gap: "1rem",
            }}
          >
            {visible.map((t) => (
              <TrajectoryCard key={t.id} traj={t} />
            ))}
          </div>
        )}

        {/* Bottom link */}
        <div style={{ marginTop: "3rem", textAlign: "center" }}>
          <Link
            href="/settling-curve"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              color: C.mut,
              fontSize: "0.82rem",
              textDecoration: "none",
              border: `1px solid ${C.panelEdge}`,
              borderRadius: 8,
              padding: "0.5rem 1.25rem",
            }}
          >
            Explore all settling curves → science, medicine, history
          </Link>
        </div>
      </div>
    </div>
  );
}
