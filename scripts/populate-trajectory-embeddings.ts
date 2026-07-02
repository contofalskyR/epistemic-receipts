/**
 * Populate TrajectorySearchDoc embeddings using local all-MiniLM-L6-v2 model.
 * No API key needed — runs entirely on CPU via transformers.js.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/populate-trajectory-embeddings.ts
 *   npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/populate-trajectory-embeddings.ts --force
 */

import { PrismaClient } from "@prisma/client";

// Dynamic import to avoid top-level ESM issues with ts-node in CJS mode
async function loadEmbedder() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { pipeline } = require("@xenova/transformers");
  const pipe = await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
  return pipe;
}

const BATCH_SIZE = 50;
const DIM = 384;
const force = process.argv.includes("--force");

async function main() {
  const prisma = new PrismaClient();
  const pipe = await loadEmbedder();
  console.log("Model loaded.");

  try {
    const total = await prisma.trajectorySearchDoc.count();
    const alreadyEmbedded = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
      `SELECT COUNT(*) as count FROM "TrajectorySearchDoc" WHERE embedding IS NOT NULL`,
    );
    const embeddedCount = Number(alreadyEmbedded[0].count);

    console.log(`Total TrajectorySearchDoc rows: ${total}`);
    console.log(`Already embedded: ${embeddedCount}`);

    if (!force && embeddedCount === total) {
      console.log("All rows already have embeddings. Use --force to re-embed.");
      return;
    }

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

      // Batch embed
      const output = await pipe(texts, { pooling: "mean", normalize: true });
      const data = output.data as Float32Array;

      // Update each row with its embedding
      for (let j = 0; j < batch.length; j++) {
        const row = batch[j];
        const vec = Array.from(data.slice(j * DIM, (j + 1) * DIM));
        const vecStr = `[${vec.join(",")}]`;
        await prisma.$executeRawUnsafe(
          `UPDATE "TrajectorySearchDoc" SET embedding = $1::vector WHERE "claimId" = $2`,
          vecStr,
          row.claimId,
        );
      }

      processed += batch.length;
      console.log(
        `Embedded ${processed}/${rows.length} (batch ${Math.floor(i / BATCH_SIZE) + 1})`,
      );
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
