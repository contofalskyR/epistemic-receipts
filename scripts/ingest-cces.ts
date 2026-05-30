/**
 * Ingest CCES (Cooperative Election Study) constituent opinion aggregates into
 * `ConstituentOpinion`. Powers the /analysis/representation page.
 *
 * Pipeline:
 *   1. `scripts/_cces_extract.py` reads the 675MB Stata file
 *      `/tmp/cces/cumulative.dta` (Harvard Dataverse doi:10.7910/DVN/II2DB6,
 *      "Cumulative CES Common Content" — Kuriwaki 2025, V11, 2006–2024) and
 *      writes aggregated per (state, year, topic) support% to
 *      `/tmp/cces/cces_aggregates.json`.
 *   2. This script reads that JSON and upserts into `ConstituentOpinion`.
 *
 * Source signal: the cumulative file only carries cross-year-standardized
 * variables, not the year-specific policy yes/no items, so support% is built
 * from ideology (ideo5), party-ID (pid3), and demographic policy proxies
 * (uninsured rate, union membership, evangelical share). The per-topic
 * direction-mapping lives in `_cces_extract.py`.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/ingest-cces.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- \
 *     npx ts-node --project tsconfig.scripts.json scripts/ingest-cces.ts --full
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

interface AggregateRow {
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

const DEFAULT_INPUT = "/tmp/cces/cces_aggregates.json";
const PIPELINE_TAG = "cces_v1";

function makePrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = !args.has("--full");
  const inputPath = resolve(
    process.argv.find((a) => a.startsWith("--input="))?.slice("--input=".length) ?? DEFAULT_INPUT,
  );

  console.log(`[${PIPELINE_TAG}] mode=${dryRun ? "DRY-RUN" : "FULL"} input=${inputPath}`);

  if (!dryRun && process.env.ALLOW_EDITS !== "true") {
    console.error(`[${PIPELINE_TAG}] refusing to run --full without ALLOW_EDITS=true`);
    process.exit(2);
  }

  const raw = await readFile(inputPath, "utf8");
  const rows = JSON.parse(raw) as AggregateRow[];
  console.log(`[${PIPELINE_TAG}] loaded ${rows.length.toLocaleString()} aggregates`);

  // Sanity validation.
  const stateSet = new Set<string>();
  const topicSet = new Set<string>();
  const yearSet = new Set<number>();
  for (const r of rows) {
    if (typeof r.state !== "string" || r.state.length !== 2) {
      throw new Error(`Bad state in row: ${JSON.stringify(r)}`);
    }
    if (typeof r.year !== "number" || r.year < 2000 || r.year > 2030) {
      throw new Error(`Bad year in row: ${JSON.stringify(r)}`);
    }
    if (typeof r.supportPct !== "number" || r.supportPct < 0 || r.supportPct > 100) {
      throw new Error(`Bad supportPct in row: ${JSON.stringify(r)}`);
    }
    stateSet.add(r.state);
    topicSet.add(r.topicSlug);
    yearSet.add(r.year);
  }
  console.log(
    `[${PIPELINE_TAG}] states=${stateSet.size} years=${[...yearSet].sort().join(",")} topics=${topicSet.size}`,
  );

  if (dryRun) {
    console.log(`[${PIPELINE_TAG}] dry-run: 5 sample rows below, no writes.`);
    rows.slice(0, 5).forEach((r) => console.log(JSON.stringify(r)));
    return;
  }

  const prisma = makePrisma();
  try {
    let written = 0;
    let updated = 0;
    let skipped = 0;
    const BATCH = 200;
    for (let i = 0; i < rows.length; i += BATCH) {
      const slice = rows.slice(i, i + BATCH);
      await prisma.$transaction(
        async (tx) => {
          for (const r of slice) {
            // questionCode is required by the unique index (NULLs are not equal
            // in PG, so we always set it).
            const existing = await tx.constituentOpinion.findFirst({
              where: {
                state: r.state,
                district: r.district ?? null,
                year: r.year,
                topicSlug: r.topicSlug,
                questionCode: r.questionCode,
              },
              select: { id: true, supportPct: true, sampleSize: true },
            });
            if (existing) {
              if (
                Math.abs(existing.supportPct - r.supportPct) < 1e-6 &&
                existing.sampleSize === r.sampleSize
              ) {
                skipped += 1;
                continue;
              }
              await tx.constituentOpinion.update({
                where: { id: existing.id },
                data: {
                  supportPct: r.supportPct,
                  sampleSize: r.sampleSize,
                  source: r.source,
                  metadata: r.metadata as never,
                },
              });
              updated += 1;
            } else {
              await tx.constituentOpinion.create({
                data: {
                  state: r.state,
                  district: r.district ?? null,
                  year: r.year,
                  topicSlug: r.topicSlug,
                  supportPct: r.supportPct,
                  sampleSize: r.sampleSize,
                  source: r.source,
                  questionCode: r.questionCode,
                  metadata: r.metadata as never,
                },
              });
              written += 1;
            }
          }
        },
        { timeout: 60000 },
      );
      if ((i / BATCH) % 10 === 0) {
        console.log(
          `[${PIPELINE_TAG}] progress ${Math.min(i + BATCH, rows.length).toLocaleString()}/${rows.length.toLocaleString()} written=${written} updated=${updated} skipped=${skipped}`,
        );
      }
    }
    console.log(
      `[${PIPELINE_TAG}] done. written=${written} updated=${updated} skipped=${skipped}`,
    );

    const dbCount = await prisma.constituentOpinion.count({
      where: { source: { contains: "cces_cumulative" } },
    });
    console.log(`[${PIPELINE_TAG}] DB verification: ConstituentOpinion rows = ${dbCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
