/**
 * enrich-economic-crisis-detector.ts
 *
 * Scans ECONOMIC_CONTEXT ClaimRelations (legislation → worldbank_v1 indicator
 * claim) and tags those where the indicator crossed a "crisis" threshold in
 * the indicator-year of the relation. The tag(s) and the triggering numeric
 * values are merged into `ClaimRelation.followUpContext.crisisContext`.
 *
 * Schema note: ClaimRelation has no `metadata` column — `followUpContext` is
 * the JSON field where the linker (link-worldbank-legislation.ts) writes its
 * per-relation context. This script merges into the same object under a
 * `crisisContext` key so the linker's existing fields are preserved.
 *
 * Threshold rules:
 *   GDP growth (NY.GDP.MKTP.KD.ZG):
 *     value < -2                                              → 'recession'
 *   Unemployment (SL.UEM.TOTL.ZS):
 *     value > 10                                              → 'high-unemployment'
 *     value - priorYearValue > 3   (and prior year present)   → 'unemployment-spike'
 *   Inflation (FP.CPI.TOTL.ZG):
 *     value > 20                                              → 'high-inflation'
 *     value > 50                                              → 'hyperinflation'
 *   Central government debt (GC.DOD.TOTL.GD.ZS):
 *     value > 90                                              → 'high-debt'
 *
 * The 'unemployment-spike' rule needs a prior-year value, which lives on a
 * separate worldbank_v1 Claim (same country, year-1). The script pre-loads
 * all relevant unemployment series into an in-memory iso3→year→value map so
 * the lookup is O(1) per relation.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json \
 *     scripts/enrich-economic-crisis-detector.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json \
 *     scripts/enrich-economic-crisis-detector.ts
 */

import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const BATCH = 500;

type Tag =
  | "recession"
  | "high-unemployment"
  | "unemployment-spike"
  | "high-inflation"
  | "hyperinflation"
  | "high-debt";

interface RelationRow {
  id: string;
  fromClaimId: string;
  toClaimId: string;
  followUpContext: Prisma.JsonValue;
  iso3: string | null;
  indicatorCode: string | null;
  indicatorYear: number | null;
  indicatorValue: number | null;
}

interface CrisisTriggered {
  tag: Tag;
  indicatorCode: string;
  indicatorYear: number;
  value: number;
  priorYearValue?: number;
  priorYearDelta?: number;
}

function evaluate(
  code: string,
  value: number,
  year: number,
  iso3: string,
  unemploymentByCountryYear: Map<string, Map<number, number>>,
): CrisisTriggered[] {
  const triggered: CrisisTriggered[] = [];
  if (code === "NY.GDP.MKTP.KD.ZG") {
    if (value < -2) {
      triggered.push({ tag: "recession", indicatorCode: code, indicatorYear: year, value });
    }
  } else if (code === "SL.UEM.TOTL.ZS") {
    if (value > 10) {
      triggered.push({ tag: "high-unemployment", indicatorCode: code, indicatorYear: year, value });
    }
    const prior = unemploymentByCountryYear.get(iso3)?.get(year - 1);
    if (prior != null && value - prior > 3) {
      triggered.push({
        tag: "unemployment-spike",
        indicatorCode: code,
        indicatorYear: year,
        value,
        priorYearValue: prior,
        priorYearDelta: value - prior,
      });
    }
  } else if (code === "FP.CPI.TOTL.ZG") {
    if (value > 50) {
      triggered.push({ tag: "hyperinflation", indicatorCode: code, indicatorYear: year, value });
    } else if (value > 20) {
      triggered.push({ tag: "high-inflation", indicatorCode: code, indicatorYear: year, value });
    }
  } else if (code === "GC.DOD.TOTL.GD.ZS") {
    if (value > 90) {
      triggered.push({ tag: "high-debt", indicatorCode: code, indicatorYear: year, value });
    }
  }
  return triggered;
}

async function loadUnemploymentSeries(): Promise<Map<string, Map<number, number>>> {
  const rows = await prisma.$queryRaw<
    Array<{ iso3: string; year: number; value: number }>
  >`
    SELECT metadata->>'countryIso3'  AS iso3,
           (metadata->>'year')::int  AS year,
           (metadata->>'value')::float AS value
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'indicatorCode' = 'SL.UEM.TOTL.ZS'
      AND metadata->>'countryIso3' IS NOT NULL
      AND metadata->>'year' IS NOT NULL
      AND metadata->>'value' IS NOT NULL
  `;
  const m = new Map<string, Map<number, number>>();
  for (const r of rows) {
    let byYear = m.get(r.iso3);
    if (!byYear) {
      byYear = new Map();
      m.set(r.iso3, byYear);
    }
    byYear.set(r.year, r.value);
  }
  return m;
}

