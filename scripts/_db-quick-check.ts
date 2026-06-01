import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const [claims, deletedClaims, edges, sources, books, bookChunks, bookClaims, bookMatches, votes, polities, historicalEvents] = await Promise.all([
    prisma.claim.count({ where: { deleted: false } }),
    prisma.claim.count({ where: { deleted: true } }),
    prisma.edge.count({ where: { deleted: false } }),
    prisma.source.count({ where: { deleted: false } }),
    prisma.book.count(),
    prisma.bookChunk.count(),
    prisma.bookClaim.count(),
    prisma.bookClaimMatch.count(),
    prisma.legislativeVote.count(),
    prisma.polity.count(),
    prisma.historicalEvent.count(),
  ]);

  // Claims with no edges (orphaned - source has no edge to it)
  const orphanedClaims = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Claim" c
    WHERE c.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."claimId" = c.id AND e.deleted = false)
  ` as any[];

  // BookClaims with no matches
  const bookClaimsNoMatch = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "BookClaim" bc
    WHERE NOT EXISTS (SELECT 1 FROM "BookClaimMatch" bcm WHERE bcm."bookClaimId" = bc.id)
  ` as any[];

  // Claims with null verification
  const nullVerification = await prisma.claim.count({ where: { verificationStatus: null, deleted: false } });
  
  // Duplicate external IDs
  const dupExternalIds = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM (
      SELECT "externalId", COUNT(*) FROM "Claim" WHERE "externalId" IS NOT NULL GROUP BY "externalId" HAVING COUNT(*) > 1
    ) x
  ` as any[];

  // Sources with no edges
  const sourcesNoEdge = await prisma.$queryRaw`
    SELECT COUNT(*)::int as cnt FROM "Source" s
    WHERE s.deleted = false
    AND NOT EXISTS (SELECT 1 FROM "Edge" e WHERE e."sourceId" = s.id AND e.deleted = false)
  ` as any[];

  console.log(JSON.stringify({
    claims, deletedClaims, edges, sources, books, bookChunks, bookClaims, bookMatches,
    votes, polities, historicalEvents,
    orphanedClaims: orphanedClaims[0].cnt,
    bookClaimsNoMatch: bookClaimsNoMatch[0].cnt,
    nullVerification,
    dupExternalIds: dupExternalIds[0].cnt,
    sourcesNoEdge: sourcesNoEdge[0].cnt,
  }, null, 2));

  await prisma.$disconnect();
}
main().catch(console.error);
