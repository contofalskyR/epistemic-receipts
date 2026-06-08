import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import ForeignLegislationClient from "./ForeignLegislationClient";
import { COUNTRY_REGISTRY } from "@/lib/legislation-countries";

export const revalidate = 3600;

export const metadata = {
  title: "Global Legislation — Epistemic Receipts",
  description:
    "Laws and legislative acts from around the world — Europe, Asia-Pacific, Americas, and Africa.",
};

async function getStats() {
  const foreignIngested = COUNTRY_REGISTRY.filter((c) => c.code !== "us").map(
    (c) => c.ingestedBy
  );
  const total = await prisma.claim.count({
    where: {
      ingestedBy: { in: foreignIngested },
      deleted: false,
      NOT: { verificationStatus: "DEPRECATED" },
    },
  });
  return { total };
}

export default async function ForeignLegislationPage() {
  const stats = await getStats();
  return (
    <Suspense
      fallback={<p style={{ padding: "2rem", color: "#888898" }}>Loading…</p>}
    >
      <ForeignLegislationClient initialStats={stats} />
    </Suspense>
  );
}
