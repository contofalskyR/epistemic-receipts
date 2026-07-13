import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import LawClient from "./LawClient";

export const metadata: Metadata = {
  title: "Law — Epistemic Receipts",
  description: "A field guide to law: constitutional, civil, criminal, and international law, with curated trajectories tracing how landmark legal claims settled or were overruled.",
};

export default function LawPage() {
  const flagship = DOMAIN_FLAGSHIP["law"];
  return (
    <div>
      <FieldGuideBanner
        domain="Law"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in law"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["law"] as string[]}
      />
      <LawClient />
    </div>
  );
}
