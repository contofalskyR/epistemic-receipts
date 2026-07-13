import { AXIS_BG_CLASS, AXIS_FALLBACK_BG_CLASS } from "@/lib/status";

export const AXIS_CONFIG: Record<string, { label: string; style: string; tooltip: string }> = {
  SETTLED: {
    label: "Settled",
    style: AXIS_BG_CLASS["SETTLED"],
    tooltip: "Consensus established — no known active dispute",
  },
  CONTESTED: {
    label: "Contested",
    style: AXIS_BG_CLASS["CONTESTED"],
    tooltip: "Actively disputed, retracted, or under challenge",
  },
  RECORDED: {
    label: "Recorded",
    style: AXIS_BG_CLASS["RECORDED"],
    tooltip: "Officially documented — it happened, epistemic weight varies",
  },
  OPEN: {
    label: "Open Question",
    style: AXIS_BG_CLASS["OPEN"],
    tooltip: "Unresolved empirical question — outcome not yet determined",
  },
  UNRESOLVABLE: {
    label: "Unresolvable",
    style: AXIS_BG_CLASS["UNRESOLVABLE"],
    tooltip: "No evidence path exists — inherently unanswerable empirically",
  },
  // Terminal transition outcomes — never stored in Claim.epistemicAxis, surfaced
  // when a claim's settling curve has reversed or been abandoned.
  REVERSED: {
    label: "Reversed",
    style: AXIS_BG_CLASS["REVERSED"],
    tooltip: "Overturned, retracted, or reversed after being recorded",
  },
  ABANDONED: {
    label: "Abandoned",
    style: AXIS_BG_CLASS["ABANDONED"],
    tooltip: "No longer in active consideration — dropped without resolution",
  },
};

const FALLBACK = {
  label: "Unclassified",
  style: AXIS_FALLBACK_BG_CLASS,
  tooltip: "Epistemic axis not yet classified",
};

export function EpistemicAxisBadge({
  axis,
  className = "text-xs px-2 py-0.5 rounded-full font-medium",
}: {
  axis: string | null | undefined;
  className?: string;
}) {
  const config = (axis ? AXIS_CONFIG[axis] : null) ?? FALLBACK;
  return (
    <span className={`${className} ${config.style}`} title={config.tooltip}>
      {config.label}
    </span>
  );
}
