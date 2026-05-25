import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";
import GlobeClient from "./GlobeClient";

type RawRow = { country: string; claim_count: bigint };

async function getDensity(): Promise<Array<{ countryCode: string; countryName: string; claimCount: number }>> {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT pc.country, COUNT(e.id) AS claim_count
    FROM "PoliticalContext" pc
    JOIN "Source" s ON pc."sourceId" = s.id
    JOIN "Edge" e ON e."sourceId" = s.id AND e.deleted = false
    GROUP BY pc.country
    ORDER BY claim_count DESC
  `;

  return rows
    .map((row) => {
      const countryCode = COUNTRY_NAME_TO_CODE[row.country];
      return countryCode
        ? { countryCode, countryName: row.country, claimCount: Number(row.claim_count) }
        : null;
    })
    .filter((r): r is { countryCode: string; countryName: string; claimCount: number } => r !== null);
}

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Globe — Epistemic Receipts",
  description: "Claim density by country, visualized on an interactive 3D globe",
};

export default async function GlobePage() {
  const density = await getDensity();

  return (
    <div>
      <div className="mb-3">
        <h1 className="text-xl font-semibold text-white">Claim Density Globe</h1>
        <p className="text-sm text-gray-400">
          Countries colored by number of linked claims. Click a country to see recent claims.
        </p>
      </div>
      {/* Full-bleed container that escapes max-w-3xl */}
      <div style={{ width: "100vw", marginLeft: "calc(-50vw + 50%)" }}>
        <Suspense
          fallback={
            <div
              className="flex items-center justify-center bg-gray-950"
              style={{ height: "90vh" }}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
                <p className="text-gray-400 text-sm">Loading globe…</p>
              </div>
            </div>
          }
        >
          <GlobeClient density={density} />
        </Suspense>
      </div>
    </div>
  );
}
