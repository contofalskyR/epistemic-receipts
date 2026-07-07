/**
 * audit-chain-integrity.ts — read-only structural audit of every settling curve.
 *
 * SQL-FIRST (v2): the corpus has ~1.26M claims with history; paging them
 * through Prisma relation queries meant thousands of round trips and 15+ silent
 * minutes. Each invariant is now ONE aggregate query running server-side
 * (window functions over ClaimStatusHistory), so a full-corpus audit takes
 * seconds-to-a-minute and prints per-check progress. Statements run inside a
 * transaction with SET LOCAL statement_timeout='600s' (AGENTS.md rule).
 *
 * Checks:
 *   E1  entry-row count ≠ 1 per claim (fromAxis IS NULL rows)
 *   C1  chain break: row's fromAxis ≠ previous row's toAxis
 *       (ordered by occurredAt, createdAt — the site's render order)
 *   D2  non-entry row precedes claimEmergedAt              (warning)
 *   S1  sourceId set but no matching Source row
 *   A1  degenerate row (fromAxis = toAxis)
 *   V1  axis value outside the FactStatus vocabulary
 *
 * Read-only. Never writes. Exit codes: 0 clean, 1 hard violations
 * (warnings alone exit 0 unless --strict), 2 error.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --direct
 *   ... --pipeline nz_repealed_acts_v1     audit one pipeline's claims
 *   ... --samples 20                       violation examples per check (default 8)
 *   ... --json                             also write logs/chain-integrity-<date>.json
 *   ... --strict                           warnings are failures too
 *   ... --direct                           use DIRECT_URL — recommended; the Neon
 *                                          pooler can kill long statements (P1017)
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { FACT_STATUSES } from "../lib/transition-contract";

// --direct must take effect before the client is constructed (bulk-promote rule).
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

const PIPELINE = argValue("--pipeline"); // null = all pipelines
const SAMPLES = argValue("--samples") ? parseInt(argValue("--samples")!, 10) : 8;
const JSON_OUT = process.argv.includes("--json");
const STRICT = process.argv.includes("--strict");

type ViolationKind = "E1" | "C1" | "D2" | "S1" | "A1" | "V1";
const WARN_KINDS: ReadonlySet<ViolationKind> = new Set<ViolationKind>(["D2"]);

const KIND_LABEL: Record<ViolationKind, string> = {
  E1: "entry-row count ≠ 1",
  C1: "chain break (fromAxis ≠ prior toAxis)",
  D2: "non-entry row precedes claimEmergedAt beyond its precision (warning)",
  S1: "sourceId does not resolve to a Source",
  A1: "degenerate row (same axis AND same community as prior)",
  V1: "axis value outside FactStatus vocabulary",
};

// All queries share $1 = pipeline filter (NULL → all). Bind-parameterized;
// the vocabulary list is inlined from the compile-time constant, not user input.
const VOCAB = FACT_STATUSES.map((s) => `'${s}'`).join(",");

const BASE_JOIN = `
  FROM "ClaimStatusHistory" h
  JOIN "Claim" c ON c."id" = h."claimId" AND c."deleted" = false
  WHERE ($1::text IS NULL OR c."ingestedBy" = $1)`;

interface CheckDef {
  kind: ViolationKind;
  countSql: string;
  sampleSql: string; // must select: pipeline, "claimId", detail (text)
}

const ORDERED_CTE = `
  WITH ordered AS (
    SELECT h."id", h."claimId", h."fromAxis", h."toAxis", h."occurredAt", h."community",
           c."ingestedBy" AS pipeline,
           LAG(h."toAxis")            OVER w AS prev_to,
           LAG(h."community"::text)   OVER w AS prev_comm,
           ROW_NUMBER()               OVER w AS rn
    ${BASE_JOIN}
    WINDOW w AS (PARTITION BY h."claimId" ORDER BY h."occurredAt" ASC, h."createdAt" ASC)
  )`;

// Precision-aware "before": a YEAR-precision row inside the emergence year is
// NOT an inversion — compare at the row's own date grain.
const D2_PREDICATE = `
        AND h."fromAxis" IS NOT NULL
        AND c."claimEmergedAt" IS NOT NULL
        AND (CASE COALESCE(h."datePrecision", 'DAY')
               WHEN 'YEAR'    THEN date_trunc('year',    h."occurredAt") < date_trunc('year',    c."claimEmergedAt")
               WHEN 'QUARTER' THEN date_trunc('quarter', h."occurredAt") < date_trunc('quarter', c."claimEmergedAt")
               WHEN 'MONTH'   THEN date_trunc('month',   h."occurredAt") < date_trunc('month',   c."claimEmergedAt")
               ELSE h."occurredAt" < c."claimEmergedAt"
             END)`;

const CHECKS: CheckDef[] = [
  {
    kind: "E1",
    countSql: `
      SELECT COUNT(*) AS n FROM (
        SELECT h."claimId"
        ${BASE_JOIN}
        GROUP BY h."claimId"
        HAVING COUNT(*) FILTER (WHERE h."fromAxis" IS NULL) <> 1
      ) t`,
    sampleSql: `
      SELECT MIN(c2."ingestedBy") AS pipeline, t."claimId",
             'entry rows: ' || t.entries || ' of ' || t.total AS detail
      FROM (
        SELECT h."claimId",
               COUNT(*) FILTER (WHERE h."fromAxis" IS NULL) AS entries,
               COUNT(*) AS total
        ${BASE_JOIN}
        GROUP BY h."claimId"
        HAVING COUNT(*) FILTER (WHERE h."fromAxis" IS NULL) <> 1
      ) t
      JOIN "Claim" c2 ON c2."id" = t."claimId"
      GROUP BY t."claimId", t.entries, t.total
      LIMIT $2`,
  },
  {
    kind: "C1",
    countSql: `${ORDERED_CTE}
      SELECT COUNT(*) AS n FROM ordered
      WHERE rn > 1 AND ("fromAxis" IS DISTINCT FROM prev_to)`,
    sampleSql: `${ORDERED_CTE}
      SELECT pipeline, "claimId",
             'row ' || "id" || ': fromAxis ' || COALESCE("fromAxis",'∅') ||
             ', prior toAxis ' || COALESCE(prev_to,'∅') AS detail
      FROM ordered
      WHERE rn > 1 AND ("fromAxis" IS DISTINCT FROM prev_to)
      LIMIT $2`,
  },
  {
    kind: "D2",
    countSql: `
      SELECT COUNT(*) AS n ${BASE_JOIN} ${D2_PREDICATE}`,
    sampleSql: `
      SELECT c."ingestedBy" AS pipeline, h."claimId",
             to_char(h."occurredAt",'YYYY-MM-DD') || ' (' || COALESCE(h."datePrecision",'DAY') ||
             ') precedes emergence ' || to_char(c."claimEmergedAt",'YYYY-MM-DD') AS detail
      ${BASE_JOIN} ${D2_PREDICATE}
      LIMIT $2`,
  },
  {
    kind: "S1",
    countSql: `
      SELECT COUNT(*) AS n ${BASE_JOIN}
        AND h."sourceId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Source" s WHERE s."id" = h."sourceId")`,
    sampleSql: `
      SELECT c."ingestedBy" AS pipeline, h."claimId",
             'row ' || h."id" || ' sourceId ' || h."sourceId" || ' orphaned' AS detail
      ${BASE_JOIN}
        AND h."sourceId" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "Source" s WHERE s."id" = h."sourceId")
      LIMIT $2`,
  },
  {
    // Same-axis transitions across DIFFERENT communities are the product's core
    // concept (a claim re-ratified in another lane) — only same-axis re-affirmed
    // by the SAME community carries no information.
    kind: "A1",
    countSql: `${ORDERED_CTE}
      SELECT COUNT(*) AS n FROM ordered
      WHERE rn > 1 AND "fromAxis" = "toAxis" AND "community"::text = prev_comm`,
    sampleSql: `${ORDERED_CTE}
      SELECT pipeline, "claimId",
             "fromAxis" || '→' || "toAxis" || ' (' || "community"::text || ' twice) on row ' || "id" AS detail
      FROM ordered
      WHERE rn > 1 AND "fromAxis" = "toAxis" AND "community"::text = prev_comm
      LIMIT $2`,
  },
  {
    kind: "V1",
    countSql: `
      SELECT COUNT(*) AS n ${BASE_JOIN}
        AND (h."toAxis" NOT IN (${VOCAB})
             OR (h."fromAxis" IS NOT NULL AND h."fromAxis" NOT IN (${VOCAB})))`,
    sampleSql: `
      SELECT c."ingestedBy" AS pipeline, h."claimId",
             'row ' || h."id" || ': ' || COALESCE(h."fromAxis",'∅') || '→' || h."toAxis" AS detail
      ${BASE_JOIN}
        AND (h."toAxis" NOT IN (${VOCAB})
             OR (h."fromAxis" IS NOT NULL AND h."fromAxis" NOT IN (${VOCAB})))
      LIMIT $2`,
  },
];

interface SampleRow { pipeline: string | null; claimId: string; detail: string }
interface CheckResult { kind: ViolationKind; label: string; count: number; samples: SampleRow[] }

async function runWithTimeout<T>(fn: (tx: PrismaClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = '600s'`);
      return fn(tx as unknown as PrismaClient);
    },
    { timeout: 620_000, maxWait: 30_000 },
  );
}

async function main() {
  console.log(
    `\n=== Chain-integrity audit (SQL-first) — ${PIPELINE ?? "all pipelines"}${STRICT ? " [STRICT]" : ""} ===\n`,
  );

  const scanned = await runWithTimeout(async (tx) => {
    const rows = await tx.$queryRawUnsafe<{ claims: bigint; transitions: bigint }[]>(
      `SELECT COUNT(DISTINCT h."claimId") AS claims, COUNT(*) AS transitions ${BASE_JOIN}`,
      PIPELINE,
    );
    return { claims: Number(rows[0].claims), transitions: Number(rows[0].transitions) };
  });
  console.log(`Scope: ${scanned.claims.toLocaleString()} claims, ${scanned.transitions.toLocaleString()} transitions.\n`);

  const results: CheckResult[] = [];
  for (const check of CHECKS) {
    const t0 = Date.now();
    process.stdout.write(`  ${check.kind}  ${KIND_LABEL[check.kind]} … `);
    const count = await runWithTimeout(async (tx) => {
      const rows = await tx.$queryRawUnsafe<{ n: bigint }[]>(check.countSql, PIPELINE);
      return Number(rows[0].n);
    });
    let samples: SampleRow[] = [];
    if (count > 0) {
      samples = await runWithTimeout((tx) =>
        tx.$queryRawUnsafe<SampleRow[]>(check.sampleSql, PIPELINE, SAMPLES),
      );
    }
    results.push({ kind: check.kind, label: KIND_LABEL[check.kind], count, samples });
    console.log(`${count === 0 ? "✓ 0" : count.toLocaleString()}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    for (const s of samples)
      console.log(`        ${s.claimId} [${s.pipeline ?? "?"}] ${s.detail}`);
  }

  // C1 population breakdown — group by pipeline + row-id class so the tail is
  // classifiable (slug rows = contract/bulk writers; cuid rows = Layer-1/legacy;
  // :retraction: rows = populate-retraction-curves).
  const c1Total = results.find((r) => r.kind === "C1")?.count ?? 0;
  if (c1Total > 0) {
    const breakdown = await runWithTimeout((tx) =>
      tx.$queryRawUnsafe<{ pipeline: string; idclass: string; n: bigint }[]>(
        `${ORDERED_CTE}
         SELECT pipeline,
                CASE WHEN "id" LIKE '%:retraction:%' THEN 'retraction-rows'
                     WHEN "id" ~ '-(RECORDED|SETTLED|CONTESTED|OPEN|UNRESOLVABLE|REVERSED|ABANDONED)-\\d{4}-\\d{2}-\\d{2}$' THEN 'slug-rows'
                     ELSE 'cuid-rows' END AS idclass,
                COUNT(*) AS n
         FROM ordered
         WHERE rn > 1 AND ("fromAxis" IS DISTINCT FROM prev_to)
         GROUP BY 1, 2 ORDER BY n DESC`,
        PIPELINE,
      ),
    );
    console.log(`\n  C1 breakdown (pipeline / row class):`);
    for (const b of breakdown)
      console.log(`      ${String(b.pipeline).padEnd(28)} ${b.idclass.padEnd(16)} ${Number(b.n).toLocaleString()}`);
  }

  if (JSON_OUT) {
    const outPath = path.join(
      __dirname,
      `../logs/chain-integrity-${new Date().toISOString().slice(0, 10)}.json`,
    );
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify({ pipeline: PIPELINE, scanned, results }, null, 2));
    console.log(`\nFull report → ${outPath}`);
  }

  const hard = results.filter((r) => !WARN_KINDS.has(r.kind)).reduce((a, r) => a + r.count, 0);
  const warn = results.filter((r) => WARN_KINDS.has(r.kind)).reduce((a, r) => a + r.count, 0);
  console.log(`\n${hard.toLocaleString()} hard violations, ${warn.toLocaleString()} warnings.`);
  process.exitCode = (STRICT ? hard + warn : hard) > 0 ? 1 : 0;
}

main()
  .catch((e) => {
    if (typeof e === "object" && e !== null && (e as { code?: string }).code === "P1017") {
      console.error(
        "\nP1017: the pooled connection was closed mid-statement (Neon pgbouncer). " +
        "Re-run with --direct (uses DIRECT_URL, non-pooled).",
      );
    } else {
      console.error(e);
    }
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
