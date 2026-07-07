/**
 * Backfill script: generate ClaimEmbedding rows for all non-deleted claims.
 *
 * Features:
 *   - Resumable: cursor-based, skips claims already embedded with the same contentHash
 *   - Batched: 2048 texts per OpenAI API call (model max)
 *   - Kill-restart safe: contentHash deduplication prevents re-spend on unchanged content
 *   - Spend guard: EMBEDDING_MAX_TOKENS_PER_RUN hard cap per run
 *
 * Usage:
 *   OPENAI_API_KEY=sk-... npx tsx scripts/backfill-embeddings.ts
 *   OPENAI_API_KEY=sk-... EMBEDDING_MAX_TOKENS_PER_RUN=5000000 npx tsx scripts/backfill-embeddings.ts
 *   npx tsx scripts/backfill-embeddings.ts --dry-run
 *   npx tsx scripts/backfill-embeddings.ts --limit 1000  (process only first 1000 claims)
 *
 * Estimated cost: text-embedding-3-small = $0.02 / 1M tokens
 *   ~1M claims × ~50 tokens avg = ~50M tokens ≈ $1.00 total
 *
 * Env vars:
 *   OPENAI_API_KEY         required
 *   DATABASE_URL           required
 *   EMBEDDING_MAX_TOKENS_PER_RUN  optional hard cap (e.g. 5000000 = 5M tokens ≈ $0.10)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import {
  embedMany3Small,
  buildEmbedText,
  hashContent,
  MODEL_ID,
  getTokensSpent,
  resetTokensSpent,
} from '../lib/embeddings';

const prisma = new PrismaClient();

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  return {
    dryRun: args.includes('--dry-run'),
    limit: (() => {
      const idx = args.indexOf('--limit');
      if (idx >= 0 && args[idx + 1]) return parseInt(args[idx + 1], 10);
      return null;
    })(),
    verbose: args.includes('--verbose'),
  };
}

// ── Config ────────────────────────────────────────────────────────────────────

const BATCH_SIZE = 2048;       // OpenAI max inputs per embedding request
const DB_PAGE_SIZE = 500;      // Claims fetched from DB per page (memory budget)
const UPSERT_BATCH = 100;      // DB upserts per Prisma call

// ── Helpers ───────────────────────────────────────────────────────────────────

type ClaimWithTopics = {
  id: string;
  text: string;
  ingestedBy: string;
  topics: { topic: { name: string } }[];
};

function buildText(claim: ClaimWithTopics): string {
  const topicNames = claim.topics.map(t => t.topic.name);
  return buildEmbedText(claim.text, topicNames, claim.ingestedBy);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit: claimLimit, verbose } = parseArgs();

  console.log(`\nBackfill embeddings — model=${MODEL_ID}`);
  if (dryRun) console.log('DRY RUN — no writes');
  if (claimLimit) console.log(`Limit: ${claimLimit} claims`);

  // Reset spend counter for this run
  resetTokensSpent();

  // Count total non-deleted claims for progress reporting
  const totalClaims = await prisma.claim.count({ where: { deleted: false } });
  console.log(`Total non-deleted claims: ${totalClaims}`);

  let cursor: string | undefined;
  let processedTotal = 0;
  let embeddedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  while (true) {
    if (claimLimit !== null && processedTotal >= claimLimit) {
      console.log(`Reached --limit ${claimLimit}, stopping.`);
      break;
    }

    // Fetch a page of claims (cursor-based for resumability)
    const pageSize = claimLimit !== null
      ? Math.min(DB_PAGE_SIZE, claimLimit - processedTotal)
      : DB_PAGE_SIZE;

    const claims = await prisma.claim.findMany({
      where: { deleted: false },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        text: true,
        ingestedBy: true,
        topics: {
          take: 3,
          select: { topic: { select: { name: true } } },
        },
      },
    });

    if (claims.length === 0) break;
    cursor = claims[claims.length - 1].id;

    // Build embed texts and compute content hashes
    const candidates: Array<{ claim: ClaimWithTopics; text: string; hash: string }> = claims.map(c => {
      const text = buildText(c);
      return { claim: c, text, hash: hashContent(text) };
    });

    // Look up existing embeddings for this batch to find what needs re-embedding
    const claimIds = candidates.map(c => c.claim.id);
    const existing = await prisma.$queryRawUnsafe<Array<{ claimId: string; contentHash: string }>>(
      `SELECT "claimId", "contentHash" FROM "ClaimEmbedding" WHERE "claimId" = ANY($1::text[])`,
      claimIds,
    );
    const existingMap = new Map(existing.map(e => [e.claimId, e.contentHash]));

    // Filter to only claims that need (re-)embedding
    const toEmbed = candidates.filter(c => {
      const existingHash = existingMap.get(c.claim.id);
      if (existingHash === c.hash) {
        skippedCount++;
        return false; // content unchanged — skip
      }
      return true;
    });

    if (verbose) {
      console.log(`Page: ${claims.length} claims, ${toEmbed.length} to embed, ${claims.length - toEmbed.length} unchanged`);
    }

    processedTotal += claims.length;

    if (toEmbed.length === 0) continue;
    if (dryRun) {
      embeddedCount += toEmbed.length;
      continue;
    }

    // Process in BATCH_SIZE chunks (OpenAI limit)
    for (let i = 0; i < toEmbed.length; i += BATCH_SIZE) {
      const batch = toEmbed.slice(i, i + BATCH_SIZE);

      try {
        const vectors = await embedMany3Small(batch.map(c => c.text));

        // Upsert in DB_UPSERT_BATCH chunks
        for (let j = 0; j < batch.length; j += UPSERT_BATCH) {
          const upsertBatch = batch.slice(j, j + UPSERT_BATCH);
          const vectorBatch = vectors.slice(j, j + UPSERT_BATCH);

          await Promise.all(upsertBatch.map((c, k) => {
            const vecStr = `[${vectorBatch[k].join(',')}]`;
            return prisma.$executeRawUnsafe(
              `INSERT INTO "ClaimEmbedding" ("id", "claimId", "embedding", "model", "contentHash", "updatedAt")
               VALUES (gen_random_uuid()::text, $1, $2::vector, $3, $4, NOW())
               ON CONFLICT ("claimId") DO UPDATE SET
                 "embedding" = EXCLUDED."embedding",
                 "model" = EXCLUDED."model",
                 "contentHash" = EXCLUDED."contentHash",
                 "updatedAt" = NOW()`,
              c.claim.id,
              vecStr,
              MODEL_ID,
              c.hash,
            );
          }));

          embeddedCount += upsertBatch.length;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('spend guard')) {
          console.error(`\nSpend guard triggered: ${msg}`);
          console.log(`Progress: ${processedTotal}/${totalClaims} claims processed, ${embeddedCount} embedded`);
          process.exit(2);
        }
        console.error(`Error embedding batch at offset ${i}: ${msg}`);
        errorCount += batch.length;
      }
    }

    const pct = ((processedTotal / totalClaims) * 100).toFixed(1);
    const tokensK = Math.round(getTokensSpent() / 1000);
    process.stdout.write(`\r[${pct}%] ${processedTotal}/${totalClaims} processed | ${embeddedCount} embedded | ${skippedCount} skipped | ${tokensK}k tokens`);
  }

  console.log('\n\n── Summary ────────────────────────────────────────────');
  console.log(`Claims processed:  ${processedTotal}`);
  console.log(`Embeddings written: ${embeddedCount}`);
  console.log(`Skipped (unchanged): ${skippedCount}`);
  console.log(`Errors:             ${errorCount}`);
  console.log(`Tokens spent:       ${getTokensSpent().toLocaleString()}`);
  console.log(`Est. cost:          $${(getTokensSpent() / 1_000_000 * 0.02).toFixed(4)}`);

  // Coverage check
  const withEmbedding = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT count(*)::bigint AS count
     FROM "Claim" c
     JOIN "ClaimEmbedding" ce ON ce."claimId" = c."id"
     WHERE c."deleted" = false AND ce."embedding" IS NOT NULL`
  );
  const without = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT count(*)::bigint AS count
     FROM "Claim" c
     LEFT JOIN "ClaimEmbedding" ce ON ce."claimId" = c."id"
     WHERE c."deleted" = false AND (ce."embedding" IS NULL OR ce."id" IS NULL)`
  );
  console.log(`\nCoverage: ${withEmbedding[0].count} have embeddings, ${without[0].count} still missing`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
