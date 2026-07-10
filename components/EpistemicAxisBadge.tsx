export const AXIS_CONFIG: Record<string, { label: string; style: string; tooltip: string }> = {
  SETTLED: {
    label: "Settled",
    style: "bg-emerald-900 text-emerald-300",
    tooltip: "Consensus established — no known active dispute",
  },
  CONTESTED: {
    label: "Contested",
    style: "bg-amber-900 text-amber-300",
    tooltip: "Actively disputed, retracted, or under challenge",
  },
  RECORDED: {
    label: "Recorded",
    style: "bg-slate-800 text-slate-300",
    tooltip: "Officially documented — it happened, epistemic weight varies",
  },
  OPEN: {
    label: "Open Question",
    style: "bg-blue-900 text-blue-300",
    tooltip: "Unresolved empirical question — outcome not yet determined",
  },
  UNRESOLVABLE: {
    label: "Unresolvable",
    style: "bg-violet-900 text-violet-300",
    tooltip: "No evidence path exists — inherently unanswerable empirically",
  },
  // Terminal transition outcomes — never stored in Claim.epistemicAxis, surfaced
  // when a claim's settling curve has reversed or been abandoned.
  REVERSED: {
    label: "Reversed",
    style: "bg-rose-900 text-rose-300",
    tooltip: "Overturned, retracted, or reversed after being recorded",
  },
  ABANDONED: {
    label: "Abandoned",
    style: "bg-gray-800 text-gray-400",
    tooltip: "No longer in active consideration — dropped without resolution",
  },
};

const FALLBACK = {
  label: "Unclassified",
  style: "bg-gray-800 text-gray-500",
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
