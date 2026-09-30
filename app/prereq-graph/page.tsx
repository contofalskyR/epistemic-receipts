import { Suspense } from "react";
import { countLinkedClaims, countRelations } from "@/lib/prereq-graph";
import PrereqGraphClient from "./PrereqGraphClient";

export const revalidate = 3600;

// No corpus numbers in metadata — it is built at compile time and a typed
// figure drifts from the DB (the old text said "4.8M+ linked claims", which
// was the relation count, not a claim count).
export const metadata = {
  title: "Evidence Chains — Epistemic Receipts",
  description:
    "How claims connect: trials → approvals → outcomes. Browse the citation graph of linked claims.",
};

async function getStats() {
  // Both counts are cached by ISR (revalidate 3600) — keep them live rather
  // than hardcoding totals that drift as pipelines run. The header figure is
  // the SAME query the list body runs with no filter (lib/prereq-graph.ts), so
  // "N claims with links" can never disagree with "N claims — page 1 of M".
  const [claimsWithLinks, totalRelations] = await Promise.all([
    countLinkedClaims(),
    countRelations(),
  ]);
  return { claimsWithLinks, totalRelations };
}

export default async function PrereqGraphPage() {
  const stats = await getStats();
  return (
    <Suspense
      fallback={<p style={{ padding: "2rem", color: "#888898" }}>Loading…</p>}
    >
      <PrereqGraphClient initialStats={stats} />
    </Suspense>
  );
}
