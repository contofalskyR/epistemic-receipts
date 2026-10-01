// Shared bits for the /api/og/* image routes: the settling-curve card used by
// /settling-curve/[id] and /claims/[id], and the default card everything else
// gets (STATUS.md Phase 5).
import { SITE_URL } from "@/lib/site";
import { AXIS_VIS } from "@/app/components/SettlingCurveMini";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** The host shown in a card's corner — follows NEXT_PUBLIC_SITE_URL. */
export const OG_HOST = new URL(SITE_URL).host;


// OG images are fetched by link scrapers against ~1.76M claim URLs — let the
// CDN absorb repeats instead of re-rendering (each render is a live DB query).
export const OG_CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

// Re-exported from lib/status so OG images and the app share one source of truth.
export { AXIS_COLOR, axisColor } from "@/lib/status";

// The default card: every page without a curve of its own, and the fallback
// for a bad/missing id. A decorative curve (not a real claim — no years, no
// axis labels) keeps it on-brand.
export function FallbackCard() {
  const W = OG_WIDTH;
  const H = OG_HEIGHT;
  const deco = [
    [80, 530], [240, 490], [400, 530], [560, 440], [720, 460], [880, 390], [1040, 360], [1120, 360],
  ] as const;
  const colors = ["#94a3b8", "#f59e0b", "#94a3b8", "#f59e0b", "#ef4444", "#f59e0b", "#22c55e", "#22c55e"];
  const path = deco.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x} ${y}`).join(" ");
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        background: "#0a0a12",
        position: "relative",
        fontFamily: "monospace",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", padding: "72px 80px 0 80px" }}>
        <span style={{ fontSize: 13, letterSpacing: "0.22em", textTransform: "uppercase", color: "#d4a853", marginBottom: 22 }}>
          EPISTEMIC RECEIPTS
        </span>
        <p style={{ fontSize: 52, color: "#ffffff", fontWeight: 600, lineHeight: 1.15, margin: 0, maxWidth: 820 }}>
          Track how knowledge changes over time.
        </p>
        <p style={{ fontSize: 20, color: "#8b8ba3", lineHeight: 1.4, margin: "22px 0 0 0", maxWidth: 760 }}>
          Settling curves for claims across science, law and history — every status change traced to a source.
        </p>
      </div>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ position: "absolute", top: 0, left: 0 }}>
        <line x1={80} y1={360} x2={1120} y2={360} stroke="#22c55e" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="4 6" />
        <path d={`${path} L 1120 565 L 80 565 Z`} fill="#22c55e" fillOpacity={0.08} />
        <path d={path} fill="none" stroke="#e9e9f2" strokeOpacity={0.85} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        {deco.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={8} fill={colors[i]} stroke="#0a0a12" strokeWidth={3} />
        ))}
      </svg>
      <span style={{ position: "absolute", left: 80, top: 340, fontSize: 11, letterSpacing: "0.18em", color: "#22c55e", opacity: 0.7 }}>
        SETTLED
      </span>
      <p
        style={{
          position: "absolute",
          bottom: 28,
          right: 80,
          fontSize: 13,
          color: "#55556e",
          letterSpacing: "0.08em",
          margin: 0,
        }}
      >
        {OG_HOST}
      </p>
    </div>
  );
}

// ─── The settling curve card ─────────────────────────────────────────────────
//
// Same geometry as app/components/SettlingCurveMini.tsx (x = year, y = how
// settled the axis is, AXIS_VIS levels and colours) so the link preview shows
// the curve the page draws. Satori renders inline SVG for the line and dots;
// labels are HTML spans because SVG <text> has no font in the OG runtime.

export type CurveMilestone = { year: number; axis: string };

const AXIS_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(AXIS_VIS).map(([k, v]) => [k, v.label]),
);

export function CurveCard({
  eyebrow = "EPISTEMIC RECEIPT",
  title,
  milestones,
  caption,
}: {
  eyebrow?: string;
  /** Claim text or trajectory hook; clamped to three lines. */
  title: string;
  /** Chain order (seq) — the route passes them already sorted. */
  milestones: CurveMilestone[];
  /** Small line under the curve, e.g. "7 transitions · 3 communities". */
  caption?: string;
}) {
  const W = OG_WIDTH;
  const H = OG_HEIGHT;
  // Plot box inside the card
  const plotX = 80;
  const plotY = 300;
  const plotW = W - 2 * plotX;
  const plotH = 190;

  const ms = milestones.length > 0 ? milestones : [{ year: new Date().getUTCFullYear(), axis: "RECORDED" }];
  const years = ms.map((m) => m.year);
  const minYear = Math.min(...years);
  const maxYear = Math.max(...years);
  const span = maxYear - minYear || 1;

  const pts = ms.map((m, i) => {
    const x = ms.length === 1 ? plotX + plotW / 2 : plotX + ((m.year - minYear) / span) * plotW;
    const level = AXIS_VIS[m.axis]?.level ?? 0.4;
    const y = plotY + (1 - level) * plotH;
    return { x, y, m, i };
  });
  const last = pts[pts.length - 1];
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L ${last.x.toFixed(1)} ${(plotY + plotH).toFixed(1)} L ${pts[0].x.toFixed(1)} ${(plotY + plotH).toFixed(1)} Z`;
  const settledY = plotY + (1 - AXIS_VIS.SETTLED.level) * plotH;
  const lastColor = AXIS_VIS[last.m.axis]?.color ?? "#94a3b8";

  // Year labels: every dot up to eight, then first/last plus evenly spaced.
  const labelIdx = new Set<number>();
  if (pts.length <= 8) pts.forEach((p) => labelIdx.add(p.i));
  else {
    const step = (pts.length - 1) / 6;
    for (let k = 0; k <= 6; k++) labelIdx.add(Math.round(k * step));
  }
  const yearSpan = minYear === maxYear ? String(minYear) : `${minYear} → ${maxYear}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: W,
        height: H,
        background: "#0a0a12",
        position: "relative",
        fontFamily: "monospace",
      }}
    >
      {/* Eyebrow + title */}
      <div style={{ display: "flex", flexDirection: "column", padding: "52px 80px 0 80px" }}>
        <span style={{ fontSize: 12, letterSpacing: "0.22em", textTransform: "uppercase", color: "#d4a853", marginBottom: 18 }}>
          {eyebrow}
        </span>
        <p
          style={{
            fontSize: title.length > 120 ? 30 : 36,
            color: "#ffffff",
            fontWeight: 600,
            lineHeight: 1.2,
            margin: 0,
            maxWidth: 1040,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {title}
        </p>
      </div>

      {/* The curve */}
      <svg
        width={W}
        height={H}
        viewBox={`0 0 ${W} ${H}`}
        style={{ position: "absolute", top: 0, left: 0 }}
      >
        <line x1={plotX} y1={settledY} x2={plotX + plotW} y2={settledY} stroke="#22c55e" strokeOpacity={0.3} strokeWidth={1} strokeDasharray="4 6" />
        <line x1={plotX} y1={plotY + plotH} x2={plotX + plotW} y2={plotY + plotH} stroke="#1e1e2e" strokeWidth={1} />
        <path d={areaPath} fill={lastColor} fillOpacity={0.12} />
        <path d={linePath} fill="none" stroke="#e9e9f2" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.85} />
        {pts.map((p) => (
          <circle key={p.i} cx={p.x} cy={p.y} r={8} fill={AXIS_VIS[p.m.axis]?.color ?? "#94a3b8"} stroke="#0a0a12" strokeWidth={3} />
        ))}
      </svg>

      {/* "Settled" reference label */}
      <span style={{ position: "absolute", left: plotX, top: settledY - 20, fontSize: 11, letterSpacing: "0.18em", color: "#22c55e", opacity: 0.7 }}>
        SETTLED
      </span>

      {/* Current axis at the last dot */}
      <span
        style={{
          position: "absolute",
          left: Math.min(last.x + 14, W - plotX - 140),
          top: last.y - 34,
          fontSize: 14,
          fontWeight: 600,
          color: lastColor,
        }}
      >
        {AXIS_LABEL[last.m.axis] ?? last.m.axis}
      </span>

      {/* Year labels */}
      {pts.filter((p) => labelIdx.has(p.i)).map((p) => (
        <span
          key={p.i}
          style={{ position: "absolute", left: p.x - 24, top: plotY + plotH + 10, width: 48, display: "flex", justifyContent: "center", fontSize: 12, color: "#6b6b85" }}
        >
          {p.m.year}
        </span>
      ))}

      {/* Footer */}
      <div
        style={{
          position: "absolute",
          left: 80,
          right: 80,
          bottom: 40,
          display: "flex",
          justifyContent: "space-between",
          fontSize: 13,
          color: "#55556e",
          letterSpacing: "0.08em",
        }}
      >
        <span>{caption ? `${yearSpan} · ${caption}` : yearSpan}</span>
        <span>{OG_HOST}</span>
      </div>
    </div>
  );
}
