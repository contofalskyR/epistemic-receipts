import { Suspense } from "react";
import StockActClient from "./StockActClient";
import { prisma } from "@/lib/prisma";

export const revalidate = 300;

export const metadata = {
  title: "Congressional Stock Trades — Epistemic Receipts",
  description:
    "Periodic Transaction Reports filed by members of Congress under the STOCK Act of 2012. Filter by chamber, party, and ticker.",
};

async function getStats() {
  const claims = await prisma.claim.findMany({
    where: { ingestedBy: "congress_stock_act_v1", deleted: false },
    select: { metadata: true },
  });

  const members = new Set<string>();
  const tickers = new Set<string>();

  for (const c of claims) {
    const m = c.metadata as Record<string, unknown>;
    if (m?.member_name) members.add(m.member_name as string);
    if (m?.ticker) tickers.add(m.ticker as string);
  }

  return {
    total: claims.length,
    members: members.size,
    tickers: tickers.size,
  };
}

export default async function StockActPage() {
  const stats = await getStats();

  return (
    <Suspense fallback={<p className="text-sm text-gray-500 p-8">Loading…</p>}>
      <StockActClient initialStats={stats} />
    </Suspense>
  );
}
