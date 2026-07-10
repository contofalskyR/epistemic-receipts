/**
 * backfill-terminal-axis-batch.ts — set-based executor for the axis backfill.
 *
 * SAME semantics as scripts/backfill-terminal-axis.ts (the patch-3 original,
 * left untouched for provenance): stamp Claim.epistemicAxis from the claim's
 * terminal ClaimStatusHistory.toAxis, terminal picked by seq DESC NULLS FIRST,
 * occurredAt DESC, createdAt DESC — byte-identical ordering to the original's
 * Prisma query, which is what the amended STOP-gate ruling reviewed
 * (briefing 18 §2; census scripts/_census-axis-mismatch.ts).
 *
 * WHY THIS EXISTS (2026-07-10 night): the original updates ~825k rows one
 * prisma.claim.update at a time — ~800k sequential round-trips — and Neon
 * dropped the connection mid-run twice (P1001), killing hours of progress.
 * This version does the identical write as ONE server-side statement per
 * 20k-claim batch (~80 round-trips), retries each batch on connection errors
 * with backoff, and persists a keyset cursor to logs/ so a crash resumes
 * where it stopped. Batches are also idempotent (IS DISTINCT FROM guard), so
 * overlap with any prior partial run is harmless.
 *
 * PREFLIGHT BY DEFAULT (counts only, no writes). --execute writes.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-terminal-axis-batch.ts
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-terminal-axis-batch.ts --execute
 *   ... --fresh          ignore the saved cursor, start from the beginning
 */

import "dotenv/config";
import { PrismaClient, Prisma } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");
const FRESH = process.argv.includes("--fresh");
const BATCH = 20000;
const STATE_PATH = path.join(__dirname, "../logs/backfill-terminal-axis-batch.cursor.json");
const MAX_RETRIES = 8;

const CONN_ERRORS = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

function isConnError(e: unknown): boolean {
  const code = (e as { code?: string } | null)?.code;
  if (code && CONN_ERRORS.has(code)) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return /Can't reach database server|Connection reset|ECONNRESET|Closed|terminat/i.test(msg);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (e) {
      if (!isConnError(e) || attempt >= MAX_RETRIES) throw e;
      const backoff = Math.min(30000, 1000 * 2 ** (attempt - 1));
      console.log(`  ! ${label}: connection error (attempt ${attempt}/${MAX_RETRIES}) — retrying in ${backoff / 1000}s`);
      await sleep(backoff);
      // A fresh connection attempt also wakes a suspended Neon compute.
      try { await prisma.$queryRaw`SELECT 1`; } catch { /* wake attempt; retry loop continues */ }
    }
  }
}

interface BatchRow {
  scanned: number;
  updated: number;
  last_id: string | null;
}

function loadCursor(): string | null {
  if (FRESH) return null;
  try {
    const s = JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as { lastId?: string };
    return s.lastId ?? null;
  } catch {
    return null;
  }
}

function saveCursor(lastId: string) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify({ lastId, savedAt: new Date().toISOString() }, null, 2));
}

async function main() {
  console.log(`\n=== axis backfill (set-based) — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"} ===`);
  let cursor = loadCursor();
  if (cursor) console.log(`Resuming from saved cursor ${cursor} (use --fresh to restart).`);

  let totalScanned = 0;
  let totalUpdated = 0;
  const t0 = Date.now();

  for (;;) {
    const cur = cursor ?? "";
    const rows = await withRetry("batch", async (): Promise<BatchRow[]> => {
      if (EXECUTE) {
        return prisma.$queryRaw<BatchRow[]>`
          WITH batch AS (
            SELECT c2.id, term.term
            FROM "Claim" c2
            JOIN LATERAL (
              SELECT h."toAxis" AS term
              FROM "ClaimStatusHistory" h
              WHERE h."claimId" = c2.id
              ORDER BY h.seq DESC NULLS FIRST, h."occurredAt" DESC, h."createdAt" DESC
              LIMIT 1
            ) term ON true
            WHERE c2.id > ${cur}
            ORDER BY c2.id
            LIMIT ${BATCH}
          ),
          upd AS (
            UPDATE "Claim" c
            SET "epistemicAxis" = b.term
            FROM batch b
            WHERE c.id = b.id AND c."epistemicAxis" IS DISTINCT FROM b.term
            RETURNING c.id
          )
          SELECT COUNT(*)::int AS scanned,
                 (SELECT COUNT(*)::int FROM upd) AS updated,
                 MAX(batch.id) AS last_id
          FROM batch`;
      }
      return prisma.$queryRaw<BatchRow[]>`
        WITH batch AS (
          SELECT c2.id, term.term, c2."epistemicAxis" AS stored
          FROM "Claim" c2
          JOIN LATERAL (
            SELECT h."toAxis" AS term
            FROM "ClaimStatusHistory" h
            WHERE h."claimId" = c2.id
            ORDER BY h.seq DESC NULLS FIRST, h."occurredAt" DESC, h."createdAt" DESC
            LIMIT 1
          ) term ON true
          WHERE c2.id > ${cur}
          ORDER BY c2.id
          LIMIT ${BATCH}
        )
        SELECT COUNT(*)::int AS scanned,
               COUNT(*) FILTER (WHERE stored IS DISTINCT FROM term)::int AS updated,
               MAX(batch.id) AS last_id
        FROM batch`;
    });

    const b = rows[0];
    if (!b || b.scanned === 0 || !b.last_id) break;
    totalScanned += b.scanned;
    totalUpdated += b.updated;
    cursor = b.last_id;
    if (EXECUTE) saveCursor(cursor);
    const rate = Math.round(totalScanned / Math.max(1, (Date.now() - t0) / 1000));
    console.log(
      `scanned=${totalScanned} ${EXECUTE ? "updated" : "would-update"}=${totalUpdated} (${rate}/s, cursor ${cursor.slice(-8)})`,
    );
    if (b.scanned < BATCH) break;
  }

  console.log(`\n${EXECUTE ? "EXECUTED" : "DRY RUN"} (set-based)`);
  console.log(`claims scanned (with history, from cursor): ${totalScanned}`);
  console.log(`${EXECUTE ? "updated" : "would update"}:                              ${totalUpdated}`);
  if (EXECUTE) {
    console.log(`Cursor file: ${STATE_PATH} (delete or --fresh to rescan from the top).`);
    console.log(`Verify: re-run without --execute using --fresh — expect would-update ≈ 0.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
