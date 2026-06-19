/**
 * One-shot migration: replace ALL ConstituentOpinion rows for `health` and
 * `foreign_policy` with fresh data from the CCES extraction that uses actual
 * year-specific policy questions (ACA / military force) where available,
 * falling back to pid3 (dem_pct) for years without a direct item.
 *
 * Reads:   /tmp/cces/cces_aggregates.json  (output of _cces_extract.py)
 * Writes:  ConstituentOpinion table (Neon Postgres via Prisma)
 *
 * Usage:
 *   npx tsx scripts/_fix-cces-policy-items.ts           # dry-run (default)
 *   npx tsx scripts/_fix-cces-policy-items.ts --apply    # actually write
 */
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import * as fs from "fs";

if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

function makePrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

const AGGREGATES_PATH = "/tmp/cces/cces_aggregates.json";
const TOPICS = ["health", "foreign_policy"];

interface AggRow {
  state: string;
  district: string | null;
  year: number;
  topicSlug: string;
  supportPct: number;
  sampleSize: number;
  source: string;
  questionCode: string;
  metadata: Record<string, unknown>;
}

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(
    `[fix-cces-policy-items] mode=${dryRun ? "DRY-RUN (pass --apply to write)" : "APPLY"}`,
  );

  // Load aggregates
  if (!fs.existsSync(AGGREGATES_PATH)) {
    console.error(`ERROR: ${AGGREGATES_PATH} not found. Run _cces_extract.py first.`);
    process.exit(1);
  }
  const allRows: AggRow[] = JSON.parse(fs.readFileSync(AGGREGATES_PATH, "utf-8"));
  console.log(`[fix-cces-policy-items] loaded ${allRows.length} total rows from aggregates`);

  // Filter to only health & foreign_policy
  const rows = allRows.filter((r) => TOPICS.includes(r.topicSlug));
  console.log(`[fix-cces-policy-items] ${rows.length} rows for health + foreign_policy`);

  // Stats
  for (const topic of TOPICS) {
    const topicRows = rows.filter((r) => r.topicSlug === topic);
    const direct = topicRows.filter((r) => r.questionCode !== "dem");
    const fallback = topicRows.filter((r) => r.questionCode === "dem");
    console.log(
      `  ${topic}: ${topicRows.length} total, ${direct.length} direct-item, ${fallback.length} dem-fallback`,
    );
    // Show unique question codes
    const codes = [...new Set(direct.map((r) => r.questionCode))];
    console.log(`    question codes: ${codes.join(", ")}`);
  }

  if (dryRun) {
    console.log("\n[DRY-RUN] Would delete all existing health + foreign_policy rows and insert fresh.");
    console.log("[DRY-RUN] Pass --apply to execute.");
    return;
  }

  const prisma = makePrisma();
  try {
    // Step 1: Delete all existing rows for these two topics
    for (const topic of TOPICS) {
      const deleted = await prisma.constituentOpinion.deleteMany({
        where: { topicSlug: topic },
      });
      console.log(`[delete] ${topic}: removed ${deleted.count} rows`);
    }

    // Step 2: Insert fresh rows in batches
    const BATCH_SIZE = 100;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      const batch = rows.slice(i, i + BATCH_SIZE);
      await prisma.constituentOpinion.createMany({
        data: batch.map((r) => ({
          state: r.state,
          district: r.district,
          year: r.year,
          topicSlug: r.topicSlug,
          supportPct: r.supportPct,
          sampleSize: r.sampleSize,
          source: r.source,
          questionCode: r.questionCode,
          metadata: r.metadata as any,
        })),
        skipDuplicates: true,
      });
      inserted += batch.length;
      if ((i / BATCH_SIZE) % 5 === 0) {
        console.log(`  inserted ${inserted}/${rows.length}...`);
      }
    }
    console.log(`[insert] total inserted: ${inserted}`);

    // Step 3: Verify
    for (const topic of TOPICS) {
      const total = await prisma.constituentOpinion.count({
        where: { topicSlug: topic },
      });
      const direct = await prisma.constituentOpinion.count({
        where: { topicSlug: topic, NOT: { questionCode: "dem" } },
      });
      const fallback = await prisma.constituentOpinion.count({
        where: { topicSlug: topic, questionCode: "dem" },
      });
      console.log(
        `[verify] ${topic}: total=${total} direct=${direct} dem-fallback=${fallback}`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
