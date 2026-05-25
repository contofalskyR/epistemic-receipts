import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { COUNTRY_NAME_TO_CODE } from "@/lib/countryCodeMap";

export const dynamic = "force-dynamic";
export const revalidate = 3600;

// Pipelines with a known single-country origin.
// Multi-country (UN, EU, WHO, USGS, CrossRef, etc.) are omitted — their counts
// would be misleadingly attributed to one place.
const PIPELINE_COUNTRY: Record<string, string> = {
  // United States
  openfda_labels_v1: "US", faers_normalized_drugs_v1: "US", fr_rules_v1: "US",
  sec_edgar_v1: "US", congress_bills_v1: "US", congress_votes_v1: "US", congress_v1: "US",
  propublica_congress_v1: "US", frus_v1: "US", cia_foia_v1: "US", jfk_records_v1: "US",
  nara_catalog_v1: "US", miller_center_v1: "US", loc_collections_v1: "US",
  mesh_v1: "US", rxnorm_v1: "US", fred_v1: "US",
  // Europe
  bundestag_v1: "DE", stasi_v1: "DE",
  tweedekamer_v1: "NL",
  oireachtas_v1: "IE",
  riksdag_v1: "SE",
  scotland_legislation_v1: "GB", uk_legislation_v1: "GB", uk_national_archives_v1: "GB",
  wales_senedd_v1: "GB", cwgc_v1: "GB",
  nationalrat_v1: "AT", parlament_at_v1: "AT",
  france_legislation_v1: "FR",
  italy_legislation_v1: "IT",
  spain_legislation_v1: "ES",
  portugal_legislation_v1: "PT",
  belgium_legislation_v1: "BE",
  denmark_legislation_v1: "DK",
  finland_legislation_v1: "FI",
  norway_legislation_v1: "NO",
  iceland_legislation_v1: "IS",
  luxembourg_legislation_v1: "LU",
  switzerland_legislation_v1: "CH",
  poland_legislation_v1: "PL", ipn_v1: "PL",
  czech_legislation_v1: "CZ", czech_abs_v1: "CZ",
  hungary_legislation_v1: "HU",
  slovakia_legislation_v1: "SK",
  slovenia_legislation_v1: "SI",
  croatia_legislation_v1: "HR",
  romania_legislation_v1: "RO", romania_cnsas_v1: "RO",
  bulgaria_legislation_v1: "BG",
  serbia_legislation_v1: "RS",
  estonia_legislation_v1: "EE",
  latvia_legislation_v1: "LV",
  lithuania_legislation_v1: "LT",
  cyprus_legislation_v1: "CY",
  malta_legislation_v1: "MT",
  georgia_legislation_v1: "GE",
  russia_legislation_v1: "RU",
  // Americas
  canada_bills_v1: "CA",
  mexico_legislation_v1: "MX",
  brazil_legislation_v1: "BR",
  argentina_legislation_v1: "AR",
  chile_legislation_v1: "CL",
  colombia_legislation_v1: "CO",
  peru_legislation_v1: "PE",
  uruguay_legislation_v1: "UY",
  costa_rica_legislation_v1: "CR",
  jamaica_legislation_v1: "JM",
  tt_legislation_v1: "TT",
  // Asia-Pacific
  japan_legislation_v1: "JP", jacar_v1: "JP",
  korea_legislation_v1: "KR",
  china_legislation_v1: "CN",
  india_legislation_v1: "IN",
  indonesia_legislation_v1: "ID",
  malaysia_legislation_v1: "MY",
  singapore_legislation_v1: "SG",
  thailand_legislation_v1: "TH",
  philippines_legislation_v1: "PH",
  australia_legislation_v1: "AU",
  taiwan_legislation_v1: "TW", taiwan_archives_v1: "TW",
  srilanka_legislation_v1: "LK",
  pakistan_legislation_v1: "PK",
  bangladesh_legislation_v1: "BD",
  brunei_legislation_v1: "BN",
  uae_legislation_v1: "AE",
  // Africa / Middle East
  kenya_legislation_v1: "KE",
  south_africa_legislation_v1: "ZA",
  israel_knesset_v1: "IL",
};

const PIPELINE_COUNTRY_NAME: Record<string, string> = {
  US: "United States", GB: "United Kingdom", DE: "Germany", FR: "France",
  IT: "Italy", ES: "Spain", PT: "Portugal", NL: "Netherlands", BE: "Belgium",
  SE: "Sweden", DK: "Denmark", FI: "Finland", NO: "Norway", AT: "Austria",
  CH: "Switzerland", IE: "Ireland", PL: "Poland", CZ: "Czech Republic",
  HU: "Hungary", SK: "Slovakia", SI: "Slovenia", HR: "Croatia", RO: "Romania",
  BG: "Bulgaria", RS: "Serbia", EE: "Estonia", LV: "Latvia", LT: "Lithuania",
  CY: "Cyprus", MT: "Malta", IS: "Iceland", LU: "Luxembourg", GE: "Georgia",
  RU: "Russia", CA: "Canada", MX: "Mexico", BR: "Brazil", AR: "Argentina",
  CL: "Chile", CO: "Colombia", PE: "Peru", UY: "Uruguay", CR: "Costa Rica",
  JM: "Jamaica", TT: "Trinidad and Tobago", JP: "Japan", KR: "South Korea",
  CN: "China", IN: "India", ID: "Indonesia", MY: "Malaysia", SG: "Singapore",
  TH: "Thailand", PH: "Philippines", AU: "Australia", TW: "Taiwan",
  LK: "Sri Lanka", PK: "Pakistan", BD: "Bangladesh", BN: "Brunei",
  AE: "United Arab Emirates", KE: "Kenya", ZA: "South Africa", IL: "Israel",
};

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
