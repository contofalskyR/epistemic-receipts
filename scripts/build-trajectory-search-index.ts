/**
 * Populates TrajectorySearchDoc with concatenated claim text + transition reasons
 * for each curated trajectory. Run after new trajectories are added.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/build-trajectory-search-index.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BATCH_SIZE = 200;

async function main() {
  const total = await prisma.claim.count({
    where: { externalId: { startsWith: "trajectory:" }, deleted: false },
  });
  console.log(`Found ${total} trajectories to index`);

  let processed = 0;
  let page = 0;

  while (processed < total) {
    const claims = await prisma.claim.findMany({
      where: { externalId: { startsWith: "trajectory:" }, deleted: false },
      skip: page * BATCH_SIZE,
      take: BATCH_SIZE,
      select: {
        id: true,
        text: true,
        statusHistory: {
          select: { reason: true },
        },
      },
    });

    if (claims.length === 0) break;

    await Promise.all(
      claims.map((claim) => {
        const reasons = claim.statusHistory
          .map((h) => h.reason)
          .filter(Boolean)
          .join(" ");
        const fullText = [claim.text, reasons].filter(Boolean).join(" ");

        return prisma.trajectorySearchDoc.upsert({
          where: { claimId: claim.id },
          create: { claimId: claim.id, fullText },
          update: { fullText },
        });
      }),
    );

    processed += claims.length;
    page++;
    console.log(`Indexed ${processed}/${total}`);
  }

  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
