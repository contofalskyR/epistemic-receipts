import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import DomainRecentMoves from "@/app/components/DomainRecentMoves";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import ChemistryClient from "./ChemistryClient";

export const metadata: Metadata = {
  title: "Chemistry — Epistemic Receipts",
  description: "A field guide to chemistry: atomic theory through reaction mechanisms, and the curated trajectories that trace how chemical claims settled.",
};

export default function ChemistryPage() {
  const flagship = DOMAIN_FLAGSHIP["chemistry"];
  return (
    <div>
      <FieldGuideBanner
        domain="Chemistry"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in chemistry"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["chemistry"] as string[]}
      />
      <DomainRecentMoves trajectoryIds={DOMAIN_TRAJECTORIES["chemistry"]} />
      <ChemistryClient />
    </div>
  );
}
