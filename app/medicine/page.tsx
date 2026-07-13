import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import DomainRecentMoves from "@/app/components/DomainRecentMoves";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import MedicineClient from "./MedicineClient";

export const metadata: Metadata = {
  title: "Medicine — Epistemic Receipts",
  description: "A field guide to clinical medicine: 20 families, landmark discoveries, live disputes, and the curated trajectories that trace how medical knowledge changed.",
};

export default function MedicinePage() {
  const flagship = DOMAIN_FLAGSHIP["medicine"];
  return (
    <div>
      <FieldGuideBanner
        domain="Medicine"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in medicine"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["medicine"] as string[]}
      />
      <DomainRecentMoves trajectoryIds={DOMAIN_TRAJECTORIES["medicine"]} />
      <MedicineClient />
    </div>
  );
}
