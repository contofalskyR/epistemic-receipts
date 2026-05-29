// DESTRUCTIVE — DO NOT RUN without review
//
// Deletes 113,319 voteview_v1 Source records and their 113,319 LegislativeVote
// child records. These sources have ZERO edges — the entire pipeline created
// Source + LegislativeVote pairs but never connected them to any Claim via Edges.
//
// WHY this might be intentional: the ingestor comment says "Creates: Source +
// LegislativeVote records (one pair per roll call)" with no mention of Edges.
// The data may be intended as a reference tier waiting for editorial connections.
//
// WHY you might want to delete: 113k source records consuming space with no
// editorial connections and no pipeline registry entry — may be an incomplete
// or abandoned pipeline run.
//
// Decision required: confirm whether voteview data will be editorially connected
// to Claims before deleting. If uncertain, keep the data.
//
// Run with: npx tsx scripts/_audit-fixes/cleanup-voteview-orphaned-sources.ts
// Dry-run:  npx tsx scripts/_audit-fixes/cleanup-voteview-orphaned-sources.ts --dry-run

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  // Confirm all voteview sources are edge-free before deleting
  const withEdges = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Source" s
    WHERE s."ingestedBy" = 'voteview_v1'
    AND EXISTS (SELECT 1 FROM "Edge" e WHERE e."sourceId" = s.id)
  `;
  if (Number(withEdges[0].count) > 0) {
    console.error(`ABORT: ${withEdges[0].count} voteview sources have edges — safe to delete only the edge-free ones.`);
    process.exit(1);
  }

  const sourceCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Source" WHERE "ingestedBy" = 'voteview_v1'
  `;
  const lvCount = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s."ingestedBy" = 'voteview_v1'
  `;
  console.log(`Sources to delete: ${sourceCount[0].count}`);
  console.log(`LegislativeVotes to delete: ${lvCount[0].count}`);

  if (dryRun) {
    console.log('[dry-run] No changes written.');
    return;
  }

  // Delete LegislativeVotes first (FK constraint)
  const deletedLV = await prisma.$executeRaw`
    DELETE FROM "LegislativeVote"
    WHERE "sourceId" IN (
      SELECT id FROM "Source" WHERE "ingestedBy" = 'voteview_v1'
    )
  `;
  console.log(`Deleted ${deletedLV} LegislativeVote records.`);

  const deletedSources = await prisma.$executeRaw`
    DELETE FROM "Source" WHERE "ingestedBy" = 'voteview_v1'
  `;
  console.log(`Deleted ${deletedSources} Source records.`);

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
