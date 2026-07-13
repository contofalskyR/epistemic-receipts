import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import GeologyClient from "./GeologyClient";

export const metadata: Metadata = {
  title: "Geology — Epistemic Receipts",
  description: "A field guide to geology: minerals, rock cycles, plate tectonics, and the curated trajectories that trace how geological claims settled.",
};

export default function GeologyPage() {
  const flagship = DOMAIN_FLAGSHIP["geology"];
  return (
    <div>
      <FieldGuideBanner
        domain="Geology"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in geology"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["geology"] as string[]}
      />
      <GeologyClient />
    </div>
  );
}
