// DESTRUCTIVE — DO NOT RUN without review
//
// Deletes orphaned Source records from nih_reporter_v1 (4,854) and
// uspto_v1 (142) that have no edges and are not referenced by any other model.
//
// Context:
// - nih_reporter_v1 has 1,354 claims in the registry but 4,854 orphaned sources.
//   These sources were likely created during a pipeline run where some source
//   records failed to produce corresponding edges or claims.
//   BLOCKER: 4,956 SourceRelationship records reference these sources.
//   Must delete those SourceRelationships first (or cascade from them) before
//   this script can proceed.
// - uspto_v1 is retired (Pipeline 5). Its 142 orphaned sources have no claims
//   associated (those 182 claims have no edges either, and are correctly DEPRECATED).
//   BLOCKER: 209 SourceRelationship records reference these sources.
//   Must resolve those first.
//
// Before running: verify there are no other model references to these sources
// (PoliticalContext, WikidataLink, LegislativeVote, SourceRelationship).
// This script checks automatically.
//
// Run with: npx tsx scripts/_audit-fixes/cleanup-nih-orphaned-sources.ts
// Dry-run:  npx tsx scripts/_audit-fixes/cleanup-nih-orphaned-sources.ts --dry-run

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TARGET_INGESTORS = ['nih_reporter_v1', 'uspto_v1'];

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  for (const ingestor of TARGET_INGESTORS) {
    // Find orphaned source IDs
    const orphaned = await prisma.$queryRaw<{ id: string }[]>`
      SELECT s.id FROM "Source" s
      WHERE s."ingestedBy" = ${ingestor}
      AND s.deleted = false
      AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."sourceId" = s.id)
    `;
    const ids = orphaned.map(r => r.id);
    console.log(`${ingestor}: ${ids.length} orphaned sources`);

    if (ids.length === 0) continue;

    // Safety: check for any child records
    const hasPolCtx = await prisma.politicalContext.count({ where: { sourceId: { in: ids } } });
    const hasWikidata = await prisma.wikidataLink.count({ where: { sourceId: { in: ids } } });
    const hasLV = await prisma.legislativeVote.count({ where: { sourceId: { in: ids } } });
    const hasSR = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "SourceRelationship"
      WHERE "sourceAId" = ANY(${ids}::text[]) OR "sourceBId" = ANY(${ids}::text[])
    `;
    const hasMetaEdge = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) as count FROM "MetaEdge"
      WHERE "actorSourceId" = ANY(${ids}::text[])
    `;

    if (hasPolCtx || hasWikidata || hasLV || Number(hasSR[0].count) || Number(hasMetaEdge[0].count)) {
      console.warn(`  ${ingestor} has child records — skipping:`,
        { polCtx: hasPolCtx, wikidata: hasWikidata, lv: hasLV,
          sr: hasSR[0].count, metaEdge: hasMetaEdge[0].count });
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Would delete ${ids.length} sources`);
      continue;
    }

    const deleted = await prisma.source.deleteMany({ where: { id: { in: ids } } });
    console.log(`  Deleted ${deleted.count} Source records for ${ingestor}.`);
  }

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
