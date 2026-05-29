// Audit fix: backfill null verificationStatus → 'PROVISIONAL'
//
// Affected: 183,811 auto-ingested claims (openalex_v1, nih_reporter_v1,
// clinicaltrials_v1, korea_legislation_v1, iau_constellations_v1) that were
// written with autoApproved=true but verificationStatus left null.
//
// Logic: autoApproved=true + humanReviewed=false → PROVISIONAL
// The single manual claim with null verificationStatus is skipped (left for human triage).
//
// Safe: this is additive — does not change text, edges, or any other fields.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  const affected = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim"
    WHERE deleted = false
    AND "verificationStatus" IS NULL
    AND "autoApproved" = true
    AND "humanReviewed" = false
  `;
  console.log(`Rows to update: ${affected[0].count}`);

  if (dryRun) {
    console.log('[dry-run] No changes written.');
    return;
  }

  const result = await prisma.$executeRaw`
    UPDATE "Claim"
    SET "verificationStatus" = 'PROVISIONAL'
    WHERE deleted = false
    AND "verificationStatus" IS NULL
    AND "autoApproved" = true
    AND "humanReviewed" = false
  `;
  console.log(`Updated ${result} claims → verificationStatus='PROVISIONAL'`);

  // Report remaining nulls
  const remaining = await prisma.$queryRaw<{ ingestedBy: string; count: bigint }[]>`
    SELECT "ingestedBy", COUNT(*) as count FROM "Claim"
    WHERE deleted = false AND "verificationStatus" IS NULL
    GROUP BY "ingestedBy"
  `;
  if (remaining.length > 0) {
    console.log('Remaining null verificationStatus (skipped — manual review needed):',
      remaining.map(r => `${r.ingestedBy}(${r.count})`).join(', '));
  } else {
    console.log('No remaining null verificationStatus rows.');
  }

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
