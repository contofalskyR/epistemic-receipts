// Fig. 1 on the V1 landing page — the real macro settling curve, server-rendered
// as a static SVG (no client JS, no recharts). Data comes from the SAME loader
// the /analysis/settling-rate page and the paper figure use
// (lib/settlingRate.buildSettlingRateAnalysis), so the homepage figure can never
// disagree with the published analysis. The v1-landing mockup shipped an
// "illustrative mock" with hand-drawn domain curves and an invented
// "median reversal: 11.2y" stat — house rule (derived, never hand-written)
// forbids that, so this renders the live corpus curve instead:
// share of tracked claims not yet settled, by years since each claim emerged.

import Link from "next/link";
import type { SettlingRateData } from "@/lib/settlingRate";

// Crop the survival grid (which extends to 500 years) to the first 50 years,
// matching the mockup's 0→50 viewport where the shape actually moves.
const X_MAX_YEARS = 50;

const W = 960;
const H = 300;
const PAD_L = 60;
const PAD_R = 30;
const PLOT_TOP = 20; // y of 100%
const PLOT_BOTTOM = 248; // y of 0%

function xScale(t: number): number {
  return PAD_L + (t / X_MAX_YEARS) * (W - PAD_L - PAD_R);
}
function yScale(pct: number): number {
  return PLOT_BOTTOM - (pct / 100) * (PLOT_BOTTOM - PLOT_TOP);
}

function fmtYears(y: number): string {
  return y % 1 === 0 ? String(y) : y.toFixed(1);
}

export default function HomeSurvivalFig({
  data,
  datedTrajectoryCount,
}: {
  data: SettlingRateData;
  /** Non-deleted trajectory claims with a claimEmergedAt — the basis set the
   *  survival percentages are computed over (mirrors lib/settlingRate's filter). */
  datedTrajectoryCount: number;
}) {
  const points = data.survivalCurve.filter((p) => p.yearsAfterEmergence <= X_MAX_YEARS);
  if (points.length < 2) return null;

  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"}${xScale(p.yearsAfterEmergence).toFixed(1)},${yScale(p.pctUnsettled).toFixed(1)}`,
    )
    .join(" ");

  // Median marker: the first grid point at or under 50% unsettled — the same
  // crossing lib/settlingRate reports as kmMedianYears.
  const km = data.kmMedianYears;
  const medianPoint =
    km !== null && km <= X_MAX_YEARS
      ? points.find((p) => p.pctUnsettled <= 50)
      : undefined;
  const mx = medianPoint ? xScale(medianPoint.yearsAfterEmergence) : 0;
  const my = medianPoint ? yScale(medianPoint.pctUnsettled) : 0;
  const medianLabelLeft = mx > 600; // anchor the label away from the right edge

  const last = points[points.length - 1];
  const lastY = yScale(last.pctUnsettled);
  const curveLabelY = Math.min(Math.max(lastY - 10, 32), 242);

  const nLabel = datedTrajectoryCount.toLocaleString("en-US");
  const revLabel = data.reversalRate.toFixed(1);
  const kmSentence =
    km !== null
      ? `Median time to settle: ${fmtYears(km)} years; ${revLabel}% of tracked claims were later reversed or abandoned.`
      : `${revLabel}% of tracked claims were later reversed or abandoned.`;

  return (
    <figure>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Survival curve: share of tracked claims not yet settled versus years since each claim emerged, across ${nLabel} dated trajectories. ${kmSentence}`}
      >
        {/* axes */}
        <line x1={PAD_L} y1={PLOT_TOP - 4} x2={PAD_L} y2={PLOT_BOTTOM} stroke="#2a2a3a" />
        <line x1={PAD_L} y1={PLOT_BOTTOM} x2={W - PAD_R} y2={PLOT_BOTTOM} stroke="#2a2a3a" />

        {/* y labels */}
        <text x={PAD_L - 8} y={PLOT_TOP + 4} textAnchor="end" fontSize="12" fill="#6f6d7c">
          100%
        </text>
        <text x={PAD_L - 8} y={yScale(50) + 4} textAnchor="end" fontSize="12" fill="#6f6d7c">
          50%
        </text>
        <text x={PAD_L - 8} y={PLOT_BOTTOM + 3} textAnchor="end" fontSize="12" fill="#6f6d7c">
          0%
        </text>

        {/* x labels */}
        <text x={PAD_L} y={PLOT_BOTTOM + 22} fontSize="12" fill="#6f6d7c">
          0
        </text>
        <text
          x={(PAD_L + W - PAD_R) / 2}
          y={PLOT_BOTTOM + 22}
          textAnchor="middle"
          fontSize="12"
          fill="#6f6d7c"
        >
          years since the claim emerged
        </text>
        <text x={W - PAD_R - 4} y={PLOT_BOTTOM + 22} textAnchor="end" fontSize="12" fill="#6f6d7c">
          {X_MAX_YEARS}
        </text>

        {/* faint 50% guide */}
        <line
          x1={PAD_L}
          y1={yScale(50)}
          x2={W - PAD_R}
          y2={yScale(50)}
          stroke="#2a2a3a"
          strokeDasharray="3 6"
        />

        {/* the real curve */}
        <path d={path} fill="none" stroke="#34d399" strokeWidth="3" strokeLinejoin="round" />
        <text x={W - PAD_R} y={curveLabelY} textAnchor="end" fontSize="13" fill="#34d399">
          share still unsettled
        </text>

        {/* median-crossing marker */}
        {medianPoint && km !== null && (
          <g>
            <circle cx={mx} cy={my} r="5" fill="#ef4444" />
            <text
              x={medianLabelLeft ? mx - 12 : mx + 12}
              y={my - 8}
              textAnchor={medianLabelLeft ? "end" : "start"}
              fontSize="12"
              fill="#f0a5a5"
            >
              median time to settle: {fmtYears(km)}y
            </text>
          </g>
        )}
      </svg>
      <figcaption className="mt-2 text-[12.5px] leading-relaxed text-gray-600">
        Fig. 1 — the settling curve: share of tracked claims not yet settled, by years since each
        claim emerged. {kmSentence} Computed live from{" "}
        <span className="text-gray-500">{nLabel}</span> dated trajectories.{" "}
        <Link
          href="/analysis/settling-rate"
          className="text-gray-400 underline-offset-2 hover:text-gray-200 hover:underline"
        >
          Full analysis →
        </Link>
      </figcaption>
    </figure>
  );
}
