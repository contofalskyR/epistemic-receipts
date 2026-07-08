/**
 * fix-audit-findings.ts — targeted repairs for the two REAL bug populations the
 * 2026-07-07 chain-integrity audit found (run the audit first; this script's
 * detection queries are the audit's own predicates).
 *
 * FIX inverted-retractions (C1, ~511 rows, populate-retraction-curves data):
 *   Claims where the `:retraction:0` publication row (null→RECORDED/SETTLED)
 *   is dated AFTER the claim's REVERSED row — CrossRef/OpenAlex deposited a
 *   publication date at or past the retraction date (the quirk
 *   CORPUS-PROMOTER-BULK-PLAN §4 predicted). The pub date is unreliable, so the
 *   honest repair is to REMOVE the publication row and reset the REVERSED row's
 *   fromAxis to null — returning the claim to its single-step REVERSED baseline
 *   ("honest residue for the LLM queue", the plan's own words). Deleted rows are
 *   dumped as full JSON to logs/ first (restorable; populate-retraction-curves
 *   is also idempotently re-runnable once better dates exist). Claim ids are
 *   appended to logs/inverted-retraction-residue.jsonl for the promoter's
 *   crossref-residue path.
 *
 * FIX missing-entry (E1, ~93 claims, mostly curated seeds):
 *   Claims whose history has NO fromAxis=null row — the first transition was
 *   authored mid-chain (e.g. OPEN→RECORDED as row 1). Normalization: set the
 *   EARLIEST row's fromAxis to null (the entry-row invariant every consumer
 *   assumes; the authored "prior axis" of a chain's first observation is not a
 *   recorded transition). The original fromAxis is preserved in the row dump.
 *
 * PREFLIGHT BY DEFAULT. Writes need --execute plus --allow-row-delete for the
 * retraction fix (it deletes rows — the one operation the transition contract
 * has no primitive for, hence its own consent flag).
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/fix-audit-findings.ts --direct
 *   ... --fix inverted-retractions --execute --allow-row-delete --direct
 *   ... --fix missing-entry --execute --direct
 *   (no --fix = preflight both)
 *
 * After: re-run audit-chain-integrity — E1 and the retraction C1 population
 * should be 0.
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

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i !== -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--")
    ? process.argv[i + 1]
    : null;
}
const EXECUTE = process.argv.includes("--execute");
const ALLOW_DELETE = process.argv.includes("--allow-row-delete");
const FIX = argValue("--fix"); // null = preflight both
const LOG_DIR = path.join(__dirname, "../logs");
const STAMP = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

// ── Fix 1: inverted retraction curves ────────────────────────────────────────

async function fixInvertedRetractions() {
  console.log(`\n── inverted-retractions ──`);

  // The pub row (`:retraction:0`) dated at-or-after the same claim's REVERSED row.
  const inverted = await prisma.$queryRawUnsafe<
    { pubRowId: string; claimId: string; pubAt: Date; revRowId: string; revAt: Date; revFrom: string | null }[]
  >(`
    SELECT p."id"        AS "pubRowId",
           p."claimId"   AS "claimId",
           p."occurredAt" AS "pubAt",
           r."id"        AS "revRowId",
           r."occurredAt" AS "revAt",
           r."fromAxis"  AS "revFrom"
    FROM "ClaimStatusHistory" p
    JOIN "ClaimStatusHistory" r
      ON r."claimId" = p."claimId" AND r."toAxis" = 'REVERSED'
    WHERE p."id" LIKE '%:retraction:0'
      AND p."fromAxis" IS NULL
      AND p."occurredAt" >= r."occurredAt"
  `);

  console.log(`Found ${inverted.length} inverted publication rows (pub date ≥ retraction date).`);
  for (const row of inverted.slice(0, 6))
    console.log(
      `  ${row.claimId}: pub ${row.pubAt.toISOString().slice(0, 10)} ≥ reversed ${row.revAt.toISOString().slice(0, 10)}`,
    );
  if (inverted.length === 0) return;

  if (!EXECUTE) {
    console.log(`Preflight only. Repair = delete pub row + reset REVERSED.fromAxis→null.`);
    return;
  }
  if (!ALLOW_DELETE) {
    console.error(`--execute for this fix requires --allow-row-delete (it deletes ${inverted.length} rows). Aborting.`);
    process.exitCode = 2;
    return;
  }

  // Dump full row JSON before touching anything (restorable).
  const pubIds = inverted.map((r) => r.pubRowId);
  const fullRows = await prisma.claimStatusHistory.findMany({ where: { id: { in: pubIds } } });
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const dumpPath = path.join(LOG_DIR, `deleted-inverted-pub-rows-${STAMP}.json`);
  fs.writeFileSync(dumpPath, JSON.stringify(fullRows, null, 2));
  console.log(`Dumped ${fullRows.length} rows → ${dumpPath}`);

  let fixed = 0;
  for (const row of inverted) {
    await prisma.$transaction([
      prisma.claimStatusHistory.delete({ where: { id: row.pubRowId } }),
      prisma.claimStatusHistory.update({
        where: { id: row.revRowId },
        data: { fromAxis: null },
      }),
    ]);
    fixed++;
    if (fixed % 100 === 0) console.log(`  … ${fixed}`);
  }

  const residuePath = path.join(LOG_DIR, "inverted-retraction-residue.jsonl");
  fs.appendFileSync(
    residuePath,
    inverted
      .map((r) =>
        JSON.stringify({
          kind: "pub-date-unreliable",
          claimId: r.claimId,
          badPubDate: r.pubAt.toISOString().slice(0, 10),
          retractionDate: r.revAt.toISOString().slice(0, 10),
          fixedAt: STAMP,
        }),
      )
      .join("\n") + "\n",
  );
  console.log(`Repaired ${fixed} claims (single-step REVERSED baseline restored).`);
  console.log(`Residue → ${residuePath} (promoter crossref-residue path re-researches real pub dates).`);
}

// ── Fix 2: missing entry rows ────────────────────────────────────────────────

async function fixMissingEntry() {
  console.log(`\n── missing-entry ──`);

  const claims = await prisma.$queryRawUnsafe<{ claimId: string; pipeline: string }[]>(`
    SELECT h."claimId" AS "claimId", MIN(c."ingestedBy") AS pipeline
    FROM "ClaimStatusHistory" h
    JOIN "Claim" c ON c."id" = h."claimId" AND c."deleted" = false
    GROUP BY h."claimId"
    HAVING COUNT(*) FILTER (WHERE h."fromAxis" IS NULL) = 0
  `);
  console.log(`Found ${claims.length} claims with no entry row.`);
  if (claims.length === 0) return;

  const dump: object[] = [];
  let planned = 0;
  let fixed = 0;

  for (const { claimId, pipeline } of claims) {
    const earliest = await prisma.claimStatusHistory.findFirst({
      where: { claimId },
      orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
    });
    if (!earliest) continue;

    planned++;
    if (planned <= 6)
      console.log(
        `  ${claimId} [${pipeline}]: earliest row ${earliest.id} fromAxis ${earliest.fromAxis} → null`,
      );
    if (!EXECUTE) continue;

    dump.push(earliest);
    await prisma.claimStatusHistory.update({
      where: { id: earliest.id },
      data: { fromAxis: null },
    });
    fixed++;
  }

  if (!EXECUTE) {
    console.log(`Preflight only: would normalize ${planned} earliest rows to fromAxis=null.`);
    return;
  }
  fs.mkdirSync(LOG_DIR, { recursive: true });
  const dumpPath = path.join(LOG_DIR, `normalized-entry-rows-${STAMP}.json`);
  fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2));
  console.log(`Normalized ${fixed} rows (originals dumped → ${dumpPath}).`);
}

// ── Fix 3: re-chain fromAxis pointers ────────────────────────────────────────
//
// For claims flagged C1 where the DATE ORDER is unambiguous (strictly increasing
// occurredAt — no ties, so no precision scrambles), the correct fromAxis
// pointers are fully derivable: row[0].fromAxis = null, row[n].fromAxis =
// row[n-1].toAxis. Legacy enrichment arcs (openfda labels et al.) wrote real,
// dated, sourced events with sloppy pointers — the events stand; the pointers
// are repaired to match the documented order.
//
// Special case handled first: a fromAxis=null row sitting MID-chain with a cuid
// id is a Layer-1 baseline written onto a claim that already had history (the
// live-loop race). If deleting it leaves the chain strictly ordered, it is
// removed (dumped first; requires --allow-row-delete).
//
// seq (ORDERING-SEMANTICS-2026-07-08.md) resolved the old tie problem: for
// fully-stamped claims, seq IS the order — pointers are rewritten from it
// directly, no date-strictness needed. Unstamped claims still require strictly
// increasing dates; same-date ties on unstamped rows are SKIPPED with a
// pointer at backfill-transition-seq (run it first).

async function fixRechain() {
  console.log(`\n── rechain ──`);

  const broken = await prisma.$queryRawUnsafe<{ claimId: string }[]>(`
    WITH ordered AS (
      SELECT h."claimId", h."fromAxis",
             LAG(h."toAxis") OVER w AS prev_to,
             ROW_NUMBER()    OVER w AS rn
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c."id" = h."claimId" AND c."deleted" = false
      WINDOW w AS (PARTITION BY h."claimId" ORDER BY h."seq" ASC NULLS LAST, h."occurredAt" ASC, h."createdAt" ASC)
    )
    SELECT DISTINCT "claimId" FROM ordered
    WHERE rn > 1 AND ("fromAxis" IS DISTINCT FROM prev_to)
  `);
  console.log(`C1-flagged claims: ${broken.length}`);

  const counts = { rechained: 0, midChainEntriesRemoved: 0, skippedTies: 0, skippedNoDelete: 0 };
  const skipped: object[] = [];
  const dump: object[] = [];
  let shown = 0;

  for (const { claimId } of broken) {
    let rows = await prisma.claimStatusHistory.findMany({
      where: { claimId },
      orderBy: [
        { seq: { sort: "asc", nulls: "last" } },
        { occurredAt: "asc" },
        { createdAt: "asc" },
      ],
    });

    // Mid-chain cuid entry row (live-loop Layer-1 baseline)?
    const midNull = rows.filter(
      (r, i) => i > 0 && r.fromAxis === null && !r.id.includes(":") && !/-\d{4}-\d{2}-\d{2}$/.test(r.id),
    );
    const deletions = midNull.length === 1 && rows[0].fromAxis !== null ? midNull : [];
    const kept = rows.filter((r) => !deletions.includes(r));

    // Fully-stamped claims: seq IS the order — no date requirement. Unstamped
    // rows still need strictly increasing dates; otherwise the order is
    // ambiguous and the backfill (pointer-walk) must decide first.
    const fullyStamped = kept.every((r) => r.seq !== null);
    const strictlyOrdered =
      fullyStamped ||
      kept.every((r, i) => i === 0 || r.occurredAt.getTime() > kept[i - 1].occurredAt.getTime());
    if (!strictlyOrdered) {
      counts.skippedTies++;
      skipped.push({
        claimId,
        reason: "same-date tie on unstamped rows — run backfill-transition-seq first",
      });
      continue;
    }
    if (deletions.length > 0 && EXECUTE && !ALLOW_DELETE) {
      counts.skippedNoDelete++;
      skipped.push({ claimId, reason: "needs mid-chain entry-row delete — pass --allow-row-delete" });
      continue;
    }

    // Compute pointer rewrites.
    const updates: { id: string; fromAxis: string | null }[] = [];
    kept.forEach((r, i) => {
      const want = i === 0 ? null : kept[i - 1].toAxis;
      if (r.fromAxis !== want) updates.push({ id: r.id, fromAxis: want });
    });
    if (updates.length === 0 && deletions.length === 0) continue;

    if (shown < 6) {
      shown++;
      console.log(
        `  ${claimId}: ${deletions.length ? `remove ${deletions.length} mid-chain entry, ` : ""}re-point ${updates.length} rows`,
      );
    }
    if (!EXECUTE) {
      counts.rechained++;
      counts.midChainEntriesRemoved += deletions.length;
      continue;
    }

    dump.push(...deletions, ...rows.filter((r) => updates.some((u) => u.id === r.id)));
    await prisma.$transaction(async (tx) => {
      for (const d of deletions) await tx.claimStatusHistory.delete({ where: { id: d.id } });
      for (const u of updates)
        await tx.claimStatusHistory.update({ where: { id: u.id }, data: { fromAxis: u.fromAxis } });
      // Deletions leave seq gaps; renumber preserves surviving order (contract §6).
      await renumberClaimSeq(tx, claimId);
    });
    counts.rechained++;
    counts.midChainEntriesRemoved += deletions.length;
    if (counts.rechained % 50 === 0) console.log(`  … ${counts.rechained}`);
  }

  if (EXECUTE && dump.length > 0) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const dumpPath = path.join(LOG_DIR, `rechained-rows-${STAMP}.json`);
    fs.writeFileSync(dumpPath, JSON.stringify(dump, null, 2));
    console.log(`Originals dumped → ${dumpPath}`);
  }
  if (skipped.length > 0) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const skipPath = path.join(LOG_DIR, `rechain-skipped-${STAMP}.jsonl`);
    fs.writeFileSync(skipPath, skipped.map((s) => JSON.stringify(s)).join("\n") + "\n");
    console.log(`Skipped (ordering ambiguous) → ${skipPath}`);
  }
  console.log(
    `${EXECUTE ? "Re-chained" : "Would re-chain"} ${counts.rechained} claims ` +
    `(${counts.midChainEntriesRemoved} mid-chain entry rows removed, ${counts.skippedTies} tie-skips, ${counts.skippedNoDelete} need --allow-row-delete).`,
  );
}

async function main() {
  console.log(
    `\n=== fix-audit-findings — ${EXECUTE ? "EXECUTE" : "PREFLIGHT (no writes)"}${FIX ? `, fix: ${FIX}` : ", all fixes"} ===`,
  );
  if (!FIX || FIX === "inverted-retractions") await fixInvertedRetractions();
  if (!FIX || FIX === "missing-entry") await fixMissingEntry();
  if (!FIX || FIX === "rechain") await fixRechain();
  console.log(
    `\nRe-verify: npx dotenv-cli -e .env.local -- npx tsx scripts/audit-chain-integrity.ts --direct --json`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
