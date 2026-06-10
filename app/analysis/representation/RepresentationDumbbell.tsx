"use client";

import { useState } from "react";
import type { TopicSummary } from "@/lib/representationGap";

const TOPIC_LABELS: Record<string, string> = {
  taxation: "Taxation",
  appropriations: "Appropriations",
  foreign_policy: "Foreign Policy",
  military: "Military",
  banking_finance: "Banking & Finance",
  labor: "Labor",
  infrastructure: "Infrastructure",
  judiciary: "Judiciary",
  social_welfare: "Social Welfare",
  public_lands: "Public Lands",
  defense: "Defense",
  tariff_trade: "Tariff & Trade",
  education: "Education",
  agriculture: "Agriculture",
  health: "Healthcare",
  housing: "Housing",
  native_affairs: "Native Affairs",
  postal: "Postal Service",
  environment: "Environment",
  civil_rights: "Civil Rights",
  immigration: "Immigration",
  technology: "Technology",
  prohibition: "Prohibition",
  slavery: "Slavery",
  war: "War",
  economy: "Economy",
};

function toLabel(slug: string): string {
  return (
    TOPIC_LABELS[slug] ??
    slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function segmentColor(gap: number): string {
  if (gap > 40) return "#dc2626"; // red-600
  if (gap > 25) return "#ea580c"; // orange-600
  if (gap > 15) return "#ca8a04"; // yellow-600
  return "#6b7280"; // gray-500
}

interface Props {
  topics: TopicSummary[];
}

const INITIAL_SHOW = 20;

export function RepresentationDumbbell({ topics }: Props) {
  const [showAll, setShowAll] = useState(false);

  // Sort by plotGap (difference of means) descending — NOT avgGap
  const sorted = [...topics].sort((a, b) => {
    const gA = Math.abs(a.avgConstituentSupportPct - a.avgDelegationYeaPct);
    const gB = Math.abs(b.avgConstituentSupportPct - b.avgDelegationYeaPct);
    return gB - gA;
  });

  const displayed = showAll ? sorted : sorted.slice(0, INITIAL_SHOW);

  // Headline stats
  const plotGaps = displayed.map((t) =>
    Math.abs(t.avgConstituentSupportPct - t.avgDelegationYeaPct)
  );
  const meanPlotGap =
    plotGaps.length > 0
      ? plotGaps.reduce((s, g) => s + g, 0) / plotGaps.length
      : 0;

  // SVG layout constants
  const LABEL_W = 130; // px for label column
  const AXIS_W = 300; // px for the 0–100 range
  const GAP_LABEL_W = 50; // px for "X.X pp" label
  const N_LABEL_W = 50; // px for "n=..." label
  const SVG_W = LABEL_W + AXIS_W + GAP_LABEL_W + N_LABEL_W + 20; // 20px padding
  const ROW_H = 28;
  const AXIS_Y_OFFSET = 18; // axis tick label row height
  const DOT_R = 5;
  const PADDING = 12; // left/right padding inside the chart

  function xPos(pct: number): number {
    return LABEL_W + PADDING + (pct / 100) * (AXIS_W - 2 * PADDING);
  }

  const totalH = AXIS_Y_OFFSET + displayed.length * ROW_H + 20;

  return (
    <div className="space-y-3">
      {/* Headline */}
      <div className="rounded border border-gray-800 bg-gray-900/60 px-4 py-3">
        <p className="text-sm text-gray-200 leading-snug">
          On{" "}
          <span className="font-semibold tabular-nums text-white">
            {displayed.length}
          </span>{" "}
          policy topics, Congress diverges from public opinion by an average of{" "}
          <span className="font-semibold tabular-nums text-red-300">
            {meanPlotGap.toFixed(1)}%
          </span>{" "}
          (aggregate gap).
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Amber dot = constituent support % (liberal-coded direction). Gray dot
          = congressional delegation Yea %. Segment = aggregate gap (difference
          of means).
        </p>
      </div>

      {/* Dumbbell SVG */}
      <div className="rounded border border-gray-800 bg-gray-950 overflow-x-auto">
        <svg
          viewBox={`0 0 ${SVG_W} ${totalH}`}
          width="100%"
          style={{ minWidth: 360, maxWidth: SVG_W, display: "block" }}
          aria-label="Dumbbell chart showing constituent support vs congressional Yea % by topic"
          role="img"
        >
          {/* Column headers */}
          <text
            x={LABEL_W + PADDING}
            y={AXIS_Y_OFFSET - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            0
          </text>
          <text
            x={xPos(50)}
            y={AXIS_Y_OFFSET - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            50
          </text>
          <text
            x={LABEL_W + AXIS_W - PADDING}
            y={AXIS_Y_OFFSET - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            100%
          </text>
          {/* Gap column header */}
          <text
            x={LABEL_W + AXIS_W + GAP_LABEL_W / 2}
            y={AXIS_Y_OFFSET - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            net gap
          </text>
          {/* N column header */}
          <text
            x={LABEL_W + AXIS_W + GAP_LABEL_W + N_LABEL_W / 2}
            y={AXIS_Y_OFFSET - 4}
            textAnchor="middle"
            fontSize={9}
            fill="#6b7280"
          >
            n (rows)
          </text>

          {/* Median reference line at 50% */}
          <line
            x1={xPos(50)}
            y1={AXIS_Y_OFFSET}
            x2={xPos(50)}
            y2={totalH - 10}
            stroke="#374151"
            strokeWidth={1}
            strokeDasharray="3,3"
          />

          {displayed.map((topic, i) => {
            const plotGap = Math.abs(
              topic.avgConstituentSupportPct - topic.avgDelegationYeaPct
            );
            const cx = xPos(topic.avgConstituentSupportPct);
            const dx = xPos(topic.avgDelegationYeaPct);
            const y = AXIS_Y_OFFSET + i * ROW_H + ROW_H / 2;
            const color = segmentColor(plotGap);
            const label = toLabel(topic.topicSlug);
            // Truncate label for display (SVG doesn't support text-overflow natively)
            const displayLabel =
              label.length > 16 ? label.slice(0, 14) + "…" : label;

            return (
              <g
                key={topic.topicSlug}
                role="row"
                tabIndex={0}
                aria-label={`${label}: constituent support ${topic.avgConstituentSupportPct.toFixed(1)}%, congressional Yea ${topic.avgDelegationYeaPct.toFixed(1)}%, net gap ${plotGap.toFixed(1)}%, n=${topic.matchedRowCount}`}
                className="focus:outline-none"
              >
                {/* Row hover background */}
                <rect
                  x={0}
                  y={y - ROW_H / 2}
                  width={SVG_W}
                  height={ROW_H}
                  fill="transparent"
                  className="hover:fill-gray-900"
                />

                {/* Topic label */}
                <text
                  x={LABEL_W - 6}
                  y={y + 4}
                  textAnchor="end"
                  fontSize={10}
                  fill="#d1d5db"
                >
                  {displayLabel}
                </text>

                {/* Axis baseline for this row */}
                <line
                  x1={LABEL_W + PADDING}
                  y1={y}
                  x2={LABEL_W + AXIS_W - PADDING}
                  y2={y}
                  stroke="#1f2937"
                  strokeWidth={1}
                />

                {/* Segment connecting the two dots */}
                <line
                  x1={Math.min(cx, dx)}
                  y1={y}
                  x2={Math.max(cx, dx)}
                  y2={y}
                  stroke={color}
                  strokeWidth={2.5}
                  aria-label={`Gap segment: ${plotGap.toFixed(1)} percentage points`}
                />

                {/* Constituent support dot (amber) */}
                <circle
                  cx={cx}
                  cy={y}
                  r={DOT_R}
                  fill="#f59e0b"
                  aria-label={`Constituent support: ${topic.avgConstituentSupportPct.toFixed(1)}%`}
                />

                {/* Congressional Yea dot (slate) */}
                <circle
                  cx={dx}
                  cy={y}
                  r={DOT_R}
                  fill="#94a3b8"
                  aria-label={`Congressional Yea: ${topic.avgDelegationYeaPct.toFixed(1)}%`}
                />

                {/* Net gap label — encodes plotGap, NOT avgGap */}
                <text
                  x={LABEL_W + AXIS_W + GAP_LABEL_W / 2}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize={10}
                  fill={color}
                  fontWeight="600"
                >
                  {plotGap.toFixed(1)}
                </text>

                {/* Matched row count (n) */}
                <text
                  x={LABEL_W + AXIS_W + GAP_LABEL_W + N_LABEL_W / 2}
                  y={y + 4}
                  textAnchor="middle"
                  fontSize={9}
                  fill="#6b7280"
                >
                  {topic.matchedRowCount.toLocaleString()}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-gray-400">
        <span className="flex items-center gap-1">
          <svg width={12} height={12} aria-hidden="true">
            <circle cx={6} cy={6} r={5} fill="#f59e0b" />
          </svg>
          Constituent support % (liberal-coded)
        </span>
        <span className="flex items-center gap-1">
          <svg width={12} height={12} aria-hidden="true">
            <circle cx={6} cy={6} r={5} fill="#94a3b8" />
          </svg>
          Congressional delegation Yea %
        </span>
        <span className="flex items-center gap-3">
          <span style={{ color: "#dc2626" }}>&gt;40 pp</span>
          <span style={{ color: "#ea580c" }}>&gt;25 pp</span>
          <span style={{ color: "#ca8a04" }}>&gt;15 pp</span>
          <span style={{ color: "#6b7280" }}>≤15 pp</span>
        </span>
      </div>

      {/* Show more / less */}
      {sorted.length > INITIAL_SHOW && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="text-xs text-blue-400 hover:text-blue-300 underline transition-colors"
        >
          {showAll
            ? "Show fewer topics"
            : `Show all ${sorted.length} topics`}
        </button>
      )}

      {/* Honesty elements — DO-NOT #5 */}
      <div className="rounded border border-gray-800/60 bg-gray-900/30 px-3 py-2 text-xs text-gray-500 leading-relaxed max-w-3xl">
        <p>
          <span className="text-gray-400 font-medium">Direction caveat:</span>{" "}
          &ldquo;Support&rdquo; = liberal-coded position per CCES question
          framing (ideo5, pid3, or demographic proxy — see methodology note
          above). Gaps are not a measure of political failure — they reflect the
          intersection of representation, issue salience, party discipline, and
          polling methodology.
        </p>
        <p className="mt-1">
          <span className="text-gray-400 font-medium">Net gap</span> (shown on
          chart) = |avg constituent support % − avg delegation Yea %|
          (difference of means). The{" "}
          <span className="font-mono">avg gap</span> column in the topic table
          below is the mean of per-row absolute gaps, which is always ≥ the net
          gap. The <span className="font-mono">n (rows)</span> column shows the
          number of matched (state, year, topic) cells that produced each
          aggregate.
        </p>
      </div>
    </div>
  );
}
