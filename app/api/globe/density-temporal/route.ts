import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";
import { PIPELINE_COUNTRY, PIPELINE_COUNTRY_NAME } from "@/lib/globe-pipeline-country";

export const dynamic = "force-dynamic";

type RawPcRow = { country: string; claim_count: bigint };
type RawPipelineRow = { ingestedBy: string; claim_count: bigint };

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const beforeParam = searchParams.get("before");
  const statusParam = searchParams.get("status");
  const claimTypeParam = searchParams.get("claimType");

  const beforeYear = beforeParam ? parseInt(beforeParam, 10) : null;
  const statuses = statusParam ? statusParam.split(",").filter(Boolean) : null;
  const claimTypes = claimTypeParam ? claimTypeParam.split(",").filter(Boolean) : null;

  const whereClauses: string[] = ["deleted = false"];
  const params: (string | number | Date | string[])[] = [];
  let paramIndex = 1;

  if (beforeYear !== null && !isNaN(beforeYear)) {
    const beforeDate = yearToDate(beforeYear);
    whereClauses.push(`"claimEmergedAt" IS NOT NULL AND "claimEmergedAt" <= $${paramIndex}`);
    params.push(beforeDate);
    paramIndex++;
  }

  if (statuses && statuses.length > 0) {
    whereClauses.push(`"currentStatus" = ANY($${paramIndex}::text[])`);
    params.push(statuses);
    paramIndex++;
  }

  if (claimTypes && claimTypes.length > 0) {
    whereClauses.push(`"claimType" = ANY($${paramIndex}::text[])`);
    params.push(claimTypes);
    paramIndex++;
  }

  const whereClause = whereClauses.join(" AND ");

  const pipelineQuery = `
    SELECT "ingestedBy", COUNT(*) AS claim_count
    FROM "Claim"
    WHERE ${whereClause}
    GROUP BY "ingestedBy"
  `;

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM "Claim"
    WHERE ${whereClause}
  `;

  const [pipelineRows, countResult, pcRows] = await Promise.all([
    prisma.$queryRawUnsafe<RawPipelineRow[]>(pipelineQuery, ...params),
    prisma.$queryRawUnsafe<[{ total: bigint }]>(countQuery, ...params),
    prisma.$queryRaw<RawPcRow[]>`
      SELECT pc.country, COUNT(e.id) AS claim_count
      FROM "PoliticalContext" pc
      JOIN "Source" s ON pc."sourceId" = s.id
      JOIN "Edge" e ON e."sourceId" = s.id AND e.deleted = false
      GROUP BY pc.country
    `,
  ]);

  const totalClaimCount = Number(countResult[0]?.total ?? 0);

  const totals = new Map<string, { countryName: string; claimCount: number }>();

  if (beforeYear === null && !statuses && !claimTypes) {
    for (const row of pcRows) {
      const code = COUNTRY_NAME_TO_CODE[row.country];
      if (!code) continue;
      const existing = totals.get(code);
      const n = Number(row.claim_count);
      if (existing) existing.claimCount += n;
      else totals.set(code, { countryName: row.country, claimCount: n });
    }
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

  return NextResponse.json({ countries: result, totalClaimCount });
}

function yearToDate(year: number): Date {
  if (year >= 0) {
    return new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));
  }
  const bceYear = Math.abs(year) + 1;
  const jsYear = 1 - bceYear;
  return new Date(Date.UTC(jsYear, 11, 31, 23, 59, 59, 999));
}
