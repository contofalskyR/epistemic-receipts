import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";
import { PIPELINE_COUNTRY, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type RawPcRow = { country: string; claim_count: bigint };
type RawPipelineRow = { ingestedBy: string; claim_count: bigint };

export async function GET() {
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

  const result = Array.from(totals.entries())
    .map(([countryCode, { countryName, claimCount }]) => ({ countryCode, countryName, claimCount }))
    .sort((a, b) => b.claimCount - a.claimCount);

  return NextResponse.json(result);
}
