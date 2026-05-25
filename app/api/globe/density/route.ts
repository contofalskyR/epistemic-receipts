import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

type RawRow = { country: string; claim_count: bigint };

export async function GET() {
  const rows = await prisma.$queryRaw<RawRow[]>`
    SELECT pc.country, COUNT(e.id) AS claim_count
    FROM "PoliticalContext" pc
    JOIN "Source" s ON pc."sourceId" = s.id
    JOIN "Edge" e ON e."sourceId" = s.id AND e.deleted = false
    GROUP BY pc.country
    ORDER BY claim_count DESC
  `;

  const result = rows
    .map((row) => {
      const countryCode = COUNTRY_NAME_TO_CODE[row.country];
      return countryCode
        ? { countryCode, countryName: row.country, claimCount: Number(row.claim_count) }
        : null;
    })
    .filter(Boolean);

  return NextResponse.json(result);
}
