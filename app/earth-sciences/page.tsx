import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import EarthSciencesClient from "./EarthSciencesClient";

export const metadata: Metadata = {
  title: "Earth Sciences — Epistemic Receipts",
  description: "A field guide to earth sciences: geology, geophysics, climatology, and the curated trajectories that trace how foundational earth-science claims settled.",
};

export default function EarthSciencesPage() {
  const flagship = DOMAIN_FLAGSHIP["earth-sciences"];
  return (
    <div>
      <FieldGuideBanner
        domain="Earth Sciences"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in earth sciences"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["earth-sciences"] as string[]}
      />
      <EarthSciencesClient />
    </div>
  );
}