async function main() {
  console.log(`\nenrich-economic-crisis-detector.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`);

  console.log("=== Step 1: Load unemployment prior-year lookup ===");
  const unemployment = await loadUnemploymentSeries();
  let unempYears = 0;
  for (const byYear of unemployment.values()) unempYears += byYear.size;
  console.log(`  Unemployment series: ${unemployment.size} countries, ${unempYears} country-years`);

  console.log("\n=== Step 2: Stream ECONOMIC_CONTEXT relations ===");
  const totalRow = await prisma.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n
    FROM "ClaimRelation" cr
    JOIN "Claim" c ON c.id = cr."toClaimId"
    WHERE cr."relationType" = 'ECONOMIC_CONTEXT'
      AND c."ingestedBy" = 'worldbank_v1'
      AND c.metadata->>'indicatorCode' IN ('NY.GDP.MKTP.KD.ZG','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG','GC.DOD.TOTL.GD.ZS')
  `;
  const total = Number(totalRow[0]?.n ?? 0);
  console.log(`  Relations pointing at threshold-eligible indicators: ${total}`);

  if (total === 0) {
    console.log("\n  Nothing to scan.");
    await prisma.$disconnect();
    return;
  }

  const counts = {
    scanned: 0,
    flagged: 0,
    updated: 0,
    skippedNoChange: 0,
    byTag: { recession: 0, "high-unemployment": 0, "unemployment-spike": 0, "high-inflation": 0, hyperinflation: 0, "high-debt": 0 } as Record<Tag, number>,
  };

  let lastId = "";
  while (true) {
    const rows = await prisma.$queryRaw<RelationRow[]>`
      SELECT cr.id,
             cr."fromClaimId",
             cr."toClaimId",
             cr."followUpContext",
             c.metadata->>'countryIso3'  AS iso3,
             c.metadata->>'indicatorCode' AS "indicatorCode",
             (c.metadata->>'year')::int   AS "indicatorYear",
             (c.metadata->>'value')::float AS "indicatorValue"
      FROM "ClaimRelation" cr
      JOIN "Claim" c ON c.id = cr."toClaimId"
      WHERE cr."relationType" = 'ECONOMIC_CONTEXT'
        AND c."ingestedBy" = 'worldbank_v1'
        AND c.metadata->>'indicatorCode' IN ('NY.GDP.MKTP.KD.ZG','SL.UEM.TOTL.ZS','FP.CPI.TOTL.ZG','GC.DOD.TOTL.GD.ZS')
        AND cr.id > ${lastId}
      ORDER BY cr.id ASC
      LIMIT ${BATCH}
    `;
    if (rows.length === 0) break;
    lastId = rows[rows.length - 1].id;

    for (const row of rows) {
      counts.scanned++;
      if (!row.iso3 || !row.indicatorCode || row.indicatorYear == null || row.indicatorValue == null) {
        continue;
      }
      const triggered = evaluate(
        row.indicatorCode,
        row.indicatorValue,
        row.indicatorYear,
        row.iso3,
        unemployment,
      );
      if (triggered.length === 0) continue;
      counts.flagged++;
      for (const t of triggered) counts.byTag[t.tag]++;

      if (DRY_RUN) continue;

      const existing =
        row.followUpContext && typeof row.followUpContext === "object" && !Array.isArray(row.followUpContext)
          ? (row.followUpContext as Record<string, unknown>)
          : {};
      await prisma.claimRelation.update({
        where: { id: row.id },
        data: {
          followUpContext: {
            ...existing,
            crisisContext: triggered.map((t) => ({ ...t })),
          },
        },
      });
      counts.updated++;
    }

    if (counts.scanned % (BATCH * 10) === 0 || rows.length < BATCH) {
      console.log(
        `  Progress: scanned=${counts.scanned}/${total} flagged=${counts.flagged} updated=${counts.updated}`,
      );
    }
  }

  console.log("\n=== Summary ===");
  console.log(`  Scanned:  ${counts.scanned}`);
  console.log(`  Flagged:  ${counts.flagged}`);
  console.log(`  Updated:  ${counts.updated} (skipped writes in DRY_RUN: ${DRY_RUN ? counts.flagged : 0})`);
  console.log(`  By tag:`);
  for (const [tag, n] of Object.entries(counts.byTag).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${tag.padEnd(22)} ${n}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
