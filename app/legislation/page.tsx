import { Suspense } from "react";
import LegislationClient from "./LegislationClient";
import LegislationStats from "./LegislationStats";
import DomainCurveRail from "../components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Legislation — Epistemic Receipts",
  description: "Global legislation tracker — bills and laws across 52 countries spanning Americas, Europe, Asia-Pacific, and Africa. Live status for US Congress, Canadian Parliament, and New Zealand Parliament; bulk records for the rest.",
};

export default function LegislationPage() {
  return (
    <div className="space-y-0">
      <div className="max-w-6xl mx-auto px-6 pt-8">
        <FieldGuideBanner
          domain="Legislation"
          curatedHref="/settling-curve?t=roe-dobbs"
          curatedLabel="Roe → Dobbs trajectory"
        />
      </div>
      {/* Curve-first (briefings/07): lead with legislative trajectories — how
          bills and legal claims moved through institutions and courts — before
          the country tables. Grows automatically as wave 3 adds bill outcomes. */}
      <Suspense fallback={null}>
        <DomainCurveRail
          title="Landmark legal arcs — hand-curated"
          subtitle="Six curated constitutional trajectories, traced receipt by receipt. They are the exception, not the rule: the hundreds of thousands of enacted laws below are single-event records by design — an enactment is born settled, and we don't invent motion. Bill lifecycles (introduced → passed or died) become real curves when the congress-tracker backfill lands."
          pipelines={[
            "law-settler",          // curated legal settling curves (the prototype for this vision)
            "seed-court-reversals", // curated court-reversal arcs
            "congress_bills_tracker_v1",
            "congress_v1",
            "nz_repealed_acts_v1",
          ]}
        />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-gray-500">Loading bills…</p>}>
        <LegislationClient />
      </Suspense>
      <Suspense fallback={null}>
        <LegislationStats />
      </Suspense>
    </div>
  );
}
