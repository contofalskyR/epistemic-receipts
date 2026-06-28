import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const GENERIC_URL = "https://disclosures-clerk.house.gov/FinancialDisclosure";

async function main() {
  const rows = await prisma.$queryRawUnsafe<{ sourceId: string; bioguide_id: string }[]>(`
    SELECT DISTINCT s.id as "sourceId",
      (c.metadata->>'bioguide_id') as "bioguide_id"
    FROM "Source" s
    JOIN "Edge" e ON e."sourceId" = s.id
    JOIN "Claim" c ON e."claimId" = c.id
    WHERE c."ingestedBy" = 'congress_stock_act_v1'
      AND s.url = '${GENERIC_URL}'
      AND (c.metadata->>'bioguide_id') IS NOT NULL
      AND (c.metadata->>'bioguide_id') != ''
  `);

  console.log(`Updating ${rows.length} sources…`);

  let updated = 0;
  for (const row of rows) {
    await prisma.source.update({
      where: { id: row.sourceId },
      data: { url: `https://bioguide.congress.gov/search/bio/${row.bioguide_id}` },
    });
    updated++;
    if (updated % 100 === 0) console.log(`  ${updated}/${rows.length}`);
  }

  console.log(`Done. Updated ${updated} sources.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
