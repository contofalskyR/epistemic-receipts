import { AXIS_BG_CLASS } from "@/lib/status";

// Maps domain field-guide editorial vocabulary to the canonical epistemic axis palette.
// Domain pages use LANDMARK/REFUTED/OPEN/RESOLVED as human-readable status markers;
// these map to SETTLED/REVERSED/OPEN/SETTLED axis colors from lib/status.ts.
const DOMAIN_VOCAB_TO_AXIS: Record<string, string> = {
  landmark: "SETTLED",
  resolved: "SETTLED",
  refuted:  "REVERSED",
  open:     "OPEN",
  contested: "CONTESTED",
  abandoned: "ABANDONED",
};

const DOMAIN_LABEL: Record<string, string> = {
  landmark:  "LANDMARK",
  resolved:  "RESOLVED",
  refuted:   "REFUTED",
  open:      "OPEN",
  contested: "CONTESTED",
  abandoned: "ABANDONED",
};

type Props = {
  status: string;
  className?: string;
};

export function DomainStatusBadge({ status, className = "" }: Props) {
  const key = status.toLowerCase();
  const axis = DOMAIN_VOCAB_TO_AXIS[key];
  const bgClass = axis ? AXIS_BG_CLASS[axis] : "bg-gray-800 text-gray-400";
  const label = DOMAIN_LABEL[key] ?? status.toUpperCase();
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border border-transparent ${bgClass} ${className}`}>
      {label}
    </span>
  );
}
