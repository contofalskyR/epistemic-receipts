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
  const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(DISTINCT "fromClaimId") AS count
     FROM "ClaimRelation"
     WHERE "relationType" IN ('cites', 'SUPERSEDED_BY', 'OUTCOME')`
  );
  return { claimsWithLinks: Number(result[0]?.count ?? 0) };
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
