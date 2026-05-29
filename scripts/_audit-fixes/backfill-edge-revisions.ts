// Audit fix: backfill EdgeRevision for edges that have none
//
// Affected: ~272k active edges from recent legislative pipelines
// (argentina, italy, chile, cyprus, uk, philippines, brazil, luxembourg,
// mesh, riksdag, echr, wipo, eec, costa_rica, colombia, belgium, poland,
// bundestag, estonia, peru, and more) that were created without an initial
// EdgeRevision score record.
//
// Per schema: "initial score written here on Edge creation"
// Score chosen: 90 — consistent with enacted-legislation CITES edges
// (congress_v1 uses 95 for US law; 90 is a conservative default for
// international equivalents). FOR-type edges get score=85.
//
// Uses bulk SQL INSERT for performance (single statement per batch).
// Safe: additive only, creates new EdgeRevision rows, does not modify Edges.

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 10000;

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  const countResult = await prisma.$queryRaw<{ cnt: number }[]>`
    SELECT COUNT(*)::int as cnt FROM "Edge" e
    WHERE e.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "EdgeRevision" er WHERE er."edgeId" = e.id)
  `;
  const total = countResult[0].cnt;
  console.log(`Edges missing EdgeRevision: ${total}`);

  if (dryRun) {
    console.log('[dry-run] No changes written.');
    return;
  }

  let inserted = 0;
  let offset = 0;

  while (true) {
    const batch = await prisma.$queryRaw<{ id: string; type: string }[]>`
      SELECT e.id, e.type
      FROM "Edge" e
      WHERE e.deleted = false
      AND NOT EXISTS (SELECT 1 FROM "EdgeRevision" er WHERE er."edgeId" = e.id)
      ORDER BY e."createdAt"
      LIMIT ${BATCH_SIZE}
    `;

    if (batch.length === 0) break;

    // Build VALUES list for bulk insert
    // IDs use gen_random_uuid() at DB level — valid as String PKs
    const values = batch
      .map(e => {
        const score = e.type === 'FOR' ? 85 : 90;
        const reason = `backfilled_audit_2026-05-29`;
        // Escape single quotes in reason (none expected, but safe)
        return `(gen_random_uuid()::text, '${e.id}', NULL, ${score}, '${reason.replace(/'/g, "''")}', NOW())`;
      })
      .join(',\n');

    await prisma.$executeRawUnsafe(`
      INSERT INTO "EdgeRevision" (id, "edgeId", "priorScore", "newScore", reason, "changedAt")
      VALUES ${values}
      ON CONFLICT (id) DO NOTHING
    `);

    inserted += batch.length;
    console.log(`  ${inserted}/${total} EdgeRevisions written`);

    if (batch.length < BATCH_SIZE) break;
  }

  console.log(`Done. Created ${inserted} EdgeRevision records.`);
  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
