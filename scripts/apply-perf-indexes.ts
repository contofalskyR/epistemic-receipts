// Applies the perf indexes from migration 20260526150151_add_perf_indexes
// using CREATE INDEX CONCURRENTLY to avoid deadlocks with concurrent ingester writes.
// CONCURRENTLY cannot run inside a transaction — Prisma migrate wraps everything
// in one — so this script runs each statement standalone via $executeRawUnsafe.
//
// Idempotent: uses IF NOT EXISTS. Safe to re-run.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INDEX_STATEMENTS: { name: string; sql: string }[] = [
  { name: "Claim_ingestedBy_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_ingestedBy_idx" ON "Claim"("ingestedBy")` },
  { name: "Claim_claimType_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_claimType_idx" ON "Claim"("claimType")` },
  { name: "Claim_currentStatus_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_currentStatus_idx" ON "Claim"("currentStatus")` },
  { name: "Claim_verificationStatus_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_verificationStatus_idx" ON "Claim"("verificationStatus")` },
  { name: "Claim_createdAt_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_createdAt_idx" ON "Claim"("createdAt")` },
  { name: "Claim_claimEmergedAt_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_claimEmergedAt_idx" ON "Claim"("claimEmergedAt")` },
  { name: "Claim_parentClaimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_parentClaimId_idx" ON "Claim"("parentClaimId")` },
  { name: "Claim_deleted_parentClaimId_claimType_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_deleted_parentClaimId_claimType_idx" ON "Claim"("deleted", "parentClaimId", "claimType")` },
  { name: "Claim_deleted_ingestedBy_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Claim_deleted_ingestedBy_idx" ON "Claim"("deleted", "ingestedBy")` },
  { name: "ClaimTopic_claimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClaimTopic_claimId_idx" ON "ClaimTopic"("claimId")` },
  { name: "Edge_sourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Edge_sourceId_idx" ON "Edge"("sourceId")` },
  { name: "Edge_claimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Edge_claimId_idx" ON "Edge"("claimId")` },
  { name: "Edge_createdAt_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Edge_createdAt_idx" ON "Edge"("createdAt")` },
  { name: "Edge_deleted_claimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Edge_deleted_claimId_idx" ON "Edge"("deleted", "claimId")` },
  { name: "Edge_deleted_sourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Edge_deleted_sourceId_idx" ON "Edge"("deleted", "sourceId")` },
  { name: "EdgeRevision_edgeId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "EdgeRevision_edgeId_idx" ON "EdgeRevision"("edgeId")` },
  { name: "LegislativeVote_sourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "LegislativeVote_sourceId_idx" ON "LegislativeVote"("sourceId")` },
  { name: "LegislativeVote_result_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "LegislativeVote_result_idx" ON "LegislativeVote"("result")` },
  { name: "MetaEdge_claimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "MetaEdge_claimId_idx" ON "MetaEdge"("claimId")` },
  { name: "MetaEdge_targetEdgeId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "MetaEdge_targetEdgeId_idx" ON "MetaEdge"("targetEdgeId")` },
  { name: "MetaEdge_actorSourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "MetaEdge_actorSourceId_idx" ON "MetaEdge"("actorSourceId")` },
  { name: "PoliticalContext_country_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "PoliticalContext_country_idx" ON "PoliticalContext"("country")` },
  { name: "PoliticalContext_hogParty_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "PoliticalContext_hogParty_idx" ON "PoliticalContext"("hogParty")` },
  { name: "PoliticalContext_headOfGovernment_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "PoliticalContext_headOfGovernment_idx" ON "PoliticalContext"("headOfGovernment")` },
  { name: "Source_ingestedBy_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Source_ingestedBy_idx" ON "Source"("ingestedBy")` },
  { name: "Source_createdAt_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Source_createdAt_idx" ON "Source"("createdAt")` },
  { name: "Source_deleted_ingestedBy_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "Source_deleted_ingestedBy_idx" ON "Source"("deleted", "ingestedBy")` },
  { name: "SourceCredibilityEvent_sourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SourceCredibilityEvent_sourceId_idx" ON "SourceCredibilityEvent"("sourceId")` },
  { name: "SourceRelationship_sourceAId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SourceRelationship_sourceAId_idx" ON "SourceRelationship"("sourceAId")` },
  { name: "SourceRelationship_sourceBId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SourceRelationship_sourceBId_idx" ON "SourceRelationship"("sourceBId")` },
  { name: "SuggestedThresholdEvent_claimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SuggestedThresholdEvent_claimId_idx" ON "SuggestedThresholdEvent"("claimId")` },
  { name: "SuggestedThresholdEvent_triggeredBySourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "SuggestedThresholdEvent_triggeredBySourceId_idx" ON "SuggestedThresholdEvent"("triggeredBySourceId")` },
  { name: "ThresholdEvent_claimId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThresholdEvent_claimId_idx" ON "ThresholdEvent"("claimId")` },
  { name: "ThresholdEvent_triggeredBySourceId_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThresholdEvent_triggeredBySourceId_idx" ON "ThresholdEvent"("triggeredBySourceId")` },
  { name: "ThresholdEvent_createdAt_idx", sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS "ThresholdEvent_createdAt_idx" ON "ThresholdEvent"("createdAt")` },
];

async function main() {
  console.log(`Applying ${INDEX_STATEMENTS.length} indexes via CREATE INDEX CONCURRENTLY…`);
  let created = 0;
  let skipped = 0;
  let failed = 0;
  for (const { name, sql } of INDEX_STATEMENTS) {
    const t0 = Date.now();
    try {
      await prisma.$executeRawUnsafe(sql);
      const ms = Date.now() - t0;
      console.log(`✓ ${name} (${ms} ms)`);
      created++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already exists")) {
        console.log(`· ${name} already exists`);
        skipped++;
      } else {
        console.error(`✗ ${name}: ${msg}`);
        failed++;
      }
    }
  }
  console.log(`Done. created=${created} skipped=${skipped} failed=${failed}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
