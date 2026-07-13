import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import PharmacologyClient from "./PharmacologyClient";

export const metadata: Metadata = {
  title: "Pharmacology — Epistemic Receipts",
  description: "A field guide to pharmacology: drug classes, mechanisms, and the curated trajectories that trace how major drugs were developed and approved.",
};

export default function PharmacologyPage() {
  const flagship = DOMAIN_FLAGSHIP["pharmacology"];
  return (
    <div>
      <FieldGuideBanner
        domain="Pharmacology"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in pharmacology"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["pharmacology"] as string[]}
      />
      <PharmacologyClient />
    </div>
  );
}
