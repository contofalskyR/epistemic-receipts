import Link from "next/link";
import { AXIS_BG_CLASS } from "@/lib/status";

// Maps domain field-guide editorial vocabulary to the canonical epistemic axis palette.
// Comment on each mapping states the editorial intent so future editors can judge edge cases.
const DOMAIN_VOCAB_TO_AXIS: Record<string, string> = {
  landmark:           "SETTLED",   // discovery that reshaped a field
  resolved:           "SETTLED",   // question answered, consensus formed
  solved:             "SETTLED",   // problem closed with an accepted solution
  refuted:            "REVERSED",  // claim independently disproved
  overruled:          "REVERSED",  // legal/institutional decision superseded
  superseded:         "REVERSED",  // replaced by a better model/theory
  contested:          "CONTESTED", // live dispute with credentialed voices on both sides
  "in-flux":          "CONTESTED", // actively evolving — no settled consensus yet
  revised:            "CONTESTED", // partially changed but not fully overturned
  open:               "OPEN",      // unanswered question — no clear winner yet
  "needs-verification": "OPEN",    // claim pending independent replication or review
  frontier:           "OPEN",      // leading edge — active research, no consensus
  speculative:        "OPEN",      // hypothesis without sufficient empirical support yet
  abandoned:          "ABANDONED", // line of inquiry dropped without a verdict
};

const DOMAIN_LABEL: Record<string, string> = {
  landmark:           "LANDMARK",
  resolved:           "RESOLVED",
  solved:             "SOLVED",
  refuted:            "REFUTED",
  overruled:          "OVERRULED",
  superseded:         "SUPERSEDED",
  contested:          "CONTESTED",
  "in-flux":          "IN FLUX",
  revised:            "REVISED",
  open:               "OPEN",
  "needs-verification": "NEEDS VERIFICATION",
  frontier:           "FRONTIER",
  speculative:        "SPECULATIVE",
  abandoned:          "ABANDONED",
};

type Props = {
  status: string;
  className?: string;
};

export function DomainStatusBadge({ status, className = "" }: Props) {
  if (!status) return null;
  const key = status.toLowerCase();
  const axis = DOMAIN_VOCAB_TO_AXIS[key];
  if (!axis && process.env.NODE_ENV === "development") {
    console.warn(`DomainStatusBadge: unmapped status token "${status}" — add it to DOMAIN_VOCAB_TO_AXIS`);
  }
  const bgClass = axis ? AXIS_BG_CLASS[axis] : "bg-gray-800 text-gray-400";
  const label = DOMAIN_LABEL[key] ?? status.toUpperCase();
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono border border-transparent ${bgClass} ${className}`}>
      {label}
    </span>
  );
}
