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
  const foreignCountries = COUNTRY_REGISTRY.filter((c) => c.code !== "us");
  const foreignIngested = foreignCountries.map((c) => c.ingestedBy);

  const [totalResult, perCountry] = await Promise.all([
    prisma.claim.count({
      where: {
        ingestedBy: { in: foreignIngested },
        deleted: false,
        NOT: { verificationStatus: "DEPRECATED" },
      },
    }),
    prisma.claim.groupBy({
      by: ["ingestedBy"],
      where: {
        ingestedBy: { in: foreignIngested },
        deleted: false,
        NOT: { verificationStatus: "DEPRECATED" },
      },
      _count: { id: true },
    }),
  ]);

  const countryCounts: Record<string, number> = {};
  for (const row of perCountry) {
    countryCounts[row.ingestedBy] = row._count.id;
  }

  return { total: totalResult, countryCounts };
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
