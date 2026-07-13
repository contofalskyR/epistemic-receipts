import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import DomainRecentMoves from "@/app/components/DomainRecentMoves";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import EnvironmentalScienceClient from "./EnvironmentalScienceClient";

export const metadata: Metadata = {
  title: "Environmental Science — Epistemic Receipts",
  description: "A field guide to environmental science: ecology, climate, pollution, and the curated trajectories that trace how environmental claims settled.",
};

export default function EnvironmentalSciencePage() {
  const flagship = DOMAIN_FLAGSHIP["environmental-science"];
  return (
    <div>
      <FieldGuideBanner
        domain="Environmental Science"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in environmental science"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["environmental-science"] as string[]}
      />
      <DomainRecentMoves trajectoryIds={DOMAIN_TRAJECTORIES["environmental-science"]} />
      <EnvironmentalScienceClient />
    </div>
  );
}
