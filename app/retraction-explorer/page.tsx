import { Suspense } from "react";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";
import RetractionExplorerClient from "./RetractionExplorerClient";

// Dynamic, with the stats cached for an hour (front door phase 6). As an ISR
// page it was prerendered without a query string, so after a deep link
// (?q=cancer) the client router kept a route-cache entry from hydration that
// pointed at that query, and for the 300 s static stale time every <Link> or
// router navigation to /retraction-explorer — the nav item, the homepage
// cards, /reversals — landed back on ?q=cancer. Rendered per request, the
// payload carries the real query and no such entry can form. The filters
// themselves move the URL with history.pushState (RetractionExplorerClient).
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Retraction Explorer — Epistemic Receipts",
  description:
    "26,600+ retracted papers indexed via Crossref. Search by title, author, or journal and trace the citation half-life of bad science.",
};

const getStats = unstable_cache(async () => {
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
}, ["retraction-explorer-stats"], { revalidate: 3600 });

export default async function RetractionExplorerPage() {
  const stats = await getStats();

  return (
    <Suspense fallback={<p style={{ padding: "2rem", color: "#888898" }}>Loading…</p>}>
      <RetractionExplorerClient initialStats={stats} />
    </Suspense>
  );
}
