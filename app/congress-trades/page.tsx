import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import CongressTradesClient from "./CongressTradesClient";

export const revalidate = 300;

export const metadata = {
  title: "Congress Trades — Epistemic Receipts",
  description:
    "STOCK Act Periodic Transaction Reports from House and Senate members, cross-referenced with legislative votes.",
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

  return { total: claims.length, members: members.size, tickers: tickers.size };
}

export default async function CongressTradesPage() {
  const stats = await getStats();

  return (
    <Suspense fallback={<p style={{ padding: "2rem", color: "#888898" }}>Loading…</p>}>
      <CongressTradesClient initialStats={stats} />
    </Suspense>
  );
}
