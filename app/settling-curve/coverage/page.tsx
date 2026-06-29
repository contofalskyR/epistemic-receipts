import type { Metadata } from "next";
import EpistemicCoverage from "./EpistemicCoverage";

export const metadata: Metadata = {
  title: "Epistemic Coverage — Epistemic Receipts",
  description:
    "1M+ claims now have a typed epistemic entry point. Breakdown by status, ratifying community, domain, and century.",
};

export default function EpistemicCoveragePage() {
  return <EpistemicCoverage />;
}
