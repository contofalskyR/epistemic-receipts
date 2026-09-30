import type { Metadata } from "next";
import EpistemicCoverage from "./EpistemicCoverage";

// No corpus numbers in metadata — a typed figure drifts from the DB (this one
// said "1M+" against a 1.76M corpus).
export const metadata: Metadata = {
  title: "Epistemic Coverage — Epistemic Receipts",
  description:
    "Which claims have a typed epistemic entry point. Breakdown by status, ratifying community, domain, and century.",
};

export default function EpistemicCoveragePage() {
  return <EpistemicCoverage />;
}
