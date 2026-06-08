export const AXIS_CONFIG: Record<string, { label: string; style: string; tooltip: string }> = {
  SETTLED: {
    label: "Settled",
    style: "bg-emerald-900 text-emerald-300",
    tooltip: "Established fact with no known active dispute",
  },
  CONTESTED: {
    label: "Contested",
    style: "bg-amber-900 text-amber-300",
    tooltip: "Disputed, retracted, or under active challenge",
  },
  RECORDED: {
    label: "Recorded",
    style: "bg-blue-900 text-blue-300",
    tooltip: "Officially documented; epistemic weight varies by source",
  },
  OPEN: {
    label: "Open",
    style: "bg-purple-900 text-purple-300",
    tooltip: "Under active investigation; outcome not yet determined",
  },
  UNRESOLVABLE: {
    label: "Unresolvable",
    style: "bg-gray-700 text-gray-400",
    tooltip: "Inherently unanswerable by empirical evidence alone",
  },
};

const FALLBACK = {
  label: "Unverified",
  style: "bg-gray-800 text-gray-500",
  tooltip: "Epistemic status not yet determined",
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
