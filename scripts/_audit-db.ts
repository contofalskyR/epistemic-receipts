import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  console.log('=== DB AUDIT ===\n');

  // 1. Claims with no edges at all (orphaned)
  const orphanedClaims = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim" c
    WHERE c.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."claimId" = c.id)
    AND NOT EXISTS (SELECT 1 FROM "MetaEdge" me WHERE me."claimId" = c.id)
  `;
  console.log(`1. Orphaned claims (no edges, not deleted): ${orphanedClaims[0].count}`);

  // Breakdown by ingestedBy
  const orphanedByIngester = await prisma.$queryRaw<{ ingestedBy: string; count: bigint }[]>`
    SELECT c."ingestedBy", COUNT(*) as count FROM "Claim" c
    WHERE c.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."claimId" = c.id)
    GROUP BY c."ingestedBy"
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log('   By ingestor:', orphanedByIngester.map(r => `${r.ingestedBy}(${r.count})`).join(', '));

  // 2. Sources with no edges (orphaned sources)
  const orphanedSources = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Source" s
    WHERE s.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."sourceId" = s.id)
  `;
  console.log(`\n2. Orphaned sources (no edges, not deleted): ${orphanedSources[0].count}`);

  const orphanedSourcesByIngester = await prisma.$queryRaw<{ ingestedBy: string; count: bigint }[]>`
    SELECT s."ingestedBy", COUNT(*) as count FROM "Source" s
    WHERE s.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."sourceId" = s.id)
    GROUP BY s."ingestedBy"
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log('   By ingestor:', orphanedSourcesByIngester.map(r => `${r.ingestedBy}(${r.count})`).join(', '));

  // 3. Claims with null verificationStatus
  const nullVerif = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim" WHERE deleted = false AND "verificationStatus" IS NULL
  `;
  console.log(`\n3. Claims with null verificationStatus (not deleted): ${nullVerif[0].count}`);

  const nullVerifByIngester = await prisma.$queryRaw<{ ingestedBy: string; count: bigint }[]>`
    SELECT "ingestedBy", COUNT(*) as count FROM "Claim"
    WHERE deleted = false AND "verificationStatus" IS NULL
    GROUP BY "ingestedBy"
    ORDER BY count DESC
    LIMIT 15
  `;
  console.log('   By ingestor:', nullVerifByIngester.map(r => `${r.ingestedBy}(${r.count})`).join(', '));

  // 4. Edges with no EdgeRevisions (missing score)
  const edgesNoRevisions = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Edge" e
    WHERE e.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "EdgeRevision" er WHERE er."edgeId" = e.id)
  `;
  console.log(`\n4. Active edges with no EdgeRevision (no score): ${edgesNoRevisions[0].count}`);

  const edgesNoRevByIngester = await prisma.$queryRaw<{ ingestedBy: string; count: bigint }[]>`
    SELECT e."ingestedBy", COUNT(*) as count FROM "Edge" e
    WHERE e.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "EdgeRevision" er WHERE er."edgeId" = e.id)
    GROUP BY e."ingestedBy"
    ORDER BY count DESC
    LIMIT 10
  `;
  console.log('   By ingestor:', edgesNoRevByIngester.map(r => `${r.ingestedBy}(${r.count})`).join(', '));

  // 5. BookClaims with no BookClaimMatches
  const bookClaimsNoMatches = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "BookClaim" bc
    WHERE NOT EXISTS (SELECT 1 FROM "BookClaimMatch" bcm WHERE bcm."bookClaimId" = bc.id)
  `;
  console.log(`\n5. BookClaims with no BookClaimMatches: ${bookClaimsNoMatches[0].count}`);

  // 6. BookClaimMatches with null reason
  const matchesNullReason = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "BookClaimMatch" WHERE reason IS NULL
  `;
  console.log(`\n6. BookClaimMatches with null reason: ${matchesNullReason[0].count}`);

  // 7. Claims with invalid currentStatus values
  const validStatuses = ['DISPUTED', 'HARD_FACT', 'NEVER_RESOLVES'];
  const invalidStatus = await prisma.$queryRaw<{ currentStatus: string; count: bigint }[]>`
    SELECT "currentStatus", COUNT(*) as count FROM "Claim"
    WHERE deleted = false
    AND "currentStatus" NOT IN ('DISPUTED', 'HARD_FACT', 'NEVER_RESOLVES')
    GROUP BY "currentStatus"
    ORDER BY count DESC
  `;
  if (invalidStatus.length > 0) {
    console.log(`\n7. Claims with invalid currentStatus: ${invalidStatus.map(r => `${r.currentStatus}(${r.count})`).join(', ')}`);
  } else {
    console.log(`\n7. Claims with invalid currentStatus: 0 (all valid)`);
  }

  // 8. Claims with invalid claimType values
  const invalidType = await prisma.$queryRaw<{ claimType: string; count: bigint }[]>`
    SELECT "claimType", COUNT(*) as count FROM "Claim"
    WHERE deleted = false
    AND "claimType" NOT IN ('EMPIRICAL', 'INSTITUTIONAL', 'INTERPRETIVE', 'HYBRID')
    GROUP BY "claimType"
    ORDER BY count DESC
  `;
  if (invalidType.length > 0) {
    console.log(`\n8. Claims with invalid claimType: ${invalidType.map(r => `${r.claimType}(${r.count})`).join(', ')}`);
  } else {
    console.log(`\n8. Claims with invalid claimType: 0 (all valid)`);
  }

  // 9. Sources with invalid methodologyType
  const invalidMethodology = await prisma.$queryRaw<{ methodologyType: string; count: bigint }[]>`
    SELECT "methodologyType", COUNT(*) as count FROM "Source"
    WHERE deleted = false
    AND "methodologyType" NOT IN ('primary', 'derivative', 'opinion')
    GROUP BY "methodologyType"
    ORDER BY count DESC
    LIMIT 10
  `;
  if (invalidMethodology.length > 0) {
    console.log(`\n9. Sources with invalid methodologyType: ${invalidMethodology.map(r => `${r.methodologyType}(${r.count})`).join(', ')}`);
  } else {
    console.log(`\n9. Sources with invalid methodologyType: 0 (all valid)`);
  }

  // 10. Edges referencing deleted sources or claims
  const edgesDeadSource = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Edge" e
    JOIN "Source" s ON s.id = e."sourceId"
    WHERE e.deleted = false AND s.deleted = true
  `;
  console.log(`\n10. Active edges pointing to deleted sources: ${edgesDeadSource[0].count}`);

  const edgesDeadClaim = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Edge" e
    JOIN "Claim" c ON c.id = e."claimId"
    WHERE e.deleted = false AND c.deleted = true
  `;
  console.log(`    Active edges pointing to deleted claims: ${edgesDeadClaim[0].count}`);

  // 11. MetaEdges targeting deleted edges
  const metaEdgesDeadEdge = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "MetaEdge" me
    JOIN "Edge" e ON e.id = me."targetEdgeId"
    WHERE me.deleted = false AND e.deleted = true
  `;
  console.log(`\n11. Active MetaEdges targeting deleted edges: ${metaEdgesDeadEdge[0].count}`);

  // 12. AiJobs stuck in pending/running
  const stuckJobs = await prisma.$queryRaw<{ status: string; count: bigint }[]>`
    SELECT status, COUNT(*) as count FROM "AiJob"
    WHERE status IN ('pending', 'running')
    GROUP BY status
  `;
  if (stuckJobs.length > 0) {
    console.log(`\n12. Stuck AiJobs: ${stuckJobs.map(r => `${r.status}(${r.count})`).join(', ')}`);
  } else {
    console.log(`\n12. Stuck AiJobs: 0`);
  }

  // 13. ThresholdEvents: check for any with deleted=false but claimId pointing to deleted claim
  const deadThresholdEvents = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "ThresholdEvent" te
    JOIN "Claim" c ON c.id = te."claimId"
    WHERE te.deleted = false AND c.deleted = true
  `;
  console.log(`\n13. Active ThresholdEvents on deleted claims: ${deadThresholdEvents[0].count}`);

  // 14. SourceRelationships referencing deleted sources
  const deadSourceRel = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "SourceRelationship" sr
    WHERE EXISTS (SELECT 1 FROM "Source" s WHERE s.id = sr."sourceAId" AND s.deleted = true)
       OR EXISTS (SELECT 1 FROM "Source" s WHERE s.id = sr."sourceBId" AND s.deleted = true)
  `;
  console.log(`\n14. SourceRelationships referencing deleted sources: ${deadSourceRel[0].count}`);

  // 15. WikidataLinks for deleted sources
  const deadWikidata = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "WikidataLink" wl
    JOIN "Source" s ON s.id = wl."sourceId"
    WHERE s.deleted = true
  `;
  console.log(`\n15. WikidataLinks on deleted sources: ${deadWikidata[0].count}`);

  // 16. PoliticalContext for deleted sources
  const deadPolCtx = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "PoliticalContext" pc
    JOIN "Source" s ON s.id = pc."sourceId"
    WHERE s.deleted = true
  `;
  console.log(`\n16. PoliticalContext records on deleted sources: ${deadPolCtx[0].count}`);

  // 17. LegislativeVotes for deleted sources
  const deadLegVotes = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "LegislativeVote" lv
    JOIN "Source" s ON s.id = lv."sourceId"
    WHERE s.deleted = true
  `;
  console.log(`\n17. LegislativeVotes on deleted sources: ${deadLegVotes[0].count}`);

  // 18. Claims with null claimEmergedAt breakdown
  const nullEmergedAt = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim"
    WHERE deleted = false AND "claimEmergedAt" IS NULL
  `;
  console.log(`\n18. Active claims with null claimEmergedAt: ${nullEmergedAt[0].count}`);

  // 19. Edges with invalid type values
  const invalidEdgeType = await prisma.$queryRaw<{ type: string; count: bigint }[]>`
    SELECT type, COUNT(*) as count FROM "Edge"
    WHERE deleted = false
    AND type NOT IN ('FOR', 'AGAINST', 'CITES', 'RETRACTS', 'CORRECTED')
    GROUP BY type
    ORDER BY count DESC
  `;
  if (invalidEdgeType.length > 0) {
    console.log(`\n19. Edges with invalid type: ${invalidEdgeType.map(r => `${r.type}(${r.count})`).join(', ')}`);
  } else {
    console.log(`\n19. Edges with invalid type: 0 (all valid)`);
  }

  // 20. Claims with parentClaimId pointing to non-existent or deleted claims
  const badParent = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim" c
    WHERE c.deleted = false AND c."parentClaimId" IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "Claim" p WHERE p.id = c."parentClaimId" AND p.deleted = false)
  `;
  console.log(`\n20. Claims with broken/deleted parentClaimId: ${badParent[0].count}`);

  // 21. Duplicate externalIds (should be unique, but check for nulls + any races)
  const dupExternalIds = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "externalId" FROM "Claim" WHERE "externalId" IS NOT NULL GROUP BY "externalId" HAVING COUNT(*) > 1
    ) sub
  `;
  console.log(`\n21. Duplicate Claim.externalIds: ${dupExternalIds[0].count}`);

  const dupSourceExtIds = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM (
      SELECT "externalId" FROM "Source" WHERE "externalId" IS NOT NULL GROUP BY "externalId" HAVING COUNT(*) > 1
    ) sub
  `;
  console.log(`    Duplicate Source.externalIds: ${dupSourceExtIds[0].count}`);

  // 22. Deprecated claims (verificationStatus = DEPRECATED) — are they all deleted=false?
  const deprecatedClaims = await prisma.$queryRaw<{ deleted: boolean; count: bigint }[]>`
    SELECT deleted, COUNT(*) as count FROM "Claim"
    WHERE "verificationStatus" = 'DEPRECATED'
    GROUP BY deleted
  `;
  console.log(`\n22. DEPRECATED claims by deleted flag: ${deprecatedClaims.map(r => `deleted=${r.deleted}(${r.count})`).join(', ')}`);

  // 23. Edges with invalid evidenceType
  const invalidEvidType = await prisma.$queryRaw<{ evidenceType: string; count: bigint }[]>`
    SELECT "evidenceType", COUNT(*) as count FROM "Edge"
    WHERE deleted = false
    AND "evidenceType" NOT IN ('EVIDENTIARY', 'PROCEDURAL', 'ARGUMENTATIVE')
    GROUP BY "evidenceType"
  `;
  if (invalidEvidType.length > 0) {
    console.log(`\n23. Edges with invalid evidenceType: ${invalidEvidType.map(r => `${r.evidenceType}(${r.count})`).join(', ')}`);
  } else {
    console.log(`\n23. Edges with invalid evidenceType: 0 (all valid)`);
  }

  // 24. Claims missing text (empty string)
  const emptyText = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim" WHERE deleted = false AND (text IS NULL OR text = '')
  `;
  console.log(`\n24. Active claims with empty/null text: ${emptyText[0].count}`);

  // 25. Sources missing name (empty string)
  const emptySourceName = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Source" WHERE deleted = false AND (name IS NULL OR name = '')
  `;
  console.log(`\n25. Active sources with empty/null name: ${emptySourceName[0].count}`);

  // 26. ClaimTopic entries pointing to deleted claims
  const deadClaimTopics = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "ClaimTopic" ct
    JOIN "Claim" c ON c.id = ct."claimId"
    WHERE c.deleted = true
  `;
  console.log(`\n26. ClaimTopic entries pointing to deleted claims: ${deadClaimTopics[0].count}`);

  // 27. Claims with autoApproved=true but humanReviewed=true (conflicting signals)
  const conflictingReview = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT COUNT(*) as count FROM "Claim"
    WHERE deleted = false AND "autoApproved" = true AND "humanReviewed" = true
  `;
  console.log(`\n27. Claims with both autoApproved=true AND humanReviewed=true: ${conflictingReview[0].count}`);

  // Summary table
  console.log('\n=== SUMMARY TABLE ===');
  console.log('Issue | Count | Severity');
  console.log('------|-------|----------');
  console.log(`Edges missing EdgeRevision (no score) | ${edgesNoRevisions[0].count} | HIGH`);
  console.log(`Claims with null verificationStatus | ${nullVerif[0].count} | HIGH`);
  console.log(`Orphaned sources (no edges) | ${orphanedSources[0].count} | MEDIUM`);
  console.log(`Orphaned claims (no edges) | ${orphanedClaims[0].count} | MEDIUM`);
  console.log(`BookClaims with no matches | ${bookClaimsNoMatches[0].count} | LOW`);
  console.log(`BookClaimMatches with null reason | ${matchesNullReason[0].count} | LOW`);
  console.log(`Active edges → deleted sources | ${edgesDeadSource[0].count} | HIGH`);
  console.log(`Active edges → deleted claims | ${edgesDeadClaim[0].count} | HIGH`);

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
