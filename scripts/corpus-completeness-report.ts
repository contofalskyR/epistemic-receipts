/**
 * corpus-completeness-report.ts — READ-ONLY verification of the completeness
 * classification (lib/corpus-completeness.ts) against the live DB.
 *
 * For every pipeline: single-step / multi-step / no-history counts, grouped by
 * completeness category, with grand totals. Flags drift in both directions:
 * pipelines present in the DB but missing from the classification, and
 * classified pipelines with no live claims.
 *
 * Answers: "of the remaining single-step claims, which are honestly complete
 * at length 1, and which actually need future work?" (plan doc §3)
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/corpus-completeness-report.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { CATEGORIES, categoryOf, type CompletenessCategory } from "../lib/corpus-completeness";

const prisma = new PrismaClient();

interface Row {
  ingestedBy: string;
  single_step: number | bigint;
  multi_step: number | bigint;
  no_history: number | bigint;
  total: number | bigint;
}
const num = (v: number | bigint) => Number(v);

const CATEGORY_VERDICT: Record<CompletenessCategory, string> = {
  BORN_SETTLED: "COMPLETE at length 1 (born-settled)",
  BORN_RECORDED: "COMPLETE at length 1 (born-recorded)",
  WAVE1_PROMOTED: "PROMOTED in wave 1 (residual single-steps are date-less)",
  WAVE2_RETRACTIONS: "PENDING wave 2 (prepend entry row)",
  CONDITIONAL: "FUTURE WORK — wave 3, metadata-conditional",
  NEEDS_LLM: "FUTURE WORK — LLM promoter queue",
};

async function main(): Promise<void> {
  console.log("corpus-completeness-report — read-only\n");

  const rows = (await prisma.$queryRawUnsafe(`
    WITH hc AS (
      SELECT "claimId", COUNT(*) AS n FROM "ClaimStatusHistory" GROUP BY 1
    )
    SELECT
      c."ingestedBy",
      COUNT(*) FILTER (WHERE hc.n = 1)::int  AS single_step,
      COUNT(*) FILTER (WHERE hc.n >= 2)::int AS multi_step,
      COUNT(*) FILTER (WHERE hc.n IS NULL)::int AS no_history,
      COUNT(*)::int AS total
    FROM "Claim" c
    LEFT JOIN hc ON hc."claimId" = c.id
    WHERE c.deleted = false
      AND c."verificationStatus" IS DISTINCT FROM 'DEPRECATED'
    GROUP BY 1
    ORDER BY 2 DESC
  `)) as Row[];

  const byCat = new Map<CompletenessCategory | "UNCLASSIFIED", Row[]>();
  for (const r of rows) {
    const cat = categoryOf(r.ingestedBy) ?? "UNCLASSIFIED";
    if (!byCat.has(cat)) byCat.set(cat, []);
    byCat.get(cat)!.push(r);
  }

  const catTotals: Record<string, { single: number; multi: number; none: number; pipelines: number }> = {};
  const order: (CompletenessCategory | "UNCLASSIFIED")[] = [
    "BORN_SETTLED", "BORN_RECORDED", "WAVE1_PROMOTED",
    "WAVE2_RETRACTIONS", "CONDITIONAL", "NEEDS_LLM", "UNCLASSIFIED",
  ];

  for (const cat of order) {
    const list = byCat.get(cat);
    if (!list || list.length === 0) continue;
    const verdict = cat === "UNCLASSIFIED"
      ? "⚠ NOT IN lib/corpus-completeness.ts — classify before excluding"
      : CATEGORY_VERDICT[cat];
    console.log(`\n═══ ${cat} — ${verdict}`);
    console.log(`    ${"pipeline".padEnd(36)} ${"single".padStart(9)} ${"multi".padStart(9)} ${"no-hist".padStart(9)}`);
    let s = 0, m = 0, n = 0;
    for (const r of list.sort((a, b) => num(b.single_step) - num(a.single_step))) {
      console.log(`    ${r.ingestedBy.padEnd(36)} ${String(num(r.single_step)).padStart(9)} ${String(num(r.multi_step)).padStart(9)} ${String(num(r.no_history)).padStart(9)}`);
      s += num(r.single_step); m += num(r.multi_step); n += num(r.no_history);
    }
    console.log(`    ${"── subtotal".padEnd(36)} ${String(s).padStart(9)} ${String(m).padStart(9)} ${String(n).padStart(9)}`);
    catTotals[cat] = { single: s, multi: m, none: n, pipelines: list.length };
  }

  // Classified pipelines with no live claims (informational).
  const live = new Set(rows.map((r) => r.ingestedBy));
  const dormant = Object.values(CATEGORIES).flat().filter((p) => !live.has(p));
  if (dormant.length) console.log(`\nClassified but no live claims (${dormant.length}): ${dormant.join(", ")}`);

  // ── The §3 answer ────────────────────────────────────────────────────────────
  const complete =
    (catTotals["BORN_SETTLED"]?.single ?? 0) +
    (catTotals["BORN_RECORDED"]?.single ?? 0) +
    (catTotals["WAVE1_PROMOTED"]?.single ?? 0);
  const pending =
    (catTotals["WAVE2_RETRACTIONS"]?.single ?? 0) +
    (catTotals["CONDITIONAL"]?.single ?? 0) +
    (catTotals["NEEDS_LLM"]?.single ?? 0);
  const unclassified = catTotals["UNCLASSIFIED"]?.single ?? 0;
  const totalSingle = complete + pending + unclassified;

  console.log(`\n════════ SUMMARY ════════`);
  console.log(`total single-step (live, non-deprecated):     ${totalSingle}`);
  console.log(`  COMPLETE at length 1 (exclude from queue):  ${complete}`);
  console.log(`    born-settled:                             ${catTotals["BORN_SETTLED"]?.single ?? 0}`);
  console.log(`    born-recorded:                            ${catTotals["BORN_RECORDED"]?.single ?? 0}`);
  console.log(`    wave-1 residuals (date-less):             ${catTotals["WAVE1_PROMOTED"]?.single ?? 0}`);
  console.log(`  STILL OWED WORK:                            ${pending}`);
  console.log(`    wave 2 (retraction-family):               ${catTotals["WAVE2_RETRACTIONS"]?.single ?? 0}`);
  console.log(`    wave 3 (conditional):                     ${catTotals["CONDITIONAL"]?.single ?? 0}`);
  console.log(`    LLM promoter (openalex_v1 + manual):      ${catTotals["NEEDS_LLM"]?.single ?? 0}`);
  if (unclassified > 0)
    console.log(`  ⚠ UNCLASSIFIED (fix lib/corpus-completeness.ts): ${unclassified}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
