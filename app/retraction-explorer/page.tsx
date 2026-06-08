import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import RetractionExplorerClient from "./RetractionExplorerClient";

export const revalidate = 3600;

export const metadata = {
  title: "Retraction Explorer — Epistemic Receipts",
  description:
    "26,600+ retracted papers indexed via Crossref. Search by title, author, or journal and trace the citation half-life of bad science.",
};

async function getStats() {
  const [total, journalResult] = await Promise.all([
    prisma.claim.count({
      where: { ingestedBy: "crossref_retractions_v1", deleted: false },
    }),
    prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
      `SELECT COUNT(DISTINCT metadata->>'journal') as count
       FROM "Claim"
       WHERE "ingestedBy" = 'crossref_retractions_v1'
         AND deleted = false
         AND metadata->>'journal' IS NOT NULL`
    ),
  ]);

  return {
    total,
    journals: Number(journalResult[0]?.count ?? 0),
  };
}

export default async function RetractionExplorerPage() {
  const stats = await getStats();

  return (
    <Suspense fallback={<p style={{ padding: "2rem", color: "#888898" }}>Loading…</p>}>
      <RetractionExplorerClient initialStats={stats} />
    </Suspense>
  );
}
