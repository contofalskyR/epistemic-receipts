/**
 * B4-1: b4-divergence-tiers.ts — divergence tiering census for the Split Ledger.
 *
 * Extends the B3-6 divergence analysis by classifying every divergent claim
 * into two tiers:
 *
 *   Tier 1 — Conflict: at least one community's latest axis is SETTLED or REVERSED
 *     AND at least one other community's latest axis is CONTESTED, REVERSED, or ABANDONED
 *     (incompatible endpoints). SETTLED-vs-SETTLED at different dates is NOT conflict
 *     (those claims are not divergent and never reach this script).
 *
 *   Tier 2 — Stage-lag: divergent, but consistent with one arc at different stages
 *     (e.g. RECORDED vs SETTLED, RECORDED vs CONTESTED). Not conflict.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/b4-divergence-tiers.ts
 *
 * No writes. Output intended for B4-1 commit message / report.
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TIER1_ANCHOR = new Set(["SETTLED", "REVERSED"]);
const TIER1_OTHER = new Set(["CONTESTED", "REVERSED", "ABANDONED"]);

function classifyTier(axes: string[]): 1 | 2 {
  const hasAnchor = axes.some((a) => TIER1_ANCHOR.has(a));
  const hasOther = axes.some((a) => TIER1_OTHER.has(a));
  if (hasAnchor && hasOther) {
    // Still need to confirm the anchor and other are DIFFERENT axes
    // (to exclude degenerate cases like a single REVERSED community counted twice)
    for (const a of axes) {
      if (!TIER1_ANCHOR.has(a)) continue; // a is an anchor axis
      for (const b of axes) {
        if (a === b) continue;
        if (TIER1_OTHER.has(b)) return 1;
      }
    }
  }
  return 2;
}

async function main() {
  console.log("=== B4-1 DIVERGENCE TIERING CENSUS ===\n");

  // ── 1. Claims with ≥2 distinct communities ──────────────────────────────────
  const multiCommunity = await prisma.$queryRaw<
    { claimId: string; communityCount: bigint }[]
  >`
    SELECT "claimId", COUNT(DISTINCT community) AS "communityCount"
    FROM "ClaimStatusHistory"
    GROUP BY "claimId"
    HAVING COUNT(DISTINCT community) >= 2
  `;

  const total = multiCommunity.length;
  console.log(`Multi-community claims: ${total.toLocaleString()}`);

  if (total === 0) {
    console.log("  (none — divergence analysis skipped)");
    return;
  }

  const multiIds = multiCommunity.map((r) => r.claimId);

  // ── 2. Latest toAxis + date per community per claim ────────────────────────
  const latestPerCommunity = await prisma.$queryRaw<
    { claimId: string; community: string; latestAxis: string; latestDate: Date }[]
  >`
    SELECT DISTINCT ON (csh."claimId", csh.community)
      csh."claimId",
      csh.community,
      csh."toAxis"    AS "latestAxis",
      csh."occurredAt" AS "latestDate"
    FROM "ClaimStatusHistory" csh
    WHERE csh."claimId" = ANY(${multiIds}::text[])
    ORDER BY csh."claimId", csh.community, csh."occurredAt" DESC, csh."createdAt" DESC
  `;

  // Group by claimId
  type CommunityEntry = { community: string; latestAxis: string; latestDate: Date };
  const byClaimId: Record<string, CommunityEntry[]> = {};
  for (const row of latestPerCommunity) {
    if (!byClaimId[row.claimId]) byClaimId[row.claimId] = [];
    byClaimId[row.claimId].push({
      community: row.community,
      latestAxis: row.latestAxis,
      latestDate: row.latestDate,
    });
  }

  // ── 3. Classify into tiers ──────────────────────────────────────────────────
  const tier1Ids: string[] = [];
  const tier2Ids: string[] = [];
  const tier1PairFreq: Record<string, number> = {};
  const tier2PairFreq: Record<string, number> = {};
  const tier1Samples: { claimId: string; detail: string }[] = [];
  const tier2Samples: { claimId: string; detail: string }[] = [];

  for (const [claimId, entries] of Object.entries(byClaimId)) {
    const axes = entries.map((e) => e.latestAxis);
    const axisSet = new Set(axes);
    if (axisSet.size <= 1) continue; // not divergent

    const tier = classifyTier(axes);
    const pairFreqMap = tier === 1 ? tier1PairFreq : tier2PairFreq;

    if (tier === 1) tier1Ids.push(claimId);
    else tier2Ids.push(claimId);

    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i], b = entries[j];
        if (a.latestAxis !== b.latestAxis) {
          const pair = [a.community, b.community].sort().join(" ↔ ");
          pairFreqMap[pair] = (pairFreqMap[pair] ?? 0) + 1;
        }
      }
    }

    const samples = tier === 1 ? tier1Samples : tier2Samples;
    if (samples.length < 10) {
      const detail = entries
        .map(
          (e) =>
            `${e.community}=${e.latestAxis}(${e.latestDate.toISOString().slice(0, 10)})`
        )
        .join(", ");
      samples.push({ claimId, detail });
    }
  }

  const divergentCount = tier1Ids.length + tier2Ids.length;
  console.log(`Divergent claims: ${divergentCount.toLocaleString()} of ${total.toLocaleString()} (${((divergentCount / total) * 100).toFixed(1)}%)\n`);

  // ── 4. Tier counts ──────────────────────────────────────────────────────────
  console.log(`## TIER 1 — Conflict (incompatible endpoints)\n`);
  console.log(`  Count: ${tier1Ids.length.toLocaleString()}\n`);
  console.log(`  Community-pair breakdown:`);
  for (const [pair, count] of Object.entries(tier1PairFreq).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${pair.padEnd(60)} ${count.toLocaleString()}`);
  }
  console.log();

  console.log(`  10 sample Tier-1 claim IDs:`);
  for (const s of tier1Samples) {
    console.log(`    ${s.claimId}`);
    console.log(`      ${s.detail}`);
  }
  console.log();

  console.log(`## TIER 2 — Stage-lag (same arc, different stages)\n`);
  console.log(`  Count: ${tier2Ids.length.toLocaleString()}\n`);
  console.log(`  Community-pair breakdown (top 15):`);
  for (const [pair, count] of Object.entries(tier2PairFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)) {
    console.log(`    ${pair.padEnd(60)} ${count.toLocaleString()}`);
  }
  console.log();

  console.log(`  10 sample Tier-2 claim IDs:`);
  for (const s of tier2Samples) {
    console.log(`    ${s.claimId}`);
    console.log(`      ${s.detail}`);
  }
  console.log();

  // ── 5. Curated vs pipeline-only among Tier-1 ───────────────────────────────
  if (tier1Ids.length > 0) {
    const curatedRows = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT COUNT(*) AS count
      FROM "Claim"
      WHERE id = ANY(${tier1Ids}::text[])
        AND "externalId" LIKE 'trajectory:%'
    `;
    const curatedCount = Number(curatedRows[0]?.count ?? 0);
    console.log(`## TIER-1 CURATION SPLIT\n`);
    console.log(`  Curated (trajectory: prefix): ${curatedCount.toLocaleString()}`);
    console.log(`  Pipeline-only:                ${(tier1Ids.length - curatedCount).toLocaleString()}`);
    console.log();
  }

  // ── 6. Summary ──────────────────────────────────────────────────────────────
  console.log(`## SUMMARY\n`);
  console.log(`  Multi-community claims:   ${total.toLocaleString()}`);
  console.log(`  Divergent total:          ${divergentCount.toLocaleString()}`);
  console.log(`  Tier 1 — Conflict:        ${tier1Ids.length.toLocaleString()}`);
  console.log(`  Tier 2 — Stage-lag:       ${tier2Ids.length.toLocaleString()}`);
  console.log();

  if (tier1Ids.length === 0) {
    console.log("  ⚠ STOP CONDITION: Tier 1 is zero. Report to owner — form changes.");
  } else if (tier1Ids.length <= 5) {
    console.log("  ⚠ STOP CONDITION: Tier 1 is near-zero. Report to owner — form changes.");
  } else {
    console.log(`  → Tier-1 count (${tier1Ids.length}) is meaningfully non-zero. B4-2 is authorized.`);
  }

  console.log("\n=== B4-1 COMPLETE ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
