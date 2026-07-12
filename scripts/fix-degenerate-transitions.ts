/**
 * fix-degenerate-transitions.ts — targeted repair for the A1 population the
 * chain-integrity audit finds (run the audit first; this script's detection
 * query is the audit's own A1 predicate).
 *
 * FIX degenerate rows (A1, ~143 rows): a row where fromAxis = toAxis AND the
 * community is the same as the prior row's — a claim "transitioning" to the
 * axis it is already in, re-affirmed by the same community. No information is
 * carried by the row (same-axis re-affirmation by a DIFFERENT community is the
 * product's core concept and is NOT flagged). The entry row (fromAxis IS NULL)
 * can never be A1, so deleting flagged rows never empties a claim's history —
 * confirmed defensively below rather than assumed.
 *
 * Because a degenerate row's toAxis equals its own fromAxis, removing it does
 * not change the axis the NEXT row inherits — no fromAxis rewrite is needed on
 * surviving rows, only a seq renumber per touched claim (gaps left by deletion).
 *
 * PREFLIGHT BY DEFAULT. Writes need --execute plus --allow-row-delete (the one
 * operation the transition contract has no primitive for).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/fix-degenerate-transitions.ts --direct
 *   ... --execute --allow-row-delete --direct
 *
 * After: re-run audit-chain-integrity — A1 should be 0.
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { renumberClaimSeq } from "../lib/transition-contract";

if (process.argv.includes("--direct")) {
  if (!process.env.DIRECT_URL) {
    console.error("--direct passed but DIRECT_URL is not set");
    process.exit(1);
  }
  process.env.DATABASE_URL = process.env.DIRECT_URL;
}

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");
const ALLOW_DELETE = process.argv.includes("--allow-row-delete");
const LOG_DIR = path.join(__dirname, "../logs");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// Mirrors audit-chain-integrity.ts's A1 predicate exactly (ORDERED_CTE + rn>1
// AND fromAxis=toAxis AND community=prev_comm), scoped to non-deleted claims.
const DEGENERATE_SQL = `
  WITH ordered AS (
    SELECT h."id", h."claimId", h."fromAxis", h."toAxis", h."occurredAt", h."community",
           LAG(h."toAxis")          OVER w AS prev_to,
           LAG(h."community"::text) OVER w AS prev_comm,
           ROW_NUMBER()             OVER w AS rn
    FROM "ClaimStatusHistory" h
    JOIN "Claim" c ON c."id" = h."claimId" AND c."deleted" = false
    WINDOW w AS (PARTITION BY h."claimId" ORDER BY h."seq" ASC NULLS LAST, h."occurredAt" ASC, h."createdAt" ASC)
  )
  SELECT "id", "claimId" FROM ordered
  WHERE rn > 1 AND "fromAxis" = "toAxis" AND "community"::text = prev_comm
`;

async function main() {
  console.log(
    `\n=== fix-degenerate-transitions — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"} ===`,
  );

  const degenerate = await prisma.$queryRawUnsafe<{ id: string; claimId: string }[]>(DEGENERATE_SQL);
  console.log(`Found ${degenerate.length} degenerate (A1) rows.`);
  if (degenerate.length === 0) return;

  const byClaim = new Map<string, string[]>();
  for (const { id, claimId } of degenerate) {
    if (!byClaim.has(claimId)) byClaim.set(claimId, []);
    byClaim.get(claimId)!.push(id);
  }
  console.log(`Across ${byClaim.size} claims.`);

  // Defensive check: would deleting flagged rows empty any claim's history?
  // Structurally impossible (entry row has fromAxis=null, never equal to a
  // non-null toAxis, so it can never be A1) — verified, not assumed.
  const totalCounts = await prisma.claimStatusHistory.groupBy({
    by: ["claimId"],
    where: { claimId: { in: [...byClaim.keys()] } },
    _count: { _all: true },
  });
  const totalByClaim = new Map(totalCounts.map((t) => [t.claimId, t._count._all]));
  const wouldEmpty: string[] = [];
  for (const [claimId, ids] of byClaim) {
    if ((totalByClaim.get(claimId) ?? 0) <= ids.length) wouldEmpty.push(claimId);
  }
  if (wouldEmpty.length > 0) {
    console.error(
      `ABORT: ${wouldEmpty.length} claim(s) would have ALL history rows deleted — refusing: ${wouldEmpty.join(", ")}`,
    );
    process.exitCode = 2;
    return;
  }

  const examples = degenerate.slice(0, 20);
  for (const e of examples) console.log(`  ${e.claimId}: delete row ${e.id}`);
  if (degenerate.length > 20) console.log(`  … and ${degenerate.length - 20} more.`);

  if (!EXECUTE) {
    console.log(`Preflight only. Repair = delete degenerate row(s) + renumber seq per claim.`);
    return;
  }
  if (!ALLOW_DELETE) {
    console.error(
      `--execute requires --allow-row-delete (it deletes ${degenerate.length} rows). Aborting.`,
    );
    process.exitCode = 2;
    return;
  }

  // Dump full row JSON before touching anything (restorable), JSONL per spec.
  const ids = degenerate.map((r) => r.id);
  const fullRows = await prisma.claimStatusHistory.findMany({ where: { id: { in: ids } } });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const dumpPath = path.join(LOG_DIR, `degenerate-transitions-${STAMP}.jsonl`);
  fs.writeFileSync(dumpPath, fullRows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`Dumped ${fullRows.length} rows → ${dumpPath}`);

  let deleted = 0;
  for (const [claimId, rowIds] of byClaim) {
    await prisma.$transaction(async (tx) => {
      for (const id of rowIds) await tx.claimStatusHistory.delete({ where: { id } });
      await renumberClaimSeq(tx, claimId);
    });
    deleted += rowIds.length;
    if (deleted % 50 === 0) console.log(`  … ${deleted}`);
  }

  console.log(`Deleted ${deleted} degenerate rows across ${byClaim.size} claims (seq renumbered per claim).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
