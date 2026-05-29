// DESTRUCTIVE — DO NOT RUN without review
//
// Deletes 311 BookClaim records that have zero BookClaimMatches.
// These are book claims extracted from chunks that were never matched against
// any DB Claims — either the matcher was never run for their book, or the
// matcher ran but found nothing similar enough.
//
// Cascades: BookClaim.matches has onDelete: Cascade, so deleting a BookClaim
// also deletes its BookClaimMatches (none to delete for these 311 records).
//
// Impact: any UI rendering that shows book claims for these chunks will show
// fewer claims. The chunks themselves (BookChunk) are NOT deleted.
//
// Run with: npx tsx scripts/_audit-fixes/cleanup-unmatched-book-claims.ts
// Dry-run:  npx tsx scripts/_audit-fixes/cleanup-unmatched-book-claims.ts --dry-run

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const dryRun = process.argv.includes('--dry-run');

  const unmatchedIds = await prisma.$queryRaw<{ id: string; claimText: string }[]>`
    SELECT bc.id, bc."claimText"
    FROM "BookClaim" bc
    WHERE NOT EXISTS (SELECT 1 FROM "BookClaimMatch" bcm WHERE bcm."bookClaimId" = bc.id)
    ORDER BY bc.id
  `;
  console.log(`BookClaims with no matches: ${unmatchedIds.length}`);

  // Show breakdown by book
  const byBook = await prisma.$queryRaw<{ title: string; count: bigint }[]>`
    SELECT b.title, COUNT(bc.id)::int as count
    FROM "BookClaim" bc
    JOIN "BookChunk" bch ON bch.id = bc."chunkId"
    JOIN "Book" b ON b.id = bch."bookId"
    WHERE NOT EXISTS (SELECT 1 FROM "BookClaimMatch" bcm WHERE bcm."bookClaimId" = bc.id)
    GROUP BY b.title
    ORDER BY count DESC
  `;
  console.log('By book:', byBook.map(r => `${r.title}(${r.count})`).join(', '));

  if (dryRun) {
    console.log('[dry-run] No changes written.');
    return;
  }

  const ids = unmatchedIds.map(r => r.id);
  const deleted = await prisma.bookClaim.deleteMany({
    where: { id: { in: ids } },
  });
  console.log(`Deleted ${deleted.count} BookClaim records.`);

  await prisma.$disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
