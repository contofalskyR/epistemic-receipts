import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  // List all books
  const books = await prisma.book.findMany({ select: { id: true, title: true } });
  console.log('Books:\n' + books.map(b => `  ${b.id}: ${b.title}`).join('\n'));
  
  // Matches summary
  const rows = await prisma.$queryRaw`
    SELECT b.title, 
      COUNT(*)::int as total_matches,
      COUNT(*) FILTER (WHERE bcm.reason IS NOT NULL AND bcm.reason != '')::int as with_reason
    FROM "BookClaimMatch" bcm 
    JOIN "BookClaim" bc ON bcm."bookClaimId" = bc.id
    JOIN "BookChunk" bch ON bc."chunkId" = bch.id
    JOIN "Book" b ON bch."bookId" = b.id
    GROUP BY b.id, b.title
    ORDER BY total_matches DESC
  ` as any[];
  console.log('\nMatches:');
  for (const r of rows) {
    console.log(`  ${r.title}: ${r.total_matches} total, ${r.with_reason} with reason`);
  }
  await prisma.$disconnect();
}
main().catch(console.error);
