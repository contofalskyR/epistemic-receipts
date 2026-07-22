// Fig. 1 on the V1 landing page — the real macro settling curve. Data comes
// from the SAME loader the /analysis/settling-rate page and the paper figure
// use (lib/settlingRate.buildSettlingRateAnalysis), so the homepage figure can
// never disagree with the published analysis. House rule (derived, never
// hand-written) still holds: the curve, the median, and every number are live.
//
// The animation layer (2026-07-21, owner request): a ball rolls slowly down
// the curve once on load; as it passes the ages where curated claims actually
// settled or reversed, those claims surface as small readable settling curves
// (palette = the settling-curve axis colors); the median marker pops when the
// ball crosses it, the ball fades at the tail, and the figure rests in its
// final static state. All SMIL — no JS timers; prefers-reduced-motion renders
// the final state immediately (see .rm-hide/.rm-show in globals.css).

import Link from "next/link";
import type { SettlingRateData } from "@/lib/settlingRate";
import { AXIS_COLOR } from "@/lib/status";
import { SLIDES, slideAgeYears, type Slide } from "./homeSlides";

// Crop the survival grid (which extends to 500 years) to the first 50 years,
// matching the mockup's 0→50 viewport where the shape actually moves.
const X_MAX_YEARS = 50;

const W = 960;
const H = 300;
const PAD_L = 60;
const PAD_R = 30;
const PLOT_TOP = 20; // y of 100%
const PLOT_BOTTOM = 248; // y of 0%

// One full pass of the ball, in seconds. Time maps linearly to the x-axis, so
// an exemplar that settled after N years pops at (N / 50) * BALL_DUR.
const BALL_DUR = 9;
// When the intro sequence is over, card bodies and the median label fade out,
// leaving anchor dots on the curve. Hovering a dot re-reveals its card (CSS
// .figcard rules in globals.css).
const SETTLE_AT = BALL_DUR + 1.2;

function xScale(t: number): number {
  return PAD_L + (t / X_MAX_YEARS) * (W - PAD_L - PAD_R);
}
function yScale(pct: number): number {
  return PLOT_BOTTOM - (pct / 100) * (PLOT_BOTTOM - PLOT_TOP);
}

function fmtYears(y: number): string {
  return y % 1 === 0 ? String(y) : y.toFixed(1);
}

// Exemplars for the fly-by cards: curated homepage trajectories that reached a
// terminal state within the figure's 50-year window. Editorial picks, data
// from the shared slide deck (no invented values).
const EXEMPLAR_SHORTS = [
  "Ulcers: acid → H. pylori",
  "Smoking causes lung cancer",
  "Saccharin scare reversed",
  "Lobotomy abandoned",
];

type Exemplar = { slide: Slide; age: number };

function pickExemplars(): Exemplar[] {
  return EXEMPLAR_SHORTS.map((short) => SLIDES.find((s) => s.short === short))
    .filter((s): s is Slide => Boolean(s))
    .map((slide) => ({ slide, age: slideAgeYears(slide) }))
    .filter((e) => e.age > 0 && e.age <= X_MAX_YEARS - 3)
    .sort((a, b) => a.age - b.age);
}

// Card geometry
const CARD_W = 132;
const CARD_H = 60;

