/**
 * link-worldbank-legislation.ts
 *
 * Links World Bank economic indicator claims (worldbank_v1) to legislation
 * claims enacted in the same country during the same year (±1).
 *
 *   from = legislation claim   (the law)
 *   to   = worldbank_v1 claim  (the macro indicator)
 *   relationType = ECONOMIC_CONTEXT
 *
 * This wires macro economic facts as background context for laws enacted in
 * the same country-year window. The relation is editorial in spirit but
 * mechanical in operation — country + year window is the only join.
 *
 * Economic indicator codes considered (limited to what worldbank_v1 has):
 *   - NY.GDP.MKTP.CD       (GDP, current US$)
 *   - NY.GDP.PCAP.CD       (GDP per capita)
 *   - NY.GDP.MKTP.KD.ZG    (GDP growth)
 *   - FP.CPI.TOTL.ZG       (inflation, consumer prices)
 *   - GC.DOD.TOTL.GD.ZS    (central gov debt, % of GDP)
 *   - NY.GDP.DEFL.KD.ZG    (inflation, GDP deflator)
 * Any indicatorCode beginning with NY.GDP, FP.CPI, NY.GDP.DEFL, GC.DOD is
 * accepted at runtime — additions to the worldbank ingester need no edit here.
 *
 * Country resolution: legislation pipelines tagged with `ingestedBy` map to a
 * fixed ISO3 country code. worldbank_v1 claims carry the ISO3 in
 * metadata.countryIso3 directly. Year is extracted from claimEmergedAt on the
 * legislation side and metadata.year on the worldbank side.
 *
 * Window: legislationYear matches worldbankYear ∈ [legislationYear-1, legislationYear+1].
 *
 * Confidence: medium (mechanical country-year join, no causal claim).
 *
 * Run:
 *   npx ts-node --project tsconfig.scripts.json scripts/link-worldbank-legislation.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/link-worldbank-legislation.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");

// Legislation pipeline → ISO3 country code.
// Supranational pipelines (eu_legislation_v1, un_sc_resolutions_v1, nato_*) are
// excluded — they don't map to a single ISO3 country.
const PIPELINE_TO_ISO3: Record<string, string> = {
  congress_v1: "USA",
  congress_bills_v1: "USA",
  fr_rules_v1: "USA",
  riksdag_v1: "SWE",
  tweedekamer_v1: "NLD",
  bundestag_v1: "DEU",
  nationalrat_v1: "AUT",
  oireachtas_v1: "IRL",
  canada_bills_v1: "CAN",
  uk_legislation_v1: "GBR",
  australia_legislation_v1: "AUS",
  norway_legislation_v1: "NOR",
  nz_legislation_v1: "NZL",
  india_legislation_v1: "IND",
  singapore_legislation_v1: "SGP",
  iceland_legislation_v1: "ISL",
  denmark_legislation_v1: "DNK",
  finland_legislation_v1: "FIN",
  switzerland_legislation_v1: "CHE",
  belgium_legislation_v1: "BEL",
  portugal_legislation_v1: "PRT",
  spain_legislation_v1: "ESP",
  poland_legislation_v1: "POL",
  italy_legislation_v1: "ITA",
  japan_legislation_v1: "JPN",
  argentina_legislation_v1: "ARG",
  taiwan_legislation_v1: "TWN",
  mexico_legislation_v1: "MEX",
  brazil_legislation_v1: "BRA",
  south_africa_legislation_v1: "ZAF",
  chile_legislation_v1: "CHL",
  colombia_legislation_v1: "COL",
  philippines_legislation_v1: "PHL",
  france_legislation_v1: "FRA",
  bangladesh_legislation_v1: "BGD",
  russia_legislation_v1: "RUS",
  israel_knesset_v1: "ISR",
  scotland_legislation_v1: "GBR",
  wales_senedd_v1: "GBR",
  malaysia_legislation_v1: "MYS",
  estonia_legislation_v1: "EST",
  malta_legislation_v1: "MLT",
  georgia_legislation_v1: "GEO",
  jamaica_legislation_v1: "JAM",
  srilanka_legislation_v1: "LKA",
  pakistan_legislation_v1: "PAK",
  tt_legislation_v1: "TTO",
  brunei_legislation_v1: "BRN",
  uruguay_legislation_v1: "URY",
  peru_legislation_v1: "PER",
  costarica_legislation_v1: "CRI",
  uae_legislation_v1: "ARE",
  // Pipelines mentioned in recent CONSULTANT/memory notes
  romania_legislation_v1: "ROU",
  latvia_legislation_v1: "LVA",
  lithuania_legislation_v1: "LTU",
  hungary_legislation_v1: "HUN",
  croatia_legislation_v1: "HRV",
  bulgaria_legislation_v1: "BGR",
  czech_legislation_v1: "CZE",
  cyprus_legislation_v1: "CYP",
  indonesia_legislation_v1: "IDN",
  kenya_legislation_v1: "KEN",
  korea_legislation_v1: "KOR",
  luxembourg_legislation_v1: "LUX",
};

const LEGISLATION_PIPELINES = Object.keys(PIPELINE_TO_ISO3);

function isEconomicIndicator(code: string): boolean {
  return (
    code.startsWith("NY.GDP") ||
    code.startsWith("FP.CPI") ||
    code.startsWith("GC.DOD") ||
    code.startsWith("SL.UEM") ||
    code === "NY.GDP.DEFL.KD.ZG"
  );
}

async function main() {
  console.log(`\nlink-worldbank-legislation.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // ── Step 1: Load worldbank_v1 economic indicator claims, indexed by ISO3+year ──
  console.log("=== Step 1: Load worldbank_v1 economic indicator claims ===");
  const wbClaims = await prisma.$queryRaw<
    Array<{ id: string; iso3: string; year: number; code: string }>
  >`
    SELECT id,
           metadata->>'countryIso3'   AS iso3,
           (metadata->>'year')::int   AS year,
           metadata->>'indicatorCode' AS code
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'countryIso3' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
      AND metadata->>'indicatorCode' IS NOT NULL
  `;
  const econ = wbClaims.filter((c) => isEconomicIndicator(c.code));
  console.log(`  worldbank_v1 claims: ${wbClaims.length}`);
  console.log(`  Economic indicator claims: ${econ.length}`);

  // Index: iso3 → year → claim[]
  const wbIndex = new Map<string, Map<number, Array<{ id: string; code: string }>>>();
  for (const c of econ) {
    let byYear = wbIndex.get(c.iso3);
    if (!byYear) {
      byYear = new Map();
      wbIndex.set(c.iso3, byYear);
    }
    const arr = byYear.get(c.year) ?? [];
    arr.push({ id: c.id, code: c.code });
    byYear.set(c.year, arr);
  }
  console.log(`  Countries with economic indicators: ${wbIndex.size}`);

  // ── Step 2: Load legislation claims, by pipeline ──
  console.log("\n=== Step 2: Load legislation claims ===");

  const legClaims = await prisma.$queryRaw<
    Array<{ id: string; ingestedBy: string; year: number | null }>
  >`
    SELECT id,
           "ingestedBy",
           EXTRACT(YEAR FROM "claimEmergedAt")::int AS year
    FROM "Claim"
    WHERE deleted = false
      AND "ingestedBy" = ANY(${LEGISLATION_PIPELINES})
      AND "claimEmergedAt" IS NOT NULL
  `;
  console.log(`  Legislation claims with year: ${legClaims.length}`);

  const byPipeline = new Map<string, number>();
  for (const c of legClaims) {
    byPipeline.set(c.ingestedBy, (byPipeline.get(c.ingestedBy) ?? 0) + 1);
  }
  for (const [p, n] of [...byPipeline.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
    console.log(`    ${p}: ${n}`);
  }

  // ── Step 3: Build pairs ──
  console.log("\n=== Step 3: Build pairs (country + year ±1) ===");

  type Pair = {
    fromClaimId: string;
    toClaimId: string;
    pipeline: string;
    iso3: string;
    legislationYear: number;
    indicatorCode: string;
    indicatorYear: number;
    yearOffset: number;
  };

  const seen = new Set<string>();
  const pairs: Pair[] = [];

  for (const leg of legClaims) {
    if (leg.year == null) continue;
    const iso3 = PIPELINE_TO_ISO3[leg.ingestedBy];
    if (!iso3) continue;
    const byYear = wbIndex.get(iso3);
    if (!byYear) continue;
    for (const dy of [-1, 0, 1]) {
      const candidates = byYear.get(leg.year + dy);
      if (!candidates) continue;
      for (const wb of candidates) {
        const key = `${leg.id}|${wb.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          fromClaimId: leg.id,
          toClaimId: wb.id,
          pipeline: leg.ingestedBy,
          iso3,
          legislationYear: leg.year,
          indicatorCode: wb.code,
          indicatorYear: leg.year + dy,
          yearOffset: dy,
        });
      }
    }
  }

  console.log(`  Total candidate pairs: ${pairs.length}`);

  // Sample report
  console.log("\n  Sample pairs:");
  for (const p of pairs.slice(0, 8)) {
    console.log(
      `    ${p.pipeline} (${p.iso3} ${p.legislationYear}) → ${p.indicatorCode} ${p.indicatorYear} [Δ${p.yearOffset >= 0 ? "+" : ""}${p.yearOffset}]`
    );
  }

  if (DRY_RUN) {
    console.log(`\n  DRY RUN — would insert ${pairs.length} ClaimRelation rows.`);
    await prisma.$disconnect();
    return;
  }

  // ── Step 4: Bulk insert with createMany skipDuplicates ──
  console.log("\n=== Step 4: Insert ClaimRelations (ECONOMIC_CONTEXT) ===");

  const BATCH = 1000;
  let inserted = 0;
  for (let i = 0; i < pairs.length; i += BATCH) {
    const slice = pairs.slice(i, i + BATCH);
    const rows = slice.map((p) => ({
      fromClaimId: p.fromClaimId,
      toClaimId: p.toClaimId,
      relationType: "ECONOMIC_CONTEXT",
      year: p.indicatorYear,
      followUpContext: {
        iso3: p.iso3,
        legislationYear: p.legislationYear,
        indicatorCode: p.indicatorCode,
        indicatorYear: p.indicatorYear,
        yearOffsetFromLegislation: p.yearOffset,
        heuristic: "country_year_window",
        window: "±1 year",
        confidence: "medium",
        pipeline_from: p.pipeline,
        pipeline_to: "worldbank_v1",
      },
    }));
    const res = await prisma.claimRelation.createMany({
      data: rows,
      skipDuplicates: true,
    });
    inserted += res.count;
    if ((i / BATCH) % 10 === 0) {
      console.log(`  Batch ${i / BATCH + 1}: inserted ${res.count} (cumulative ${inserted})`);
    }
  }

  console.log(
    `\n  Total inserted: ${inserted} of ${pairs.length} candidate pairs (rest were existing duplicates)`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
