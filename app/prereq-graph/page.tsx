import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import PrereqGraphClient from "./PrereqGraphClient";

export const revalidate = 3600;

export const metadata = {
  title: "Evidence Chains — Epistemic Receipts",
  description:
    "How claims connect: trials → approvals → outcomes. Browse the citation graph of 4.8M+ linked claims.",
};

async function getStats() {
  // Both counts are cached by ISR (revalidate 3600) — keep them live rather
  // than hardcoding totals that drift as pipelines run.
  const [linked, relations] = await Promise.all([
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT "fromClaimId") AS count
       FROM "ClaimRelation"
       WHERE "relationType" IN ('CITES', 'SUPERSEDED_BY', 'OUTCOME')`
    ),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(*) AS count FROM "ClaimRelation"`
    ),
  ]);
  return {
    claimsWithLinks: Number(linked[0]?.count ?? 0),
    totalRelations: Number(relations[0]?.count ?? 0),
  };
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