function ExemplarCard({
  ex,
  index,
  curveYAt,
}: {
  ex: Exemplar;
  index: number;
  curveYAt: (age: number) => number;
}) {
  const { slide, age } = ex;
  const startColor = AXIS_COLOR[slide.initialAxis] ?? "#94a3b8";
  const endColor = AXIS_COLOR[slide.finalAxis] ?? "#94a3b8";
  const amber = AXIS_COLOR["CONTESTED"];
  const throughAmber = startColor !== endColor && startColor !== amber && endColor !== amber;
  const gid = `fig-ex-grad-${index}`;

  const cx = xScale(age);
  const cy = curveYAt(age);
  const above = index % 2 === 0;
  const boxX = Math.min(Math.max(cx - CARD_W / 2, PAD_L + 2), W - PAD_R - CARD_W - 2);
  const boxY = above ? Math.max(cy - CARD_H - 16, 2) : Math.min(cy + 14, PLOT_BOTTOM - CARD_H - 2);
  const delay = 0.2 + (age / X_MAX_YEARS) * (BALL_DUR - 0.4);

  // The tiny readable curve: the slide's own trajectory, scaled into the card.
  const mini = slide.pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${(10 + (x / 100) * (CARD_W - 20)).toFixed(1)},${(24 + (y / 100) * 16).toFixed(1)}`)
    .join(" ");
  const verb = slide.finalAxis === "SETTLED" ? "settled" : slide.finalAxis === "REVERSED" ? "reversed" : "moved";

  return (
    <g className="figcard">
      {/* generous invisible hover target around the anchor point */}
      <circle cx={cx} cy={cy} r={13} fill="transparent" pointerEvents="all" aria-hidden="true" />
      {/* anchor dot — pops in with the card and persists on the curve */}
      <circle cx={cx} cy={cy} r={2.5} fill={endColor} opacity={0} className="rm-show" aria-hidden="true">
        <animate attributeName="opacity" begin={`${delay.toFixed(2)}s`} dur="0.4s" values="0;1" fill="freeze" />
      </circle>
      {/* card body — appears as the ball passes, fades once the sequence
          settles, reappears on hover; clicks through to the trajectory */}
      <g opacity={0} className="figcard-body">
        <animate attributeName="opacity" begin={`${delay.toFixed(2)}s`} dur="0.5s" values="0;1" fill="freeze" />
        <animate attributeName="opacity" begin={`${SETTLE_AT.toFixed(2)}s`} dur="0.8s" values="1;0" fill="freeze" />
        <line x1={cx} y1={cy} x2={cx} y2={above ? boxY + CARD_H : boxY} stroke="#374151" strokeWidth={1} strokeDasharray="2 3" />
        <a href={slide.href} aria-label={`${slide.short} — ${verb} after ${age} years, view the trajectory`}>
          <g transform={`translate(${boxX},${boxY})`} cursor="pointer">
            <rect width={CARD_W} height={CARD_H} rx={6} fill="#0d1320" stroke="#1f2937" />
            <defs>
              <linearGradient id={gid} x1="0" y1="0" x2={CARD_W} y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={startColor} />
                {throughAmber && <stop offset="55%" stopColor={amber} />}
                <stop offset="100%" stopColor={endColor} />
              </linearGradient>
            </defs>
            <text x={10} y={15} fontSize={10} fill="#d1d5db" fontFamily="ui-sans-serif,system-ui">
              {slide.short}
            </text>
            <path d={mini} fill="none" stroke={`url(#${gid})`} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" />
            <circle
              cx={10 + ((slide.pts[slide.pts.length - 1][0] / 100) * (CARD_W - 20))}
              cy={24 + (slide.pts[slide.pts.length - 1][1] / 100) * 16}
              r={2.2}
              fill={endColor}
            />
            <text x={10} y={CARD_H - 7} fontSize={8.5} fill={endColor} fontFamily="ui-monospace,monospace">
              {verb} after {age}y
            </text>
          </g>
        </a>
      </g>
    </g>
  );
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

  // y-position on the live curve for a given age (nearest grid point).
  const curveYAt = (age: number): number => {
    let best = points[0];
    for (const p of points) {
      if (Math.abs(p.yearsAfterEmergence - age) < Math.abs(best.yearsAfterEmergence - age)) best = p;
    }
    return yScale(best.pctUnsettled);
  };

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
  const medianDelay =
    medianPoint && km !== null ? 0.2 + (medianPoint.yearsAfterEmergence / X_MAX_YEARS) * (BALL_DUR - 0.4) : 0;

  const last = points[points.length - 1];
  const lastY = yScale(last.pctUnsettled);
  const curveLabelY = Math.min(Math.max(lastY - 10, 32), 242);

  const exemplars = pickExemplars();

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

        {/* exemplar fly-by cards — real curated trajectories at their real ages */}
        {exemplars.map((ex, i) => (
          <ExemplarCard key={ex.slide.short} ex={ex} index={i} curveYAt={curveYAt} />
        ))}

        {/* median-crossing marker — the red dot pops as the ball crosses it
            and persists; the text label fades with the cards and returns on
            hover (the caption below always carries the number). */}
        {medianPoint && km !== null && (
          <g className="figcard">
            <circle cx={mx} cy={my} r={13} fill="transparent" pointerEvents="all" aria-hidden="true" />
            <circle cx={mx} cy={my} r={5} fill="#ef4444" opacity={0} className="rm-show">
              <animate attributeName="opacity" begin={`${medianDelay.toFixed(2)}s`} dur="0.4s" values="0;1" fill="freeze" />
            </circle>
            <g opacity={0} className="figcard-body">
              <animate attributeName="opacity" begin={`${medianDelay.toFixed(2)}s`} dur="0.4s" values="0;1" fill="freeze" />
              <animate attributeName="opacity" begin={`${SETTLE_AT.toFixed(2)}s`} dur="0.8s" values="1;0" fill="freeze" />
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
          </g>
        )}

        {/* the ball — rolls the full curve once, then fades into the tail */}
        <g opacity={0} className="rm-hide" aria-hidden="true">
          <animate attributeName="opacity" begin="0.2s" dur="0.3s" values="0;1" fill="freeze" />
          <animate attributeName="opacity" begin={`${(BALL_DUR - 0.4).toFixed(2)}s`} dur="0.4s" values="1;0" fill="freeze" />
          <circle r={8} fill={AXIS_COLOR["CONTESTED"]} opacity={0.18}>
            <animateMotion begin="0.2s" dur={`${BALL_DUR - 0.4}s`} calcMode="linear" fill="freeze" path={path} />
          </circle>
          <circle r={4.5} fill={AXIS_COLOR["CONTESTED"]}>
            <animateMotion begin="0.2s" dur={`${BALL_DUR - 0.4}s`} calcMode="linear" fill="freeze" path={path} />
          </circle>
        </g>
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
