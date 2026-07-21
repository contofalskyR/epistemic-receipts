/**
 * B17-1 — Canon census (read-only).
 *
 * Reports the numbers the /canon page's copy and the b17-report depend on:
 *  (1) openalex_v1 claims with cited_by_count ≥ 5000 — total, multi-step vs single-step
 *  (2) cited_by_count coverage overall (what the ranking can't see)
 *  (3) ledger tallies from logs/corpus-promoter-*.jsonl (promoted/skipped, by
 *      model where recorded, date range) — the ledgers are gitignored and live
 *      on the owner's Mac, so run this there (or pass --ledger <path>)
 *  (4) overlap: how many ≥5k papers got curves from sources OTHER than the
 *      promoter (retraction join, seeds) — for honest attribution copy
 *
 * Zero writes. Run: npx tsx scripts/b17-census.ts [--ledger logs/corpus-promoter-attempted.jsonl]
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();

const CITED = `CASE WHEN (c.metadata->>'cited_by_count') ~ '^[0-9]+$' THEN (c.metadata->>'cited_by_count')::int ELSE 0 END`;

async function main() {
  const ledgerIdx = process.argv.indexOf("--ledger");
  const ledgerPath = ledgerIdx > -1 ? process.argv[ledgerIdx + 1] : "logs/corpus-promoter-attempted.jsonl";

  // (1) population + step split
  const [pop] = await prisma.$queryRawUnsafe<
    { total: number; multi: number; single: number; reversed: number }[]
  >(`
    WITH pop AS (
      SELECT c.id, (SELECT COUNT(*) FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id) AS steps,
             (SELECT h."toAxis" FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id
               ORDER BY h.seq DESC NULLS LAST, h."occurredAt" DESC, h."createdAt" DESC LIMIT 1) AS last_axis
      FROM "Claim" c
      WHERE c."ingestedBy" = 'openalex_v1' AND c.deleted = false
        AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
        AND ${CITED} >= 5000
    )
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE steps >= 2)::int AS multi,
           COUNT(*) FILTER (WHERE steps < 2)::int AS single,
           COUNT(*) FILTER (WHERE last_axis = 'REVERSED')::int AS reversed
    FROM pop
  `);

  // (2) count coverage
  const [cov] = await prisma.$queryRawUnsafe<{ total: number; with_count: number; no_count: number }[]>(`
    SELECT COUNT(*)::int AS total,
           COUNT(*) FILTER (WHERE (c.metadata->>'cited_by_count') ~ '^[0-9]+$')::int AS with_count,
           COUNT(*) FILTER (WHERE NOT ((c.metadata->>'cited_by_count') ~ '^[0-9]+$'))::int AS no_count
    FROM "Claim" c
    WHERE c."ingestedBy" = 'openalex_v1' AND c.deleted = false
      AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
  `);

  // (4) attribution overlap: multi-step ≥5k papers whose transitions were written
  // by which processes (createdBy-style attribution lives in reason/source rows;
  // we approximate by transition reason prefixes — report raw reason families).
  const reasonFamilies = await prisma.$queryRawUnsafe<{ family: string; papers: number }[]>(`
    WITH pop AS (
      SELECT c.id FROM "Claim" c
      WHERE c."ingestedBy" = 'openalex_v1' AND c.deleted = false
        AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
        AND ${CITED} >= 5000
    )
    SELECT COALESCE(NULLIF(split_part(h.reason, ':', 1), ''), '(no reason)') AS family,
           COUNT(DISTINCT h."claimId")::int AS papers
    FROM "ClaimStatusHistory" h
    JOIN pop ON pop.id = h."claimId"
    WHERE h."fromAxis" IS NOT NULL
    GROUP BY 1 ORDER BY 2 DESC LIMIT 20
  `);

  // (3) ledger tallies
  let ledger = "(ledger not found at " + ledgerPath + " — run on the owner's Mac or pass --ledger)";
  if (fs.existsSync(ledgerPath)) {
    const lines = fs.readFileSync(ledgerPath, "utf8").split("\n").filter(Boolean);
    const byResult: Record<string, number> = {};
    const byModel: Record<string, number> = {};
    let minTs = "", maxTs = "";
    for (const l of lines) {
      try {
        const row = JSON.parse(l);
        byResult[row.result ?? "(none)"] = (byResult[row.result ?? "(none)"] ?? 0) + 1;
        if (row.model) byModel[row.model] = (byModel[row.model] ?? 0) + 1;
        if (row.ts) {
          if (!minTs || row.ts < minTs) minTs = row.ts;
          if (!maxTs || row.ts > maxTs) maxTs = row.ts;
        }
      } catch {
        /* skip malformed line */
      }
    }
    ledger = [
      `rows: ${lines.length} · range: ${minTs || "?"} → ${maxTs || "?"}`,
      `by result: ${JSON.stringify(byResult)}`,
      `by model: ${Object.keys(byModel).length ? JSON.stringify(byModel) : "(model not recorded in ledger rows)"}`,
    ].join("\n  ");
  }

  console.log(`# B17-1 census — ${new Date().toISOString()}\n`);
  console.log(`## Population (cited_by_count ≥ 5000, openalex_v1)`);
  console.log(`total: ${pop.total} · multi-step: ${pop.multi} · single-step: ${pop.single} · reversed: ${pop.reversed}\n`);
  console.log(`## cited_by_count coverage (openalex_v1 overall)`);
  console.log(`total: ${cov.total} · with count: ${cov.with_count} · NO count (invisible to ranking): ${cov.no_count}\n`);
  console.log(`## Ledger tallies (${ledgerPath})`);
  console.log(`  ${ledger}\n`);
  console.log(`## Transition-reason families on ≥5k papers (attribution honesty)`);
  for (const r of reasonFamilies) console.log(`  ${r.family}: ${r.papers} papers`);
  console.log(
    `\nPagination guidance: /canon paginates at 50 with server filters (already scale-safe); ` +
      `if total (${pop.total}) ≤ ~2,000 a load-and-filter variant is also viable per the brief.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
