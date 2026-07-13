"use client";

import { AXIS_COLOR, AXIS_LABEL } from "@/lib/status";

// Ordered from most-positive to most-contested/negative — mirrors axis semantics.
const LEGEND_AXES = [
  "SETTLED",
  "CONTESTED",
  "REVERSED",
  "RECORDED",
  "OPEN",
  "ABANDONED",
  "UNRESOLVABLE",
] as const;

const AXIS_TOOLTIP: Record<string, string> = {
  SETTLED:      "Consensus established — no known active dispute",
  CONTESTED:    "Actively disputed, retracted, or under challenge",
  REVERSED:     "Overturned, retracted, or reversed after being recorded",
  RECORDED:     "Officially documented — it happened; epistemic weight varies",
  OPEN:         "Unresolved empirical question — outcome not yet determined",
  ABANDONED:    "No longer in active consideration — dropped without resolution",
  UNRESOLVABLE: "No evidence path exists — inherently unanswerable empirically",
};

export function EpistemicLegend({
  label = "Epistemic axis:",
  className = "",
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500 ${className}`}
    >
      {label && (
        <span className="font-mono uppercase tracking-wider text-gray-600">{label}</span>
      )}
      {LEGEND_AXES.map((axis) => (
        <span
          key={axis}
          className="inline-flex items-center gap-1.5 cursor-help"
          title={AXIS_TOOLTIP[axis]}
        >
          <span
            aria-hidden="true"
            style={{ background: AXIS_COLOR[axis] }}
            className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
          />
          {AXIS_LABEL[axis]}
        </span>
      ))}
    </div>
  );
}
