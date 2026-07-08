/**
 * backfill-transition-seq.ts — one-time stamp of ClaimStatusHistory.seq
 * (ORDERING-SEMANTICS-2026-07-08.md, Option B as approved).
 *
 * Three passes, cheapest truth first:
 *
 *   A (SQL, ~1.2M rows): single-row claims → seq = 1.
 *   B (SQL): multi-row, fully-unstamped claims whose (occurredAt, createdAt)
 *     order is BOTH strictly increasing on occurredAt AND chain-coherent
 *     (row 1 is the entry row; every later row's fromAxis = previous toAxis)
 *     → stamp ROW_NUMBER. For these, date order and pointer order agree, so
 *     there is nothing to decide. Restricted to fully-unstamped claims so a
 *     single UPDATE can never transiently collide with an existing stamp.
 *   C (app): the remainder — date ties, pointer/date disagreements, partial
 *     stamps from an interrupted run. Pointer-chain walk from the entry row;
 *     branches (rows sharing a fromAxis, the cross-community lane pattern) are
 *     broken by (occurredAt, createdAt) ONLY when dates strictly disambiguate.
 *     Underivable claims (branch ties, orphan breaks, entry-count anomalies)
 *     go to logs/seq-backfill-residue.jsonl — listed, never guessed.
 *     Per Robert 2026-07-08: where a unique linear pointer chain exists it
 *     WINS over date order (the date sort is what lies on the ~290 arcs).
 *
 * PREFLIGHT BY DEFAULT: counts + residue simulation, zero writes. --execute
 * writes. Resumable: fully-stamped claims are skipped by every pass.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-transition-seq.ts --direct            # preflight
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-transition-seq.ts --direct --execute  # write
 *
 * After --execute: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --direct
 * (its C2 seq check must come back clean).
 */

import "dotenv/config";

// --direct must take effect before the client is constructed (bulk-promote rule).
if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");
const LIMIT_C = ((): number | null => {
  const i = process.argv.indexOf("--limit");
  return i !== -1 && process.argv[i + 1] ? parseInt(process.argv[i + 1], 10) : null;
})();

const RESIDUE_PATH = path.join("logs", "seq-backfill-residue.jsonl");
const TIMEOUT_SQL = "SET LOCAL statement_timeout = '600s'";
const TX_OPTS = { timeout: 660_000, maxWait: 60_000 };

// Pass B's "date order and pointers agree" claim set, as one window query.
// Fully-unstamped multi-row claims only (see header).
const B_OK_CTE = `
  multi AS (
    SELECT "claimId"
    FROM "ClaimStatusHistory"
    GROUP BY "claimId"
    HAVING COUNT(*) > 1 AND bool_and("seq" IS NULL)
  ),
  ranked AS (
    SELECT h."id", h."claimId", h."fromAxis", h."occurredAt",
           ROW_NUMBER() OVER w AS rn,
           LAG(h."toAxis") OVER w AS prev_to,
           LAG(h."occurredAt") OVER w AS prev_at
    FROM "ClaimStatusHistory" h
    JOIN multi ON multi."claimId" = h."claimId"
    WINDOW w AS (PARTITION BY h."claimId" ORDER BY h."occurredAt" ASC, h."createdAt" ASC)
  ),
  ok AS (
    SELECT "claimId"
    FROM ranked
    GROUP BY "claimId"
    HAVING bool_and(
      (rn = 1 AND "fromAxis" IS NULL)
      OR (rn > 1 AND "fromAxis" IS NOT DISTINCT FROM prev_to AND "occurredAt" > prev_at)
    )
  )`;

type Row = {
  id: string;
  claimId: string;
  fromAxis: string | null;
  toAxis: string;
  occurredAt: Date;
  createdAt: Date;
  seq: number | null;
};

type WalkResult = { order: Row[] } | { residue: string };

/** Pointer-chain walk; branches broken by strict date order only. Exported for
 *  offline unit tests — importing this module does not run main() (see guard). */
