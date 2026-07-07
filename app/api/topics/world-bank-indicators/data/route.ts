import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;
const INGESTED_BY = "worldbank_v1";

type IndicatorRow = { code: string; label: string; unit: string; n: bigint };
type CountryRow = { iso3: string; name: string; n: bigint };
type SeriesRow = { iso3: string; name: string; year: number; value: number };
type ClaimRow = {
  id: string;
  text: string;
  currentStatus: string;
  claimType: string;
  iso3: string;
  countryName: string;
  year: number;
  value: number;
  indicatorCode: string;
  indicatorLabel: string;
};

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const indicator = params.get("indicator") ?? "";
  const countryQuery = (params.get("country") ?? "").trim();
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));

  const baseFilter = Prisma.sql`
    "ingestedBy" = ${INGESTED_BY}
    AND "deleted" = false
    AND "verificationStatus" != 'DEPRECATED'
  `;

  const indicatorRows = await prisma.$queryRaw<IndicatorRow[]>`
    SELECT
      (metadata->>'indicatorCode') as code,
      (metadata->>'indicatorLabel') as label,
      (metadata->>'unit') as unit,
      COUNT(*) as n
    FROM "Claim"
    WHERE ${baseFilter}
    GROUP BY 1, 2, 3
    ORDER BY n DESC
  `;
  const indicators = indicatorRows.map(r => ({
    code: r.code,
    label: r.label,
    unit: r.unit,
    claimCount: Number(r.n),
  }));

  const indicatorClause = indicator
    ? Prisma.sql`AND (metadata->>'indicatorCode') = ${indicator}`
    : Prisma.empty;

  const countryRows = await prisma.$queryRaw<CountryRow[]>`
    SELECT
      (metadata->>'countryIso3') as iso3,
      (metadata->>'countryName') as name,
      COUNT(*) as n
    FROM "Claim"
    WHERE ${baseFilter}
    ${indicatorClause}
    GROUP BY 1, 2
    ORDER BY name ASC
  `;
  const countriesAll = countryRows.map(r => ({
    iso3: r.iso3,
    name: r.name,
    claimCount: Number(r.n),
  }));

  const lcQuery = countryQuery.toLowerCase();
  const countries = countryQuery
    ? countriesAll.filter(c => c.name.toLowerCase().includes(lcQuery))
    : countriesAll;

  const seriesByIso3: Record<string, { name: string; points: { year: number; value: number }[] }> = {};
  let defaultSelectedIso3: string[] = [];
  if (indicator) {
    const seriesRows = await prisma.$queryRaw<SeriesRow[]>`
      SELECT
        (metadata->>'countryIso3') as iso3,
        (metadata->>'countryName') as name,
        (metadata->>'year')::int as year,
        (metadata->>'value')::float8 as value
      FROM "Claim"
      WHERE ${baseFilter}
      AND (metadata->>'indicatorCode') = ${indicator}
      ORDER BY (metadata->>'countryIso3') ASC, (metadata->>'year')::int ASC
    `;
    for (const r of seriesRows) {
      if (!seriesByIso3[r.iso3]) seriesByIso3[r.iso3] = { name: r.name, points: [] };
      seriesByIso3[r.iso3].points.push({ year: r.year, value: r.value });
    }
    const preferred = ["USA", "CHN", "DEU", "JPN", "GBR", "FRA", "IND", "BRA", "RUS", "CAN"];
    defaultSelectedIso3 = preferred.filter(iso => seriesByIso3[iso]).slice(0, 5);
    if (defaultSelectedIso3.length === 0) {
      defaultSelectedIso3 = Object.keys(seriesByIso3).slice(0, 5);
    }
  }

  // Claim list filters
  const filterIso3 = countryQuery ? countries.map(c => c.iso3) : null;
  const countryClause =
    filterIso3 !== null && filterIso3.length > 0
      ? Prisma.sql`AND (metadata->>'countryIso3') IN (${Prisma.join(filterIso3)})`
      : filterIso3 !== null && filterIso3.length === 0
        ? Prisma.sql`AND 1 = 0`
        : Prisma.empty;

  const totalRows = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT COUNT(*) as n FROM "Claim"
    WHERE ${baseFilter}
    ${indicatorClause}
    ${countryClause}
  `;
  const total = Number(totalRows[0]?.n ?? 0);

  const claims = await prisma.$queryRaw<ClaimRow[]>`
    SELECT
      id,
      text,
      "currentStatus",
      "claimType",
      (metadata->>'countryIso3') as iso3,
      (metadata->>'countryName') as "countryName",
      (metadata->>'year')::int as year,
      (metadata->>'value')::float8 as value,
      (metadata->>'indicatorCode') as "indicatorCode",
      (metadata->>'indicatorLabel') as "indicatorLabel"
    FROM "Claim"
    WHERE ${baseFilter}
    ${indicatorClause}
    ${countryClause}
    ORDER BY (metadata->>'countryName') ASC, (metadata->>'year')::int DESC
    LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}
  `;

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const res = NextResponse.json({
    indicator,
    indicators,
    countries,
    countriesTotal: countriesAll.length,
    seriesByIso3,
    defaultSelectedIso3,
    claims,
    page,
    pages,
    total,
    pageSize: PAGE_SIZE,
  });
  res.headers.set("Cache-Control", "s-maxage=60, stale-while-revalidate=600");
  return res;
}
