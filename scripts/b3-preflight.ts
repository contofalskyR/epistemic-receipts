/**
 * B3-0 preflight census — read-only, no writes.
 * Prints the four data points that gate all B3 phases:
 *   1. REVERSED transitions grouped by community → ingestedBy (top 15 per community)
 *   2. DAY-precision transition counts total + 3 sample month-days
 *   3. CONTESTED claims (non-deleted, non-DEPRECATED): count + 10 oldest by last transition
 *   4. Claims with ≥2 communities in history; of those, how many have divergent latest toAxis
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/b3-preflight.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("=== B3-0 PREFLIGHT CENSUS ===\n");

  // ---------------------------------------------------------------------------
  // 1. REVERSED transitions grouped by community → ingestedBy (top 15)
  // ---------------------------------------------------------------------------
  console.log("## 1. REVERSED transitions by community → ingestedBy\n");

  const reversedByPipeline = await prisma.$queryRaw<
    { community: string; ingestedBy: string | null; cnt: bigint }[]
  >`
    SELECT
      csh."community",
      c."ingestedBy",
      COUNT(*) AS cnt
    FROM "ClaimStatusHistory" csh
    JOIN "Claim" c ON c.id = csh."claimId"
    WHERE csh."toAxis" = 'REVERSED'
      AND c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
    GROUP BY csh."community", c."ingestedBy"
    ORDER BY csh."community", cnt DESC
  `;

  const byCommunity: Record<string, typeof reversedByPipeline> = {};
  for (const row of reversedByPipeline) {
    if (!byCommunity[row.community]) byCommunity[row.community] = [];
    byCommunity[row.community].push(row);
  }

  for (const [community, rows] of Object.entries(byCommunity)) {
    const total = rows.reduce((s, r) => s + Number(r.cnt), 0);
    console.log(`  ${community} (${total} total transitions):`);
    for (const r of rows.slice(0, 15)) {
      console.log(`    ${String(r.ingestedBy ?? "(null)").padEnd(40)} ${r.cnt}`);
    }
    console.log();
  }

  // ---------------------------------------------------------------------------
  // 2. DAY-precision transition counts
  // ---------------------------------------------------------------------------
  console.log("## 2. DAY-precision transitions\n");

  const dayTotal = await prisma.claimStatusHistory.count({
    where: { datePrecision: "DAY" },
  });
  console.log(`  Total DAY-precision transitions: ${dayTotal.toLocaleString()}`);

  const sampleDays = ["01-15", "07-13", "11-02"] as const;
  for (const md of sampleDays) {
    const [mm, dd] = md.split("-").map(Number);
    const rows = await prisma.$queryRaw<{ curated: bigint; multistep: bigint; single: bigint }[]>`
      SELECT
        COUNT(*) FILTER (WHERE c."externalId" LIKE 'trajectory:%') AS curated,
        COUNT(*) FILTER (
          WHERE c."externalId" NOT LIKE 'trajectory:%'
          AND EXISTS (
            SELECT 1 FROM "ClaimStatusHistory" csh2
            WHERE csh2."claimId" = csh."claimId" AND csh2."fromAxis" IS NOT NULL
          )
        ) AS multistep,
        COUNT(*) FILTER (
          WHERE c."externalId" NOT LIKE 'trajectory:%'
          AND NOT EXISTS (
            SELECT 1 FROM "ClaimStatusHistory" csh2
            WHERE csh2."claimId" = csh."claimId" AND csh2."fromAxis" IS NOT NULL
          )
        ) AS single
      FROM "ClaimStatusHistory" csh
      JOIN "Claim" c ON c.id = csh."claimId"
      WHERE csh."datePrecision" = 'DAY'
        AND EXTRACT(MONTH FROM csh."occurredAt") = ${mm}
        AND EXTRACT(DAY FROM csh."occurredAt") = ${dd}
    `;
    const r = rows[0];
    console.log(
      `  ${md}: curated=${r.curated} multi-step=${r.multistep} single-step=${r.single}`
    );
  }
  console.log();

  // ---------------------------------------------------------------------------
  // 3. CONTESTED claims: count + 10 oldest by last transition
  // ---------------------------------------------------------------------------
  console.log("## 3. CONTESTED claims (non-deleted, non-DEPRECATED)\n");

  const contestedCount = await prisma.claim.count({
    where: {
      epistemicAxis: "CONTESTED",
      deleted: false,
      OR: [
        { verificationStatus: null },
        { verificationStatus: { not: "DEPRECATED" } },
      ],
    },
  });
  console.log(`  Total CONTESTED claims: ${contestedCount.toLocaleString()}\n`);

  const oldest10 = await prisma.$queryRaw<
    { id: string; text: string; lastTransition: Date }[]
  >`
    SELECT
      c.id,
      LEFT(c.text, 80) AS text,
      MAX(csh."occurredAt") AS "lastTransition"
    FROM "Claim" c
    JOIN "ClaimStatusHistory" csh ON csh."claimId" = c.id
    WHERE c."epistemicAxis" = 'CONTESTED'
      AND c.deleted = false
      AND (c."verificationStatus" IS NULL OR c."verificationStatus" != 'DEPRECATED')
    GROUP BY c.id, c.text
    ORDER BY MAX(csh."occurredAt") ASC
    LIMIT 10
  `;

  console.log("  10 CONTESTED claims with oldest last-transition (dormancy candidates):");
  for (const row of oldest10) {
    const yr = row.lastTransition.getUTCFullYear();
    console.log(`    [${yr}] ${row.text}…`);
  }
  console.log();

  // ---------------------------------------------------------------------------
  // 4. Claims with ≥2 communities; divergent-latest-toAxis subset
  // ---------------------------------------------------------------------------
  console.log("## 4. Multi-community claims\n");

  const multiCommunity = await prisma.$queryRaw<
    { claimId: string; communityCount: bigint }[]
  >`
    SELECT "claimId", COUNT(DISTINCT community) AS "communityCount"
    FROM "ClaimStatusHistory"
    GROUP BY "claimId"
    HAVING COUNT(DISTINCT community) >= 2
  `;

  console.log(
    `  Claims with ≥2 communities in history: ${multiCommunity.length.toLocaleString()}`
  );

  if (multiCommunity.length === 0) {
    console.log("  (none — divergence check skipped)");
  } else {
    const multiIds = multiCommunity.map((r) => r.claimId);

    // For each claim, find the latest toAxis per community
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

    let divergentCount = 0;
    const divergentExamples: { claimId: string; axes: string }[] = [];
    for (const [claimId, entries] of Object.entries(byClaimId)) {
      const axes = new Set(entries.map((e) => e.latestAxis));
      if (axes.size > 1) {
        divergentCount++;
        if (divergentExamples.length < 10) {
          divergentExamples.push({
            claimId,
            axes: entries.map((e) => `${e.community}=${e.latestAxis}`).join(", "),
          });
        }
      }
    }

    console.log(
      `  Of those, claims with divergent latest toAxis per community: ${divergentCount.toLocaleString()}`
    );
    if (divergentExamples.length > 0) {
      console.log("\n  Sample divergent claims:");
      for (const ex of divergentExamples) {
        console.log(`    ${ex.claimId}: ${ex.axes}`);
      }
    }
  }

  console.log("\n=== B3-0 PREFLIGHT COMPLETE ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
