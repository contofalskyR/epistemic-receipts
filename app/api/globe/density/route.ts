import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";
import { PIPELINE_COUNTRY, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";
import { CATEGORY_PIPELINES, isCategorySlug } from "@/lib/globe-categories";

export const revalidate = 3600;

type RawPcRow = { country: string; claim_count: bigint };
type RawPipelineRow = { ingestedBy: string; claim_count: bigint };

export async function GET(request: NextRequest) {
  const categoryParam = request.nextUrl.searchParams.get("category");
  const category = isCategorySlug(categoryParam) ? categoryParam : null;
  const pipelineWhitelist = category ? new Set(CATEGORY_PIPELINES[category]) : null;

  const pipelinePromise = pipelineWhitelist
    ? prisma.$queryRaw<RawPipelineRow[]>`
        SELECT "ingestedBy", COUNT(*) AS claim_count
        FROM "Claim"
        WHERE deleted = false AND "ingestedBy" = ANY(${Array.from(pipelineWhitelist)}::text[])
        GROUP BY "ingestedBy"
      `
    : prisma.$queryRaw<RawPipelineRow[]>`
        SELECT "ingestedBy", COUNT(*) AS claim_count
        FROM "Claim"
        WHERE deleted = false
        GROUP BY "ingestedBy"
      `;

  // When a category is selected we skip the PoliticalContext sweep because
  // PoliticalContext is keyed on Source country, not on pipeline tag — adding
  // it would mix cross-category source-country claims into the category total.
  // This matches density-temporal.ts which also skips PC when any filter is set.
  const pcPromise: Promise<RawPcRow[]> = pipelineWhitelist
    ? Promise.resolve([] as RawPcRow[])
    : prisma.$queryRaw<RawPcRow[]>`
        SELECT pc.country, COUNT(e.id) AS claim_count
        FROM "PoliticalContext" pc
        JOIN "Source" s ON pc."sourceId" = s.id
        JOIN "Edge" e ON e."sourceId" = s.id AND e.deleted = false
        GROUP BY pc.country
      `;

  const [pipelineRows, pcRows] = await Promise.all([pipelinePromise, pcPromise]);

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