export function walkChain(rows: Row[]): WalkResult {
  const entries = rows.filter((r) => r.fromAxis === null);
  if (entries.length !== 1) return { residue: `entry-rows=${entries.length}` };
  const order: Row[] = [entries[0]];
  const remaining = new Set(rows.filter((r) => r !== entries[0]));
  while (remaining.size > 0) {
    const cur = order[order.length - 1];
    const candidates = [...remaining].filter((r) => r.fromAxis === cur.toAxis);
    if (candidates.length === 0) return { residue: "orphan-break" };
    candidates.sort(
      (a, b) =>
        a.occurredAt.getTime() - b.occurredAt.getTime() ||
        a.createdAt.getTime() - b.createdAt.getTime() ||
        a.id.localeCompare(b.id),
    );
    if (
      candidates.length > 1 &&
      candidates[0].occurredAt.getTime() === candidates[1].occurredAt.getTime()
    )
      return { residue: "branch-tie" };
    order.push(candidates[0]);
    remaining.delete(candidates[0]);
  }
  return { order };
}

async function main() {
  console.log(
    `\n=== backfill-transition-seq — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (nothing written)"}${LIMIT_C ? `, pass-C limit ${LIMIT_C}` : ""} ===`,
  );

  // ── Pass A: single-row claims ───────────────────────────────────────────────
  const [aCount] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`
    SELECT COUNT(*)::bigint AS n
    FROM "ClaimStatusHistory" h
    JOIN (
      SELECT "claimId" FROM "ClaimStatusHistory" GROUP BY "claimId" HAVING COUNT(*) = 1
    ) one ON one."claimId" = h."claimId"
    WHERE h."seq" IS DISTINCT FROM 1`);
  console.log(`\nPass A (single-row claims → seq=1): ${aCount.n} rows to stamp`);
  if (EXECUTE && Number(aCount.n) > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(TIMEOUT_SQL);
      const n = await tx.$executeRawUnsafe(`
        UPDATE "ClaimStatusHistory" AS h
        SET "seq" = 1
        FROM (
          SELECT "claimId" FROM "ClaimStatusHistory" GROUP BY "claimId" HAVING COUNT(*) = 1
        ) one
        WHERE h."claimId" = one."claimId" AND h."seq" IS DISTINCT FROM 1`);
      console.log(`  stamped ${n}`);
    }, TX_OPTS);
  }

  // ── Pass B: date-strict, chain-coherent multi-row claims ───────────────────
  const [bCount] = await prisma.$queryRawUnsafe<{ claims: bigint; rows: bigint }[]>(`
    WITH ${B_OK_CTE}
    SELECT COUNT(DISTINCT ok."claimId")::bigint AS claims, COUNT(*)::bigint AS rows
    FROM ranked r JOIN ok ON ok."claimId" = r."claimId"`);
  console.log(`Pass B (date-strict + coherent multi-row): ${bCount.claims} claims / ${bCount.rows} rows`);
  if (EXECUTE && Number(bCount.rows) > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(TIMEOUT_SQL);
      const n = await tx.$executeRawUnsafe(`
        WITH ${B_OK_CTE}
        UPDATE "ClaimStatusHistory" AS h
        SET "seq" = r.rn
        FROM ranked r
        JOIN ok ON ok."claimId" = r."claimId"
        WHERE h."id" = r."id"`);
      console.log(`  stamped ${n}`);
    }, TX_OPTS);
  }

  // ── Pass C: the remainder — pointer walk in app code ────────────────────────
  // In execute mode A+B have landed, so "any NULL seq left" IS the remainder.
  // In preflight, exclude what A and B WOULD stamp.
  const cClaimIds = EXECUTE
    ? await prisma.$queryRawUnsafe<{ claimId: string }[]>(`
        SELECT "claimId"
        FROM "ClaimStatusHistory"
        GROUP BY "claimId"
        HAVING NOT bool_and("seq" IS NOT NULL)
        ORDER BY "claimId"`)
    : await prisma.$queryRawUnsafe<{ claimId: string }[]>(`
        WITH ${B_OK_CTE}
        SELECT "claimId"
        FROM "ClaimStatusHistory"
        GROUP BY "claimId"
        HAVING NOT bool_and("seq" IS NOT NULL) AND COUNT(*) > 1
           AND "claimId" NOT IN (SELECT "claimId" FROM ok)
        ORDER BY "claimId"`);
  const cTargets = LIMIT_C ? cClaimIds.slice(0, LIMIT_C) : cClaimIds;
  console.log(`Pass C (pointer walk): ${cClaimIds.length} claims${LIMIT_C ? `, processing ${cTargets.length}` : ""}`);

  const counts = { walked: 0, stamped: 0, residue: 0 };
  const residueReasons = new Map<string, number>();
  if (EXECUTE) fs.mkdirSync(path.dirname(RESIDUE_PATH), { recursive: true });

  // Fast path for fully-unstamped claims (the overwhelming case, 2026-07-08
  // preflight: 205,872 of 205,875): every target seq lands on rows whose seq
  // is NULL, so no NULL-phase is needed and many claims batch into ONE
  // bind-parameterized VALUES update. Partially-stamped claims (interrupted
  // runs) keep the per-claim NULL-phase transaction.
  let fastPairs: { id: string; seq: number }[] = [];
  async function flushFast() {
    if (fastPairs.length === 0) return;
    const pairs = fastPairs;
    fastPairs = [];
    await prisma.$executeRaw(
      Prisma.sql`UPDATE "ClaimStatusHistory" AS h
                 SET "seq" = v.seq
                 FROM (VALUES ${Prisma.join(
                   pairs.map((p) => Prisma.sql`(${p.id}, ${p.seq})`),
                 )}) AS v(id, seq)
                 WHERE h."id" = v.id`,
    );
  }

  const CHUNK = 500;
  for (let i = 0; i < cTargets.length; i += CHUNK) {
    const chunk = cTargets.slice(i, i + CHUNK).map((r) => r.claimId);
    const rows = await prisma.claimStatusHistory.findMany({
      where: { claimId: { in: chunk } },
      select: {
        id: true, claimId: true, fromAxis: true, toAxis: true,
        occurredAt: true, createdAt: true, seq: true,
      },
    });
    const byClaim = new Map<string, Row[]>();
    for (const r of rows) {
      const list = byClaim.get(r.claimId) ?? [];
      list.push(r);
      byClaim.set(r.claimId, list);
    }

    for (const [claimId, claimRows] of byClaim) {
      counts.walked++;
      const result = walkChain(claimRows);
      if ("residue" in result) {
        counts.residue++;
        residueReasons.set(result.residue, (residueReasons.get(result.residue) ?? 0) + 1);
        if (EXECUTE)
          fs.appendFileSync(
            RESIDUE_PATH,
            JSON.stringify({ claimId, rows: claimRows.length, reason: result.residue, ts: new Date().toISOString() }) + "\n",
          );
        continue;
      }
      counts.stamped++;
      if (EXECUTE) {
        const fullyUnstamped = claimRows.every((r) => r.seq === null);
        if (fullyUnstamped) {
          for (let s = 0; s < result.order.length; s++)
            fastPairs.push({ id: result.order[s].id, seq: s + 1 });
          if (fastPairs.length >= 1000) await flushFast();
        } else {
          await prisma.$transaction(async (tx) => {
            // NULL-phase per claim so rewrites never collide with stale stamps.
            await tx.claimStatusHistory.updateMany({ where: { claimId }, data: { seq: null } });
            for (let s = 0; s < result.order.length; s++) {
              await tx.claimStatusHistory.update({
                where: { id: result.order[s].id },
                data: { seq: s + 1 },
              });
            }
          });
        }
      }
      if (counts.walked % 2000 === 0)
        console.log(`  … pass C ${counts.walked}/${cTargets.length} (residue ${counts.residue})`);
    }
  }

  if (EXECUTE) await flushFast();

  console.log(`\n── Summary (${EXECUTE ? "EXECUTED" : "PREFLIGHT — nothing written"}) ──`);
  console.log({
    passA_rows: Number(aCount.n),
    passB_claims: Number(bCount.claims),
    passB_rows: Number(bCount.rows),
    passC_claims: cClaimIds.length,
    passC_processed: counts.walked,
    passC_stamped_claims: counts.stamped,
    passC_residue_claims: counts.residue,
  });
  if (residueReasons.size)
    console.log("Residue reasons:", Object.fromEntries([...residueReasons.entries()].sort()));
  if (EXECUTE) {
    const [left] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT COUNT(*)::bigint AS n FROM "ClaimStatusHistory" WHERE "seq" IS NULL`,
    );
    console.log(`Rows still unstamped (should equal residue rows): ${left.n}`);
    console.log(`Residue queue: ${RESIDUE_PATH}`);
    console.log(`\nVerify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --direct`);
  } else {
    console.log(`\nRe-run with --execute to stamp. Pass C pilot: add --limit 50.`);
  }
}

// Guarded so unit tests can import walkChain without running the backfill.
// (PrismaClient is lazy — a pure import never connects.)
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 2;
    })
    .finally(() => prisma.$disconnect());
}
