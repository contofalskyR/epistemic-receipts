// Shared presentational constants/helpers for the claim page — imported by
// both the server page (page.tsx) and the client island (ClaimInteractive.tsx).
import type { EdgeDetail } from "@/lib/claim-detail";

export const CLAIM_TYPE_LABEL: Record<string, string> = {
  EMPIRICAL: "Empirical",
  INSTITUTIONAL: "Institutional",
  INTERPRETIVE: "Interpretive",
  HYBRID: "Hybrid",
};

export const CLAIM_TYPE_TOOLTIP: Record<string, string> = {
  EMPIRICAL: "A factual claim grounded in observable, measurable evidence",
  INSTITUTIONAL: "A claim about laws, rules, or official decisions by institutions",
  INTERPRETIVE: "A claim that involves inference or expert judgment",
  HYBRID: "Combines empirical data with institutional or interpretive framing",
};

export const EPISTEMIC_BADGE: Record<string, { label: string; style: string }> = {
  confirmed:         { label: "Confirmed ✓",      style: "bg-green-900/70 text-green-300 border border-green-700/50" },
  retracted:         { label: "Retracted ✗",      style: "bg-red-900/70 text-red-300 border border-red-700/50" },
  candidate:         { label: "Candidate",         style: "bg-yellow-900/70 text-yellow-300 border border-yellow-700/50" },
  false_positive:    { label: "False Positive",    style: "bg-gray-700/70 text-gray-400 border border-gray-600/50" },
  contested_dissent: { label: "Split Decision",    style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
  registered_trial:  { label: "Registered Trial",  style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  active_trial:      { label: "Active Trial",      style: "bg-blue-900/70 text-blue-300 border border-blue-700/50" },
  completed_trial:   { label: "Completed Trial",   style: "bg-cyan-900/70 text-cyan-300 border border-cyan-700/50" },
  approved:          { label: "FDA Approved",      style: "bg-emerald-900/70 text-emerald-300 border border-emerald-700/50" },
  established:       { label: "Established",       style: "bg-teal-900/70 text-teal-300 border border-teal-700/50" },
  settled_judgment:  { label: "Settled Judgment",  style: "bg-indigo-900/70 text-indigo-300 border border-indigo-700/50" },
  contested:         { label: "Contested",         style: "bg-orange-900/70 text-orange-300 border border-orange-700/50" },
};

export function latestScore(edge: EdgeDetail) {
  return edge.revisions.at(-1)?.newScore ?? 50;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" });
}
