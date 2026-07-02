/**
 * Batch-embed all TrajectorySearchDoc rows using OpenAI text-embedding-3-small.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/embed-trajectories.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/embed-trajectories.ts --force
 *
 * Requires OPENAI_API_KEY in the environment.
 */

import { PrismaClient } from "@prisma/client";
import { embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const BATCH_SIZE = 100;
const force = process.argv.includes("--force");

async function main() {
  const prisma = new PrismaClient();

  try {
    // Count total and already-embedded
    const total = await prisma.trajectorySearchDoc.count();
    const alreadyEmbedded = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "TrajectorySearchDoc" WHERE embedding IS NOT NULL`
    );
    const embeddedCount = Number(alreadyEmbedded[0].count);

    console.log(`Total TrajectorySearchDoc rows: ${total}`);
    console.log(`Already embedded: ${embeddedCount}`);

    if (!force && embeddedCount === total) {
      console.log("All rows already have embeddings. Use --force to re-embed.");
      return;
    }

    // Fetch rows to embed
    const whereClause = force
      ? `SELECT id, "claimId", "fullText" FROM "TrajectorySearchDoc" ORDER BY id`
      : `SELECT id, "claimId", "fullText" FROM "TrajectorySearchDoc" WHERE embedding IS NULL ORDER BY id`;

    const rows = await prisma.$queryRawUnsafe<
      Array<{ id: string; claimId: string; fullText: string }>
    >(whereClause);

    console.log(`Rows to embed: ${rows.length}`);

    let processed = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      const texts = batch.map((r) => r.fullText);

      // Embed the batch
      const { embeddings } = await embedMany({
        model: openai.embedding("text-embedding-3-small"),
        values: texts,
      });

      // Update each row with its embedding via raw SQL
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const vec = `[${embeddings[j].join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "TrajectorySearchDoc" SET embedding = $1::vector WHERE "claimId" = $2`,
          vec,
          row.claimId
        );
      }

      processed += batch.length;
      console.log(`Embedded ${processed}/${rows.length} (batch ${Math.floor(i / BATCH_SIZE) + 1})`);
    }

    console.log(`Done. Embedded ${processed} rows.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
