/**
 * Enriches retraction claims with 1-sentence summaries using Claude.
 * Uses batches of 20 papers per claude --print call for efficiency.
 * Stores result in claim metadata.summary field.
 * Usage: npx tsx scripts/enrich-retraction-summaries.ts [--limit N] [--model haiku|opus]
 */

import { spawnSync } from "child_process";
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Parse CLI args
const args = process.argv.slice(2);
const limitIdx = args.indexOf("--limit");
const modelIdx = args.indexOf("--model");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 500 : 500;
const modelArg = modelIdx !== -1 ? args[modelIdx + 1] : "haiku";

const MODEL =
  modelArg === "opus"
    ? "claude-opus-4-5"
    : "claude-haiku-4-5";

const BATCH_SIZE = 20;

type ClaimRow = {
  id: string;
  metadata: unknown;
};

async function main() {
  console.log(`Starting retraction summary enrichment`);
  console.log(`  Limit: ${limit} papers`);
  console.log(`  Model: ${MODEL}`);
  console.log(`  Batch size: ${BATCH_SIZE}`);
  console.log();

  // Fetch claims that need summaries
  const rows = await prisma.$queryRawUnsafe<ClaimRow[]>(
    `SELECT id, metadata
     FROM "Claim"
     WHERE "ingestedBy" = 'crossref_retractions_v1'
       AND (metadata->>'summary') IS NULL
       AND deleted = false
     ORDER BY "claimEmergedAt" DESC NULLS LAST
     LIMIT $1`,
    limit
  );

  console.log(`Found ${rows.length} claims without summaries`);

  if (rows.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  let enriched = 0;
  let skipped = 0;

  // Process in batches
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const batchInput = batch.map((r) => {
      const m = r.metadata as Record<string, unknown>;
      return {
        title: (m?.title as string) ?? "(untitled)",
        journal: (m?.journal as string) ?? null,
        updateType: (m?.updateType as string) ?? "Retraction",
      };
    });

    const prompt =
      `For each of the following retracted papers, write exactly one sentence explaining what the paper studied or claimed, and if the update type is Retraction (not Correction/Withdrawal/Reinstatement) add a brief note on what category of problem typically causes such retractions (data fabrication, statistical errors, duplicate publication, etc.). Use only the title, journal, and update type as evidence — do not invent specific reasons. Format: return a JSON array of strings, one per paper, in the same order.\n\nPapers:\n${JSON.stringify(batchInput)}\n\nReturn ONLY a JSON array like: ["Summary 1.", "Summary 2."]`;

    const result = spawnSync(
      "claude",
      ["--print", "--model", MODEL, prompt],
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      }
    );

    if (result.error) {
      console.error(`  [batch ${i / BATCH_SIZE + 1}] spawn error:`, result.error.message);
      skipped += batch.length;
      continue;
    }

    const stdout = (result.stdout ?? "").trim();

    // Extract JSON array from response (claude may wrap it in markdown)
    let summaries: string[] = [];
    try {
      // Try direct parse first
      const parsed = JSON.parse(stdout);
      if (Array.isArray(parsed)) {
        summaries = parsed.map(String);
      } else {
        throw new Error("Not an array");
      }
    } catch {
      // Try to extract JSON array from markdown code block
      const match = stdout.match(/```(?:json)?\s*([\s\S]*?)```/) ??
                    stdout.match(/(\[[\s\S]*\])/);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]);
          if (Array.isArray(parsed)) {
            summaries = parsed.map(String);
          }
        } catch {
          // fall through
        }
      }
      if (summaries.length === 0) {
        console.error(`  [batch ${i / BATCH_SIZE + 1}] Failed to parse response. stdout snippet: ${stdout.slice(0, 200)}`);
        skipped += batch.length;
        continue;
      }
    }

    // Write summaries back
    for (let j = 0; j < batch.length; j++) {
      const claim = batch[j];
      const summary = summaries[j];
      if (!summary) {
        skipped++;
        continue;
      }

      const existingMeta = (claim.metadata as Record<string, unknown>) ?? {};
      await prisma.claim.update({
        where: { id: claim.id },
        data: {
          metadata: { ...existingMeta, summary } as Record<string, unknown>,
        },
      });
      enriched++;
    }

    // Progress logging every 100 papers
    if (enriched % 100 === 0 && enriched > 0) {
      console.log(`  Progress: ${enriched} enriched, ${skipped} skipped`);
    }

    // Log each batch
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(rows.length / BATCH_SIZE);
    console.log(`  Batch ${batchNum}/${totalBatches}: ${summaries.length} summaries written`);
  }

  console.log();
  console.log(`Done. Enriched: ${enriched}, Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
