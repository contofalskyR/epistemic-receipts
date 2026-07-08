/**
 * census-dateless-claims.ts — briefing 02 step 1: where are the curve-less
 * claims, and do their records carry recoverable dates?
 *
 * READ-ONLY. Never writes. For every pipeline with claims that have NO
 * ClaimStatusHistory rows, reports:
 *
 *   noHistory      claims with zero history rows (invisible to the curve product)
 *   dateless       …of those, claimEmergedAt IS NULL (Layer 1 skipped them — correct)
 *   datedNoCurve   …claimEmergedAt present but STILL no history → pipeline has
 *                  no Layer-1 template (template list parsed live from
 *                  ingest-auto-trajectories.ts, so this never goes stale)
 *   srcDate%       share of dateless claims whose primary Source has publishedAt
 *                  (a recoverable date — using it is a per-pipeline decision)
 *   date-ish metadata keys + sample values (500-claim sample per pipeline)
 *
 * The output table is the input for phase B: metadata key present → cheap
 * batched UPDATE backfill; srcDate high → source-date backfill; neither →
 * source-API sweep or honest residue.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/census-dateless-claims.ts --direct
 *   ... --top 15        pipelines to deep-sample (default 15, by dateless count)
 *   ... --json          also write logs/census-dateless-<date>.json
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const TOP = argValue("--top") ? parseInt(argValue("--top")!, 10) : 15;
const JSON_OUT = process.argv.includes("--json");

const DATEISH = /date|year|time|published|issued|filed|enacted|assent|decided|adopted|signed|registered|created_at|occurred/i;

async function withTimeout<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`);
      return fn(tx as unknown as PrismaClient);
    },
    { timeout: 620_000, maxWait: 30_000 },
  );
}

/** Layer-1 template keys, parsed live from the generator source. */
function templatedPipelines(): Set<string> {
  try {
    const src = fs.readFileSync(path.join(__dirname, "ingest-auto-trajectories.ts"), "utf8");
    const keys = new Set<string>();
    for (const m of src.matchAll(/^\s{2}([a-z0-9_]+):\s*\{\s*toAxis/gm)) keys.add(m[1]);
    return keys;
  } catch {
    console.warn("(could not parse ingest-auto-trajectories.ts — template column will read n/a)");
    return new Set();
  }
}

interface PipelineRow {
  pipeline: string;
  noHistory: number;
  dateless: number;
  datedNoCurve: number;
  hasTemplate: boolean;
  srcDatePct: number | null;
  dateishKeys: { key: string; pct: number; samples: string[] }[];
}

async function main() {
  console.log(`\n=== Census: curve-less claims — read-only ===\n`);
  const templates = templatedPipelines();
  console.log(`Layer-1 templates parsed: ${templates.size} pipelines\n`);

  // ── 1. The headline table ────────────────────────────────────────────────
  const rows = await withTimeout((tx) =>
    tx.$queryRawUnsafe<Array<{ pipeline: string; noHistory: bigint; dateless: bigint }>>(`
      SELECT c."ingestedBy" AS pipeline,
             COUNT(*) AS "noHistory",
             COUNT(*) FILTER (WHERE c."claimEmergedAt" IS NULL) AS "dateless"
        FROM "Claim" c
       WHERE c."deleted" = false
         AND (c."verificationStatus" IS NULL OR c."verificationStatus" <> 'DEPRECATED')
         AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c."id")
       GROUP BY 1
       ORDER BY 2 DESC
    `),
  );

  const table: PipelineRow[] = rows.map((r) => ({
    pipeline: r.pipeline,
    noHistory: Number(r.noHistory),
    dateless: Number(r.dateless),
    datedNoCurve: Number(r.noHistory) - Number(r.dateless),
    hasTemplate: templates.has(r.pipeline),
    srcDatePct: null,
    dateishKeys: [],
  }));

  const totals = table.reduce(
    (a, r) => ({ noHistory: a.noHistory + r.noHistory, dateless: a.dateless + r.dateless }),
    { noHistory: 0, dateless: 0 },
  );
  console.log(
    `TOTAL curve-less: ${totals.noHistory.toLocaleString()} claims ` +
    `(${totals.dateless.toLocaleString()} dateless, ${(totals.noHistory - totals.dateless).toLocaleString()} dated-but-untemplated)\n`,
  );

  // ── 2. Deep-sample the top pipelines ─────────────────────────────────────
  const deep = table.slice(0, TOP);
  for (const row of deep) {
    if (row.dateless > 0) {
      // Source.publishedAt availability among the dateless.
      const src = await withTimeout((tx) =>
        tx.$queryRawUnsafe<Array<{ n: bigint; withdate: bigint }>>(
          `SELECT COUNT(*) AS n,
                  COUNT(*) FILTER (WHERE s."publishedAt" IS NOT NULL) AS withdate
             FROM "Claim" c
             LEFT JOIN LATERAL (
               SELECT s2."publishedAt"
                 FROM "Edge" e JOIN "Source" s2 ON s2."id" = e."sourceId"
                WHERE e."claimId" = c."id" AND e."deleted" = false
                ORDER BY e."createdAt" ASC LIMIT 1
             ) s ON true
            WHERE c."deleted" = false AND c."ingestedBy" = $1
              AND c."claimEmergedAt" IS NULL
              AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c."id")`,
          row.pipeline,
        ),
      );
      const n = Number(src[0].n);
      row.srcDatePct = n > 0 ? Math.round((Number(src[0].withdate) / n) * 100) : null;

      // Metadata keys over a 500-claim sample; date-ish ones get value samples.
      const keys = await withTimeout((tx) =>
        tx.$queryRawUnsafe<Array<{ key: string; n: bigint }>>(
          `SELECT k AS key, COUNT(*) AS n
             FROM (
               SELECT jsonb_object_keys(c2."metadata") AS k
                 FROM (
                   SELECT c."metadata"
                     FROM "Claim" c
                    WHERE c."deleted" = false AND c."ingestedBy" = $1
                      AND c."claimEmergedAt" IS NULL AND c."metadata" IS NOT NULL
                      AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c."id")
                    LIMIT 500
                 ) c2
             ) t
            GROUP BY 1 ORDER BY 2 DESC`,
          row.pipeline,
        ),
      );
      for (const k of keys) {
        if (!DATEISH.test(k.key)) continue;
        const vals = await withTimeout((tx) =>
          tx.$queryRawUnsafe<Array<{ v: string | null }>>(
            `SELECT c."metadata"->>$2 AS v
               FROM "Claim" c
              WHERE c."deleted" = false AND c."ingestedBy" = $1
                AND c."claimEmergedAt" IS NULL
                AND c."metadata"->>$2 IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c."id")
              LIMIT 3`,
            row.pipeline,
            k.key,
          ),
        );
        row.dateishKeys.push({
          key: k.key,
          pct: Math.round((Number(k.n) / Math.min(500, row.dateless)) * 100),
          samples: vals.map((v) => String(v.v).slice(0, 40)),
        });
      }
    }

    // Print the row as we go — long scans should show progress.
    const flag = row.hasTemplate ? "" : "  ⚠ NO LAYER-1 TEMPLATE";
    console.log(
      `${row.pipeline.padEnd(34)} noHistory ${String(row.noHistory).padStart(8)} · dateless ${String(row.dateless).padStart(8)}` +
      ` · dated-untemplated ${String(row.datedNoCurve).padStart(7)}` +
      (row.srcDatePct != null ? ` · srcDate ${String(row.srcDatePct).padStart(3)}%` : "") +
      flag,
    );
    for (const k of row.dateishKeys)
      console.log(`    metadata.${k.key} (${k.pct}% of sample) e.g. ${k.samples.join(" | ")}`);
  }

  if (table.length > TOP) {
    console.log(`\n… ${table.length - TOP} smaller pipelines (${table
      .slice(TOP)
      .reduce((a, r) => a + r.noHistory, 0)
      .toLocaleString()} claims) — in the JSON report.`);
  }

  if (JSON_OUT) {
    const outPath = path.join(__dirname, `../logs/census-dateless-${new Date().toISOString().slice(0, 10)}.json`);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ totals, templatesParsed: templates.size, table }, null, 2));
    console.log(`\nFull report → ${outPath}`);
  }

  console.log(
    `\nReading the table:\n` +
    `  dated-untemplated > 0  → I add a Layer-1 template (+ completeness entry); no backfill needed.\n` +
    `  metadata date key      → cheap batched-UPDATE backfill from the field shown.\n` +
    `  srcDate% high          → backfill from the primary Source's publishedAt (per-pipeline decision).\n` +
    `  none of the above      → source-API sweep, or honest residue (stays curve-less).`,
  );
}

main()
  .catch((e) => {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P1017") {
      console.error("\nP1017 (pooled connection closed) — re-run with --direct.");
    } else {
      console.error(e);
    }
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
