import type { Metadata } from "next";
import DomainCurveRail from "@/app/components/DomainCurveRail";
import { FieldGuideBanner } from "@/components/FieldGuideBanner";
import { DOMAIN_TRAJECTORIES, DOMAIN_FLAGSHIP } from "@/lib/domain-trajectories";
import HistoryClient from "./HistoryClient";

export const metadata: Metadata = {
  title: "History — Epistemic Receipts",
  description: "A field guide to history: methods, major periods, and the curated trajectories that trace how historical claims — including landmark legislation — settled over time.",
};

export default function HistoryPage() {
  const flagship = DOMAIN_FLAGSHIP["history"];
  return (
    <div>
      <FieldGuideBanner
        domain="History"
        curatedHref={`/settling-curve?t=${flagship.slug}`}
        curatedLabel={flagship.label}
        className="max-w-6xl mx-auto px-6 pt-8"
      />
      <DomainCurveRail
        title="Traced trajectories in history"
        subtitle="Curated arcs for this field — the exception, not the rule. Most entries below are reference records in the corpus, not traced curves."
        trajectoryIds={DOMAIN_TRAJECTORIES["history"] as string[]}
      />
      <HistoryClient />
    </div>
  );
}
