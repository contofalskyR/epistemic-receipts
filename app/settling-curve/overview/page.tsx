import type { Metadata } from "next";
import CurveOverview from "./CurveOverview";

export const metadata: Metadata = {
  title: "Retraction Distribution — Epistemic Receipts",
  description:
    "Aggregate view of 5,700+ retraction trajectories: survival-time distribution, detection trend, and curated expert-to-institutional lags.",
};

export default function CurveOverviewPage() {
  return <CurveOverview />;
}
