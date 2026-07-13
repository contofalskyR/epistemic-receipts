import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import PublicHealthClient from "./PublicHealthClient";

export const metadata: Metadata = {
  title: "Public Health — Epistemic Receipts",
  description: "A field guide to public health: epidemiology, population medicine, and the curated trajectories that trace how major public health claims settled.",
};

export default function PublicHealthPage() {
  const flagship = DOMAIN_FLAGSHIP["public-health"];
  return (
    <div>
      <FieldGuideBanner
        domain="Public Health"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in public health"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["public-health"] as string[]}
      />
      <PublicHealthClient />
    </div>
  );
}
