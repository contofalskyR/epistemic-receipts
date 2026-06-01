import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_CODE_TO_NAME } from "@/lib/countryCodeMap";

export const revalidate = 300;

// ISO 3166-1 alpha-2 → alpha-3 covering all codes used in PIPELINE_COUNTRY
const ALPHA2_TO_ALPHA3: Record<string, string> = {
  US: "USA", GB: "GBR", DE: "DEU", FR: "FRA", IT: "ITA", ES: "ESP",
  PT: "PRT", NL: "NLD", BE: "BEL", SE: "SWE", DK: "DNK", FI: "FIN",
  NO: "NOR", AT: "AUT", CH: "CHE", IE: "IRL", PL: "POL", CZ: "CZE",
  HU: "HUN", SK: "SVK", SI: "SVN", HR: "HRV", RO: "ROU", BG: "BGR",
  RS: "SRB", EE: "EST", LV: "LVA", LT: "LTU", CY: "CYP", MT: "MLT",
  IS: "ISL", LU: "LUX", GE: "GEO", RU: "RUS", CA: "CAN", MX: "MEX",
  BR: "BRA", AR: "ARG", CL: "CHL", CO: "COL", PE: "PER", UY: "URY",
  CR: "CRI", JM: "JAM", TT: "TTO", JP: "JPN", KR: "KOR", CN: "CHN",
  IN: "IND", ID: "IDN", MY: "MYS", SG: "SGP", TH: "THA", PH: "PHL",
  AU: "AUS", TW: "TWN", LK: "LKA", PK: "PAK", BD: "BGD", BN: "BRN",
  AE: "ARE", KE: "KEN", ZA: "ZAF", IL: "ISR",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const countryAlpha2 = (searchParams.get("country") ?? "").toUpperCase();
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset = Math.max(parseInt(searchParams.get("offset") ?? "0", 10), 0);

  if (!countryAlpha2) {
    return NextResponse.json({ error: "Missing country parameter" }, { status: 400 });
  }

  const countryName = COUNTRY_CODE_TO_NAME[countryAlpha2];
  if (!countryName) {
    return NextResponse.json({ error: "Unknown country code" }, { status: 404 });
  }

  const alpha3 = ALPHA2_TO_ALPHA3[countryAlpha2];
  if (!alpha3) {
    return NextResponse.json({ claims: [], total: 0, countryCode: countryAlpha2, countryName });
  }

  const polities = await prisma.polity.findMany({
    where: { countryCode: alpha3 },
    select: { id: true },
  });

  if (polities.length === 0) {
    return NextResponse.json({ claims: [], total: 0, countryCode: countryAlpha2, countryName });
  }

  const polityIds = polities.map((p) => p.id);

  const where = {
    deleted: false,
    polityLinks: {
      some: { polityId: { in: polityIds } },
    },
  } as const;

  const [total, claims] = await Promise.all([
    prisma.claim.count({ where }),
    prisma.claim.findMany({
      where,
      select: {
        id: true,
        text: true,
        currentStatus: true,
        verificationStatus: true,
        ingestedBy: true,
        claimEmergedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      skip: offset,
    }),
  ]);

  return NextResponse.json({ claims, total, countryCode: countryAlpha2, countryName });
}
