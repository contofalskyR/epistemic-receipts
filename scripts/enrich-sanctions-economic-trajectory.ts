/**
 * enrich-sanctions-economic-trajectory.ts
 *
 * Maps OFAC SDN sanction entries onto World Bank economic indicators to expose
 * the macro before/after for each sanctioned country.
 *
 *   from = ofac_sdn_v1 claim    (the sanctions designation)
 *   to   = worldbank_v1 claim   (the macro indicator for the same country in window)
 *   relationType = SANCTION_ECONOMIC_IMPACT
 *
 * Sanction year T is derived from the OFAC entry's `programs` list using
 * PROGRAM_YEAR (Executive Order signing dates / program-inception years).
 * Entries without a mappable program or without `alpha3` are skipped.
 *
 * Window: WB year ∈ [T-3, T+5]. Pre = T-3..T-1, Post = T+1..T+5.
 *
 * Indicators considered (focus + broader fallbacks because focus codes are
 * only available for BLR/CAF in the current worldbank_v1 ingest):
 *   - NY.GDP.MKTP.KD.ZG    GDP growth (focus)
 *   - FP.CPI.TOTL.ZG       Inflation (focus)
 *   - SL.UEM.TOTL.ZS       Unemployment (focus)
 *   - NY.GDP.MKTP.CD       GDP, current US$ (fallback — broader country coverage)
 *   - NY.GDP.PCAP.CD       GDP per capita (fallback)
 *
 * NOTE: OFAC SDN claims do not carry a sanction-date field in metadata; the
 * ingester records uid + programs + alpha3 only. Sanction year is therefore
 * inferred from the earliest applicable program in the entry. Per-entry
 * provenance for T is recorded in followUpContext.sanctionYearSource.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-sanctions-economic-trajectory.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-sanctions-economic-trajectory.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const RELATION_TYPE = "SANCTION_ECONOMIC_IMPACT";
const INSERT_BATCH = 200;
const PRE_OFFSET_MIN = -3;
const POST_OFFSET_MAX = 5;

// OFAC program / EO tag → year of inception (EO signing or program start).
// Covers the country-specific programs in current ofac_sdn_v1 metadata; thematic
// programs (SDGT, GLOMAG, NPWMD, etc.) are included for completeness but only
// take effect when the entry's alpha3 was independently resolved by the ingester.
const PROGRAM_YEAR: Record<string, number> = {
  // Iran
  IRAN: 1995,
  "IRAN-EO13059": 1997,
  IFSR: 2010,
  "IRAN-TRA": 2012,
  IRGC: 2007,
  "IRAN-EO13902": 2020,
  "IRAN-EO13846": 2018,
  "IRAN-HR": 2010,
  "IRAN-EO13876": 2019,
  "IRAN-EO13871": 2019,
  "IRAN-CON": 2017,
  // Russia / Ukraine-related
  RUSSIA: 2014,
  "RUSSIA-EO14024": 2021,
  "CAATSA - RUSSIA": 2017,
  "UKRAINE-EO13660": 2014,
  "UKRAINE-EO13661": 2014,
  "UKRAINE-EO13662": 2014,
  "UKRAINE-EO13685": 2014,
  // Cuba
  CUBA: 1962,
  "CUBA-EO14404": 2025,
  // North Korea
  DPRK: 2008,
  DPRK2: 2010,
  DPRK3: 2017,
  DPRK4: 2017,
  "DPRK-EO13382": 2005,
  // Venezuela
  VENEZUELA: 2015,
  "VENEZUELA-EO13850": 2018,
  "VENEZUELA-EO13884": 2019,
  // Syria
  SYRIA: 2004,
  "SYRIA-EO13894": 2019,
  // Iraq
  IRAQ: 2003,
  IRAQ2: 2003,
  IRAQ3: 2004,
  "IRAQ-EO13303": 2003,
  // Belarus
  BELARUS: 2006,
  "BELARUS-EO14038": 2021,
  // Myanmar / Burma
  MYANMAR: 1997,
  "BURMA-EO14014": 2021,
  // Other country-specific
  SUDAN: 1997,
  ZIMBABWE: 2003,
  LIBYA: 2011,
  SOMALIA: 2010,
  MALI: 2019,
  NICARAGUA: 2018,
  CAR: 2014,
  DRC: 2006,
  "SOUTH-SUDAN": 2014,
  ETHIOPIA: 2021,
  HAITI: 2024,
  BURUNDI: 2015,
  YEMEN: 2012,
  AFGHANISTAN: 2002,
  // Thematic
  SDGT: 2001,
  SDNT: 1995,
  SDNTK: 1999,
  NPWMD: 2005,
  GLOMAG: 2017,
  "ILLICIT-DRUGS-EO14059": 2021,
  CYBER2: 2015,
  BALKANS: 2001,
  "ELECTION-EO13848": 2018,
  "PAARSSR-EO13894": 2019,
  TCO: 2011,
  "CHINA-MILITARY": 2020,
  CMIC: 2020,
};

const FOCUS_CODES = new Set([
  "NY.GDP.MKTP.KD.ZG",
  "FP.CPI.TOTL.ZG",
  "SL.UEM.TOTL.ZS",
  "NY.GDP.MKTP.CD",
  "NY.GDP.PCAP.CD",
]);

const GROWTH_CODE = "NY.GDP.MKTP.KD.ZG";
const GDP_LEVEL_CODE = "NY.GDP.MKTP.CD";

function sanctionYearFor(programs: string[]): { year: number; program: string } | null {
  let best: { year: number; program: string } | null = null;
  for (const p of programs) {
    const y = PROGRAM_YEAR[p.toUpperCase()] ?? PROGRAM_YEAR[p];
    if (y == null) continue;
    if (!best || y < best.year) best = { year: y, program: p };
  }
  return best;
}

async function main() {
  console.log(`\nenrich-sanctions-economic-trajectory.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  // ── Step 1: Load worldbank_v1 economic indicators in scope ──
  console.log("=== Step 1: Load worldbank_v1 economic indicators ===");
  const wbRows = await prisma.$queryRaw<
    Array<{ id: string; iso3: string; year: number; code: string; value: number }>
  >`
    SELECT id,
           metadata->>'countryIso3'    AS iso3,
           (metadata->>'year')::int    AS year,
           metadata->>'indicatorCode'  AS code,
           (metadata->>'value')::float AS value
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'countryIso3' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
      AND metadata->>'indicatorCode' IS NOT NULL
  `;
  const wb = wbRows.filter((r) => FOCUS_CODES.has(r.code));
  console.log(`  worldbank_v1 total claims: ${wbRows.length}`);
  console.log(`  In-scope indicator claims: ${wb.length}`);

  // Index: iso3 → year → [{ id, code, value }]
  const wbIndex = new Map<string, Map<number, Array<{ id: string; code: string; value: number }>>>();
  // Side index: iso3 → code → year → value (for trajectory analytics)
  const valueIndex = new Map<string, Map<string, Map<number, number>>>();
  for (const r of wb) {
    let byYear = wbIndex.get(r.iso3);
    if (!byYear) {
      byYear = new Map();
      wbIndex.set(r.iso3, byYear);
    }
    const arr = byYear.get(r.year) ?? [];
    arr.push({ id: r.id, code: r.code, value: r.value });
    byYear.set(r.year, arr);

    let byCode = valueIndex.get(r.iso3);
    if (!byCode) {
      byCode = new Map();
      valueIndex.set(r.iso3, byCode);
    }
    let byCodeYear = byCode.get(r.code);
    if (!byCodeYear) {
      byCodeYear = new Map();
      byCode.set(r.code, byCodeYear);
    }
    byCodeYear.set(r.year, r.value);
  }
  console.log(`  WB countries indexed: ${wbIndex.size}`);

  // ── Step 2: Load OFAC SDN claims with mappable country + program ──
  console.log("\n=== Step 2: Load ofac_sdn_v1 sanction claims ===");
  const ofacRows = await prisma.$queryRaw<
    Array<{ id: string; alpha3: string; programs: string[] }>
  >`
    SELECT id,
           metadata->>'alpha3'                                AS alpha3,
           (SELECT array_agg(p) FROM jsonb_array_elements_text(metadata->'programs') AS p) AS programs
    FROM "Claim"
    WHERE "ingestedBy" = 'ofac_sdn_v1'
      AND deleted = false
      AND metadata->>'alpha3' IS NOT NULL
      AND jsonb_array_length(metadata->'programs') > 0
  `;
  console.log(`  OFAC SDN claims with alpha3: ${ofacRows.length}`);

  // Resolve sanction year per entry
  type OfacEntry = { id: string; iso3: string; year: number; program: string };
  const ofac: OfacEntry[] = [];
  const skipReasons = { noProgramYear: 0 };
  for (const r of ofacRows) {
    const sy = sanctionYearFor(r.programs ?? []);
    if (!sy) {
      skipReasons.noProgramYear++;
      continue;
    }
    ofac.push({ id: r.id, iso3: r.alpha3, year: sy.year, program: sy.program });
  }
  console.log(`  Resolved to (iso3, sanctionYear): ${ofac.length}`);
  console.log(`  Skipped — no mappable program year: ${skipReasons.noProgramYear}`);

  const byCountry = new Map<string, number>();
  for (const e of ofac) byCountry.set(e.iso3, (byCountry.get(e.iso3) ?? 0) + 1);
  console.log("\n  Resolved entries per country:");
  for (const [c, n] of [...byCountry.entries()].sort((a, b) => b[1] - a[1])) {
    const inWb = wbIndex.has(c) ? "✓" : "✗";
    console.log(`    ${c} ${inWb}  ${n}`);
  }

  // ── Step 3: Build (ofac → wb) candidate pairs ──
  console.log("\n=== Step 3: Build candidate pairs ===");
  type Pair = {
    fromClaimId: string;
    toClaimId: string;
    iso3: string;
    sanctionYear: number;
    sanctionProgram: string;
    indicatorCode: string;
    indicatorYear: number;
    indicatorValue: number;
    yearsFromSanction: number;
    window: "pre" | "post" | "t";
  };

  const seen = new Set<string>();
  const pairs: Pair[] = [];
  const countriesCovered = new Set<string>();

  for (const e of ofac) {
    const byYear = wbIndex.get(e.iso3);
    if (!byYear) continue;
    for (let dy = PRE_OFFSET_MIN; dy <= POST_OFFSET_MAX; dy++) {
      const candidates = byYear.get(e.year + dy);
      if (!candidates) continue;
      for (const wbc of candidates) {
        const key = `${e.id}|${wbc.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        pairs.push({
          fromClaimId: e.id,
          toClaimId: wbc.id,
          iso3: e.iso3,
          sanctionYear: e.year,
          sanctionProgram: e.program,
          indicatorCode: wbc.code,
          indicatorYear: e.year + dy,
          indicatorValue: wbc.value,
          yearsFromSanction: dy,
          window: dy < 0 ? "pre" : dy > 0 ? "post" : "t",
        });
        countriesCovered.add(e.iso3);
      }
    }
  }
  console.log(`  Candidate pairs: ${pairs.length}`);
  console.log(`  Countries covered (have WB match): ${countriesCovered.size}`);

  // ── Step 4: GDP-growth drop ranking (per country × sanctionYear cohort) ──
  console.log("\n=== Step 4: Top countries by pre→post GDP growth drop ===");

  // Distinct (iso3, sanctionYear) cohorts in scope
  const cohorts = new Set<string>();
  for (const e of ofac) if (wbIndex.has(e.iso3)) cohorts.add(`${e.iso3}|${e.year}`);

  type Trajectory = {
    iso3: string;
    sanctionYear: number;
    preAvg: number | null;
    postAvg: number | null;
    drop: number | null;
    source: "growth" | "level_yoy";
  };
  const trajectories: Trajectory[] = [];

  for (const k of cohorts) {
    const [iso3, sy] = k.split("|");
    const T = parseInt(sy, 10);
    const growthByYear = valueIndex.get(iso3)?.get(GROWTH_CODE);
    const levelByYear = valueIndex.get(iso3)?.get(GDP_LEVEL_CODE);

    let preVals: number[] = [];
    let postVals: number[] = [];
    let src: "growth" | "level_yoy" = "growth";

    if (growthByYear && growthByYear.size > 0) {
      for (let y = T + PRE_OFFSET_MIN; y < T; y++) {
        const v = growthByYear.get(y);
        if (typeof v === "number" && Number.isFinite(v)) preVals.push(v);
      }
      for (let y = T + 1; y <= T + POST_OFFSET_MAX; y++) {
        const v = growthByYear.get(y);
        if (typeof v === "number" && Number.isFinite(v)) postVals.push(v);
      }
    }
    if (preVals.length === 0 && postVals.length === 0 && levelByYear && levelByYear.size > 0) {
      src = "level_yoy";
      const yoy = (y: number): number | null => {
        const cur = levelByYear.get(y);
        const prev = levelByYear.get(y - 1);
        if (cur == null || prev == null || prev === 0) return null;
        return ((cur - prev) / prev) * 100;
      };
      for (let y = T + PRE_OFFSET_MIN; y < T; y++) {
        const v = yoy(y);
        if (v != null && Number.isFinite(v)) preVals.push(v);
      }
      for (let y = T + 1; y <= T + POST_OFFSET_MAX; y++) {
        const v = yoy(y);
        if (v != null && Number.isFinite(v)) postVals.push(v);
      }
    }

    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
    const preAvg = avg(preVals);
    const postAvg = avg(postVals);
    const drop = preAvg != null && postAvg != null ? preAvg - postAvg : null;
    trajectories.push({ iso3, sanctionYear: T, preAvg, postAvg, drop, source: src });
  }

  const ranked = trajectories
    .filter((t) => t.drop != null)
    .sort((a, b) => (b.drop! - a.drop!));
  console.log("  Top 5 cohorts by GDP growth drop (pre 3y avg − post 5y avg):");
  for (const t of ranked.slice(0, 5)) {
    console.log(
      `    ${t.iso3} T=${t.sanctionYear}  drop=${t.drop!.toFixed(2)}pp  ` +
        `pre=${t.preAvg!.toFixed(2)}%  post=${t.postAvg!.toFixed(2)}%  [${t.source}]`,
    );
  }
  if (ranked.length === 0) console.log("    (no cohorts with computable pre/post growth)");

  // ── Step 5: Insert SANCTION_ECONOMIC_IMPACT relations ──
  console.log("\n=== Step 5: Persist relations ===");
  if (DRY_RUN) {
    console.log(`  DRY RUN — would insert up to ${pairs.length} ClaimRelation rows`);
    console.log(`  Batch size: ${INSERT_BATCH}`);
    await prisma.$disconnect();
    return { inserted: 0, candidates: pairs.length, countries: countriesCovered, ranked };
  }

  let inserted = 0;
  for (let i = 0; i < pairs.length; i += INSERT_BATCH) {
    const slice = pairs.slice(i, i + INSERT_BATCH);
    const rows = slice.map((p) => ({
      fromClaimId: p.fromClaimId,
      toClaimId: p.toClaimId,
      relationType: RELATION_TYPE,
      year: p.indicatorYear,
      followUpContext: {
        iso3: p.iso3,
        sanctionYear: p.sanctionYear,
        sanctionProgram: p.sanctionProgram,
        sanctionYearSource: "program_inception",
        indicator: p.indicatorCode,
        indicatorYear: p.indicatorYear,
        value: p.indicatorValue,
        yearsFromSanction: p.yearsFromSanction,
        window: p.window,
        heuristic: "country_year_window",
        confidence: "medium",
        pipeline_from: "ofac_sdn_v1",
        pipeline_to: "worldbank_v1",
      },
    }));
    const res = await prisma.claimRelation.createMany({
      data: rows,
      skipDuplicates: true,
    });
    inserted += res.count;
    if ((i / INSERT_BATCH) % 25 === 0) {
      console.log(`  Batch ${i / INSERT_BATCH + 1}: +${res.count} (cumulative ${inserted})`);
    }
  }

  const total = await prisma.claimRelation.count({ where: { relationType: RELATION_TYPE } });
  console.log(
    `\n  Inserted ${inserted} of ${pairs.length} candidates ` +
      `(skipped existing).\n  Total ${RELATION_TYPE} relations in DB: ${total}`,
  );

  await prisma.$disconnect();
  return { inserted, candidates: pairs.length, countries: countriesCovered, ranked };
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
