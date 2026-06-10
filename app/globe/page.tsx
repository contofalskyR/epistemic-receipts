import { Suspense } from "react";
import GlobeClient from "./GlobeClient";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";
import { PIPELINE_COUNTRY, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";

async function getDensity(): Promise<Array<{ countryCode: string; countryName: string; claimCount: number }>> {
  try {
    type RawPcRow = { country: string; claim_count: bigint };
    type RawPipelineRow = { ingestedBy: string; claim_count: bigint };

    const [pcRows, pipelineRows] = await Promise.all([
      prisma.$queryRaw<RawPcRow[]>`
        SELECT pc.country, COUNT(e.id) AS claim_count
        FROM "PoliticalContext" pc
        JOIN "Source" s ON pc."sourceId" = s.id
        JOIN "Edge" e ON e."sourceId" = s.id AND e.deleted = false
        GROUP BY pc.country
      `,
      prisma.$queryRaw<RawPipelineRow[]>`
        SELECT "ingestedBy", COUNT(*) AS claim_count
        FROM "Claim"
        WHERE deleted = false
        GROUP BY "ingestedBy"
      `,
    ]);

    const totals = new Map<string, { countryName: string; claimCount: number }>();

    for (const row of pcRows) {
      const code = COUNTRY_NAME_TO_CODE[row.country];
      if (!code) continue;
      const existing = totals.get(code);
      const n = Number(row.claim_count);
      if (existing) existing.claimCount += n;
      else totals.set(code, { countryName: row.country, claimCount: n });
    }

    for (const row of pipelineRows) {
      const code = PIPELINE_COUNTRY[row.ingestedBy];
      if (!code) continue;
      const n = Number(row.claim_count);
      const existing = totals.get(code);
      if (existing) existing.claimCount += n;
      else totals.set(code, { countryName: PIPELINE_COUNTRY_NAME[code] ?? code, claimCount: n });
    }

    return Array.from(totals.entries())
      .map(([countryCode, { countryName, claimCount }]) => ({ countryCode, countryName, claimCount }))
      .sort((a, b) => b.claimCount - a.claimCount);
  } catch {
    return [];
  }
}

export const revalidate = 3600;

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
          Every glowing point is a cluster of claims — brighter means denser. Click a country to browse its claims.
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
