/**
 * link-worldbank-polities.ts
 *
 * Links worldbank_v1 claims to Polity rows via PolityClaim.
 *
 * Match rule:
 *   metadata.countryIso3 == Polity.countryCode (both ISO3, direct match)
 *   AND metadata.year within [polity.startYear, polity.endYear] (null = open-ended)
 *
 * Idempotent: createMany skipDuplicates on @@unique([polityId, claimId]).
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/link-worldbank-polities.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/link-worldbank-polities.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const BATCH = 1000;

function yearInRange(
  year: number,
  startYear: number | null,
  endYear: number | null
): boolean {
  if (startYear != null && year < startYear) return false;
  if (endYear != null && year > endYear) return false;
  return true;
}

async function main() {
  console.log(
    `\nlink-worldbank-polities.ts — ${DRY_RUN ? "DRY RUN" : "LIVE"}\n`
  );

  // Step 1: Load worldbank_v1 claims (id + countryIso3 + year from metadata JSON)
  console.log("=== Step 1: Load worldbank_v1 claims ===");
  const wbClaims = await prisma.$queryRaw<
    Array<{ id: string; iso3: string; year: number | null }>
  >`
    SELECT id,
           metadata->>'countryIso3'  AS iso3,
           (metadata->>'year')::int  AS year
    FROM "Claim"
    WHERE "ingestedBy" = 'worldbank_v1'
      AND deleted = false
      AND metadata->>'countryIso3' IS NOT NULL
  `;
  console.log(`  worldbank_v1 claims with countryIso3: ${wbClaims.length}`);

  // Step 2: Load polities indexed by countryCode (ISO3)
  console.log("\n=== Step 2: Load polities ===");
  const polities = await prisma.polity.findMany({
    where: { countryCode: { not: null } },
    select: {
      id: true,
      name: true,
      countryCode: true,
      startYear: true,
      endYear: true,
    },
  });
  console.log(`  Polities with countryCode: ${polities.length}`);

  const polityMap = new Map<
    string,
    Array<{
      id: string;
      name: string;
      startYear: number | null;
      endYear: number | null;
    }>
  >();
  for (const p of polities) {
    const key = p.countryCode!;
    const list = polityMap.get(key) ?? [];
    list.push({
      id: p.id,
      name: p.name,
      startYear: p.startYear,
      endYear: p.endYear,
    });
    polityMap.set(key, list);
  }
  console.log(`  Distinct country codes in polity map: ${polityMap.size}`);

  // Step 3: Build PolityClaim pairs
  console.log("\n=== Step 3: Build PolityClaim pairs ===");
  const rows: Array<{
    polityId: string;
    claimId: string;
    matchMethod: string;
  }> = [];
  let skippedNoPolity = 0;
  let skippedOutOfRange = 0;

  for (const c of wbClaims) {
    const candidates = polityMap.get(c.iso3);
    if (!candidates || candidates.length === 0) {
      skippedNoPolity++;
      continue;
    }

    for (const polity of candidates) {
      if (
        c.year != null &&
        !yearInRange(c.year, polity.startYear, polity.endYear)
      ) {
        skippedOutOfRange++;
        continue;
      }
      // year=null: only link to fully open-ended polities
      if (
        c.year == null &&
        (polity.startYear != null || polity.endYear != null)
      ) {
        skippedOutOfRange++;
        continue;
      }
      rows.push({
        polityId: polity.id,
        claimId: c.id,
        matchMethod: "auto_iso3_year",
      });
    }
  }

  const distinctPolities = new Set(rows.map((r) => r.polityId)).size;
  console.log(`  Candidate PolityClaim rows: ${rows.length}`);
  console.log(`  Distinct polities covered: ${distinctPolities}`);
  console.log(`  Skipped (no matching polity ISO3): ${skippedNoPolity}`);
  console.log(
    `  Skipped (year out of polity range): ${skippedOutOfRange}`
  );

  if (DRY_RUN) {
    console.log(
      `\n  DRY RUN — would insert up to ${rows.length} PolityClaim rows.`
    );
    await prisma.$disconnect();
    return;
  }

  // Step 4: Batch insert
  console.log("\n=== Step 4: Insert PolityClaim rows ===");
  let inserted = 0;
  let skippedDupes = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const res = await prisma.polityClaim.createMany({
      data: slice,
      skipDuplicates: true,
    });
    inserted += res.count;
    skippedDupes += slice.length - res.count;

    if (i % (BATCH * 10) === 0 || i + BATCH >= rows.length) {
      console.log(
        `  Progress: ${Math.min(i + BATCH, rows.length)}/${rows.length} — inserted ${inserted}, skipped ${skippedDupes}`
      );
    }
  }

  // Step 5: Verify against DB (per AGENTS.md rule)
  console.log("\n=== Step 5: DB verification ===");
  const totalPolityClaims = await prisma.polityClaim.count();
  const wbPolityCount = await prisma.polityClaim.count({
    where: { claim: { ingestedBy: "worldbank_v1" } },
  });

  console.log(`\n── Summary ──`);
  console.log(`  Inserted this run:                ${inserted}`);
  console.log(`  Skipped (already existed):        ${skippedDupes}`);
  console.log(`  Distinct polities now covered:    ${distinctPolities}`);
  console.log(`  worldbank_v1 PolityClaim rows (DB): ${wbPolityCount}`);
  console.log(`  Total PolityClaim rows (DB):        ${totalPolityClaims}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
