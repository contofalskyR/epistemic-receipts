import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import AstronomyClient from "./AstronomyClient";

export const metadata: Metadata = {
  title: "Astronomy — Epistemic Receipts",
  description: "A field guide to astronomy: observational techniques, solar system, stellar and galactic astronomy, cosmology, and the curated trajectories that trace how astronomical claims settled.",
};

export default function AstronomyPage() {
  const flagship = DOMAIN_FLAGSHIP["astronomy"];
  return (
    <div>
      <FieldGuideBanner
        domain="Astronomy"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in astronomy"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["astronomy"] as string[]}
      />
      <AstronomyClient />
    </div>
  );
}
