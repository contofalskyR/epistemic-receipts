// Compact, server-rendered SVG sparkline of a claim's epistemic milestones.
// Deliberately NOT the full /settling-curve component — no client JS, no data
// fetching. It takes already-loaded milestones and draws dots across a timeline,
// height mapped to how "settled" each state is. CSS keyframes (draw-line, dot-pop)
// live in globals.css and animate it in on load.

import type { FeaturedMilestone } from "@/lib/featured-trajectories";

export const AXIS_VIS: Record<string, { color: string; level: number; label: string }> = {
  ABANDONED:    { color: "#6b7280", level: 0.10, label: "Abandoned" },
  REVERSED:     { color: "#ef4444", level: 0.16, label: "Reversed" },
  OPEN:         { color: "#38bdf8", level: 0.24, label: "Open" },
  UNRESOLVABLE: { color: "#a78bfa", level: 0.30, label: "Unresolvable" },
  CONTESTED:    { color: "#f59e0b", level: 0.36, label: "Contested" },
  RECORDED:     { color: "#94a3b8", level: 0.48, label: "Recorded" },
  SETTLED:      { color: "#22c55e", level: 0.92, label: "Settled" },
};

export default function SettlingCurveMini({
  milestones,
  className = "",
  ariaLabel,
}: {
  milestones: FeaturedMilestone[];
  className?: string;
  ariaLabel?: string;
}) {
  const W = 760, H = 210;
  const padL = 18, padR = 18, padT = 26, padB = 36;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;

  const ms = milestones.length > 0 ? milestones : [{ year: 0, axis: "RECORDED", community: "", reason: null }];
  const years = ms.map((m) => m.year);
  const minY = Math.min(...years);
  const maxY = Math.max(...years);
  const span = maxY - minY || 1;

  const pts = ms.map((m, i) => {
    const x = ms.length === 1 ? padL + plotW / 2 : padL + ((m.year - minY) / span) * plotW;
    const conf = AXIS_VIS[m.axis]?.level ?? 0.4;
    const y = padT + (1 - conf) * plotH;
    return { x, y, m, i };
  });

  const linePath = pts
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(" ");

  let len = 0;
  for (let i = 1; i < pts.length; i++) {
    len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  }

  const areaPath =
    `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${(padT + plotH).toFixed(1)} ` +
    `L ${pts[0].x.toFixed(1)} ${(padT + plotH).toFixed(1)} Z`;

  const settledY = padT + (1 - AXIS_VIS.SETTLED.level) * plotH;
  const last = pts[pts.length - 1];

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-auto ${className}`}
      role="img"
      aria-label={ariaLabel ?? "Epistemic trajectory sparkline"}
    >
      <defs>
        <linearGradient id="mini-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#94a3b8" />
          <stop offset="60%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#22c55e" />
        </linearGradient>
        <linearGradient id="mini-area" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22c55e" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* "Settled" reference line */}
      <line
        x1={padL} y1={settledY} x2={W - padR} y2={settledY}
        stroke="#22c55e" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 5"
      />
      <text
        x={W - padR} y={settledY - 5} textAnchor="end"
        className="fill-emerald-500/70" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}
      >
        SETTLED
      </text>

      <path d={areaPath} fill="url(#mini-area)" />
      <path
        d={linePath}
        fill="none"
        stroke="url(#mini-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          // @ts-expect-error CSS custom property
          "--draw-len": len,
          strokeDasharray: len,
          animation: "draw-line 1.6s ease-out forwards",
        }}
      />

      {pts.map((p) => {
        const color = AXIS_VIS[p.m.axis]?.color ?? "#94a3b8";
        return (
          <g key={p.i}>
            <circle
              cx={p.x} cy={p.y} r="5"
              fill={color} stroke="#0a0a0a" strokeWidth="2"
              style={{
                transformOrigin: `${p.x}px ${p.y}px`,
                opacity: 0,
                animation: "dot-pop 0.4s ease-out forwards",
                animationDelay: `${0.5 + p.i * 0.22}s`,
              }}
            >
              <title>{`${p.m.year} · ${AXIS_VIS[p.m.axis]?.label ?? p.m.axis}${p.m.reason ? ` — ${p.m.reason}` : ""}`}</title>
            </circle>
            <text
              x={p.x} y={H - padB + 16} textAnchor="middle"
              className="fill-gray-600" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}
            >
              {p.m.year}
            </text>
          </g>
        );
      })}

      <text
        x={last.x} y={last.y - 12} textAnchor="end"
        className="fill-emerald-300" style={{ fontSize: 11, fontWeight: 600 }}
      >
        {AXIS_VIS[last.m.axis]?.label ?? last.m.axis}
      </text>
    </svg>
  );
}
