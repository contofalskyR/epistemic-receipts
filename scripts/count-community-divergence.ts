/**
 * B3-6: count-community-divergence.ts — read-only decision data for the split ledger.
 *
 * Produces:
 *   1. Count of claims with ≥2 distinct communities in history
 *   2. Of those, the divergent subset (latest toAxis differs across communities)
 *   3. Which community-pairs diverge most
 *   4. 10 sample claim IDs with per-community latest axes
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/count-community-divergence.ts
 *
 * No writes. Output intended for owner decision: index page vs. curated shelf.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== B3-6 COMMUNITY DIVERGENCE ANALYSIS ===\n");

  // ── 1. Claims with ≥2 distinct communities ──────────────────────────────────
  const multiCommunity = await prisma.$queryRaw<
    { claimId: string; communityCount: bigint }[]
  >`
    SELECT "claimId", COUNT(DISTINCT community) AS "communityCount"
    FROM "ClaimStatusHistory"
    GROUP BY "claimId"
    HAVING COUNT(DISTINCT community) >= 2
  `;

  console.log(`## 1. Claims with ≥2 communities in history\n`);
  console.log(`  Total: ${multiCommunity.length.toLocaleString()}\n`);

  if (multiCommunity.length === 0) {
    console.log("  (none — divergence analysis skipped)");
    console.log("\n=== B3-6 COMPLETE ===");
    return;
  }

  const multiIds = multiCommunity.map((r) => r.claimId);

  // ── 2+3. Latest toAxis per community; find divergent pairs ─────────────────
  const latestPerCommunity = await prisma.$queryRaw<
    { claimId: string; community: string; latestAxis: string }[]
  >`
    SELECT DISTINCT ON (csh."claimId", csh.community)
      csh."claimId",
      csh.community,
      csh."toAxis" AS "latestAxis"
    FROM "ClaimStatusHistory" csh
    WHERE csh."claimId" = ANY(${multiIds}::text[])
    ORDER BY csh."claimId", csh.community, csh."occurredAt" DESC, csh."createdAt" DESC
  `;

  // Group by claimId
  const byClaimId: Record<string, { community: string; latestAxis: string }[]> = {};
  for (const row of latestPerCommunity) {
    if (!byClaimId[row.claimId]) byClaimId[row.claimId] = [];
    byClaimId[row.claimId].push({ community: row.community, latestAxis: row.latestAxis });
  }

  // Count divergent claims and pair frequencies
  let divergentCount = 0;
  const pairFreq: Record<string, number> = {};
  const divergentExamples: { claimId: string; axes: string }[] = [];

  for (const [claimId, entries] of Object.entries(byClaimId)) {
    const axes = new Set(entries.map((e) => e.latestAxis));
    if (axes.size <= 1) continue;

    divergentCount++;

    // Record all community-pair combinations that disagree
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (a.latestAxis !== b.latestAxis) {
          const pair = [a.community, b.community].sort().join(" ↔ ");
          pairFreq[pair] = (pairFreq[pair] ?? 0) + 1;
        }
      }
    }

    if (divergentExamples.length < 10) {
      divergentExamples.push({
        claimId,
        axes: entries.map((e) => `${e.community}=${e.latestAxis}`).join(", "),
      });
    }
  }

  console.log(`## 2. Divergent claims (latest toAxis differs across communities)\n`);
  console.log(`  Total divergent: ${divergentCount.toLocaleString()} of ${multiCommunity.length.toLocaleString()} multi-community claims`);
  console.log(`  Divergence rate: ${((divergentCount / multiCommunity.length) * 100).toFixed(1)}%\n`);

  console.log(`## 3. Community-pair divergence counts\n`);
  const sortedPairs = Object.entries(pairFreq).sort((a, b) => b[1] - a[1]);
  for (const [pair, count] of sortedPairs) {
    console.log(`  ${pair.padEnd(55)} ${count.toLocaleString()}`);
  }
  console.log();

  console.log(`## 4. Sample divergent claims (10)\n`);
  for (const ex of divergentExamples) {
    console.log(`  ${ex.claimId}`);
    console.log(`    ${ex.axes}\n`);
  }

  // ── Recommendation ──────────────────────────────────────────────────────────
  console.log("## RECOMMENDATION\n");

  const total = multiCommunity.length;
  const pct = (divergentCount / total) * 100;

  console.log(`  ${divergentCount.toLocaleString()} of ${total.toLocaleString()} multi-community claims (${pct.toFixed(0)}%) show divergent latest status.`);
  console.log();

  if (pct > 80) {
    console.log("  VERDICT: Index page (high divergence rate warrants a browseable surface).");
    console.log();
    console.log("  The majority of multi-community claims disagree on their current status.");
    console.log("  An index page listing claims by divergence pattern (SETTLED vs. CONTESTED,");
    console.log("  REVERSED vs. SETTLED, etc.) would surface genuine epistemic tension, not");
    console.log("  manufactured variety. Recommended design: group by axis-pair with counts,");
    console.log("  link to top examples per group. No ranking by 'most interesting' — rank");
    console.log("  by data (most transitions, widest date span).");
  } else if (pct > 40) {
    console.log("  VERDICT: Curated shelf (moderate divergence — hand-picking adds value).");
    console.log();
    console.log("  A significant minority of multi-community claims show divergence. A curated");
    console.log("  set of 10-20 exemplars (selected from the pair-frequency table above) would");
    console.log("  illustrate the phenomenon without exposing a thin or noisy full index.");
    console.log("  Revisit the index form if more pipelines add community-diverse transitions.");
  } else {
    console.log("  VERDICT: No surface yet (low divergence rate — too sparse for a browseable index).");
    console.log();
    console.log("  Most multi-community claims agree on their current status. A public index");
    console.log("  would be mostly noise. Consider a note on the coverage page or a future");
    console.log("  B3-6.5 pass once more community-diverse pipelines are ingested.");
  }

  console.log("\n=== B3-6 COMPLETE ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
