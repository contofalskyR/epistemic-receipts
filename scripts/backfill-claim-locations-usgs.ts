import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const BATCH_SIZE = 500;

async function main() {
  console.log('Starting USGS earthquake ClaimLocation backfill...');

  const total = await prisma.claim.count({
    where: { ingestedBy: 'usgs_eq_v1', deleted: false },
  });
  console.log(`Total USGS claims: ${total}`);

  // Get IDs already backfilled to skip them
  const alreadyDone = new Set(
    (await prisma.claimLocation.findMany({
      where: { source: 'usgs_event' },
      select: { claimId: true },
    })).map((r) => r.claimId)
  );
  console.log(`Already have ClaimLocation rows: ${alreadyDone.size}`);

  let offset = 0;
  let inserted = 0;
  let skipped = 0;
  let noCoords = 0;

  while (true) {
    const claims = await prisma.claim.findMany({
      where: { ingestedBy: 'usgs_eq_v1', deleted: false },
      select: { id: true, metadata: true },
      skip: offset,
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
    });

    if (claims.length === 0) break;

    const toInsert: {
      claimId: string;
      lat: number;
      lon: number;
      source: string;
      precision: string;
      externalRef?: string;
    }[] = [];

    for (const claim of claims) {
      if (alreadyDone.has(claim.id)) {
        skipped++;
        continue;
      }

      const meta = claim.metadata as Record<string, unknown> | null;
      if (!meta || typeof meta.lat !== 'number' || typeof meta.lon !== 'number') {
        noCoords++;
        continue;
      }

      toInsert.push({
        claimId: claim.id,
        lat: meta.lat as number,
        lon: meta.lon as number,
        source: 'usgs_event',
        precision: 'EXACT',
        externalRef: typeof meta.eventId === 'string' ? meta.eventId : undefined,
      });
    }

    if (toInsert.length > 0) {
      await prisma.claimLocation.createMany({
        data: toInsert,
        skipDuplicates: true,
      });
      inserted += toInsert.length;
    }

    offset += claims.length;
    console.log(`Progress: ${offset}/${total} processed, ${inserted} inserted, ${skipped} skipped, ${noCoords} missing coords`);

    if (claims.length < BATCH_SIZE) break;
  }

  console.log(`\nDone. Inserted: ${inserted} | Skipped (already existed): ${skipped} | Missing coords: ${noCoords}`);
}

main()
  .catch((e) => {
    console.error('Fatal error:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
