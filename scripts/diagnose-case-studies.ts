/**
 * Read-only diagnostic for the /case-studies page.
 * Runs the exact getCaseStudies() query and prints what the page would render.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/diagnose-case-studies.ts
 */

import { PrismaClient } from "@prisma/client";
import { FEATURED_TRAJECTORIES } from "../lib/featured-trajectories";

const prisma = new PrismaClient();

const FEATURED_BY_ID = Object.fromEntries(
  FEATURED_TRAJECTORIES.map((ft) => [ft.id, ft]),
);

async function main() {
  // Step 1 — raw counts
  const totalTrajectory = await prisma.claim.count({
    where: { externalId: { startsWith: "trajectory:" } },
  });
  const deprecated = await prisma.claim.count({
    where: {
      externalId: { startsWith: "trajectory:" },
      verificationStatus: "DEPRECATED",
    },
  });
  const visible = await prisma.claim.count({
    where: {
      deleted: false,
      externalId: { startsWith: "trajectory:" },
      OR: [{ verificationStatus: null }, { verificationStatus: { not: "DEPRECATED" } }],
    },
  });

  console.log("\n── DB counts ──────────────────────────────────────────");
  console.log(`  trajectory: claims total:      ${totalTrajectory}`);
  console.log(`  trajectory: claims visible:    ${visible}`);
  console.log(`  trajectory: claims deprecated: ${deprecated}`);

  if (visible === 0) {
    console.error("\n❌ ZERO visible trajectory: claims — data availability problem.");
    console.error("   Check DATABASE_URL; the deployment may point at a different DB.");
    await prisma.$disconnect();
    process.exit(1);
  }

  // Step 2 — run the exact getCaseStudies() query
  const rows = await prisma.claim.findMany({
    where: {
      deleted: false,
      externalId: { startsWith: "trajectory:" },
      OR: [
        { verificationStatus: null },
        { verificationStatus: { not: "DEPRECATED" } },
      ],
    },
    select: {
      externalId: true,
      text: true,
      claimEmergedAt: true,
      statusHistory: {
        orderBy: [{ occurredAt: "asc" }, { createdAt: "asc" }],
        select: { toAxis: true },
      },
    },
  });

  const all = rows.map((row) => {
    const trajectoryId = row.externalId!.replace(/^trajectory:/, "");
    const featured = FEATURED_BY_ID[trajectoryId];
    const axes = row.statusHistory.map((s) => s.toAxis);
    return {
      id: trajectoryId,
      hook: featured?.hook ?? row.text.slice(0, 80),
      isFeatured: !!featured,
      hasReversal: axes.includes("REVERSED"),
      transitionCount: axes.length,
    };
  });

  const featuredRank = (id: string) => {
    const i = FEATURED_TRAJECTORIES.findIndex((ft) => ft.id === id);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  const studies = all
    .filter((s) => s.isFeatured || s.hasReversal || s.transitionCount >= 3)
    .sort(
      (a, b) =>
        featuredRank(a.id) - featuredRank(b.id) ||
        Number(b.hasReversal) - Number(a.hasReversal) ||
        b.transitionCount - a.transitionCount,
    )
    .slice(0, 60);

  console.log("\n── getCaseStudies() result ────────────────────────────");
  console.log(`  rows returned by query:        ${rows.length}`);
  console.log(`  after editorial filter + sort: ${studies.length}`);

  if (studies.length === 0) {
    console.error("\n❌ Page would render 'No case studies found.'");
    console.error("   Despite visible trajectory: claims existing, none pass the filter.");
    console.error("   Check: hasReversal OR isFeatured OR transitionCount >= 3.");
    console.error(`   isFeatured count: ${all.filter((s) => s.isFeatured).length}`);
    console.error(`  hasReversal count: ${all.filter((s) => s.hasReversal).length}`);
    console.error(`  >=3 transitions:   ${all.filter((s) => s.transitionCount >= 3).length}`);
  } else {
    console.log(`\n✅ Page would render ${studies.length} case studies.`);
    console.log("\n── Top 10 ─────────────────────────────────────────────");
    for (const s of studies.slice(0, 10)) {
      const tag = s.isFeatured ? "[featured]" : s.hasReversal ? "[reversal]" : `[${s.transitionCount}t]`;
      console.log(`  ${tag.padEnd(12)} ${s.id}`);
    }
    console.log("\n   If the LIVE site shows empty, the cause is stale ISR cache.");
    console.log("   Fix: push any commit to main → Vercel redeploys → ISR refreshed on next request.");
    console.log("   Or: reduce revalidate from 86400 to ≤ 3600 so future stale windows are short.\n");
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
