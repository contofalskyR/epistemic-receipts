import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import PhysicsClient from "./PhysicsClient";

export const metadata: Metadata = {
  title: "Physics — Epistemic Receipts",
  description: "A field guide to physics: classical mechanics through quantum fields, and the curated trajectories that trace how physical claims settled or unraveled.",
};

export default function PhysicsPage() {
  const flagship = DOMAIN_FLAGSHIP["physics"];
  return (
    <div>
      <FieldGuideBanner
        domain="Physics"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in physics"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["physics"] as string[]}
      />
      <PhysicsClient />
    </div>
  );
}
