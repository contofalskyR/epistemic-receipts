/**
 * backfill-terminal-axis.ts
 * =========================
 * Repairs the axis leak: claims whose latest ClaimStatusHistory.toAxis (by seq,
 * falling back to occurredAt/createdAt for unstamped legacy rows) disagrees with
 * the denormalized Claim.epistemicAxis. Going forward the transition contract
 * stamps this in-transaction (lib/transition-contract.ts:stampClaimAxis); this
 * script is the one-time repair for rows written before the stamp existed.
 *
 * Usage:
 *   npx tsx scripts/backfill-terminal-axis.ts            # dry run (default)
 *   npx tsx scripts/backfill-terminal-axis.ts --execute  # write
 *
 * Run scripts/backfill-transition-seq.ts FIRST if seq coverage is incomplete —
 * seq is the order authority (ORDERING-SEMANTICS-2026-07-08.md).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const EXECUTE = process.argv.includes("--execute");
const PAGE = 1000;

async function main() {
  let cursor: string | undefined;
  let scanned = 0;
  let mismatched = 0;
  let updated = 0;
  const byNewAxis: Record<string, number> = {};

  for (;;) {
    const claims = await prisma.claim.findMany({
      where: { statusHistory: { some: {} } },
      select: {
        id: true,
        epistemicAxis: true,
        statusHistory: {
          orderBy: [{ seq: "desc" }, { occurredAt: "desc" }, { createdAt: "desc" }],
          take: 1,
          select: { toAxis: true },
        },
      },
      orderBy: { id: "asc" },
      take: PAGE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (claims.length === 0) break;
    cursor = claims[claims.length - 1].id;
    scanned += claims.length;

    const fixes = claims.filter((c) => c.statusHistory[0] && c.epistemicAxis !== c.statusHistory[0].toAxis);
    mismatched += fixes.length;
    for (const c of fixes) {
      const axis = c.statusHistory[0].toAxis;
      byNewAxis[axis] = (byNewAxis[axis] ?? 0) + 1;
      if (EXECUTE) {
        await prisma.claim.update({ where: { id: c.id }, data: { epistemicAxis: axis } });
        updated++;
      }
    }
    if (scanned % 20000 === 0) console.log(`scanned=${scanned} mismatched=${mismatched}`);
  }

  console.log(`\n${EXECUTE ? "EXECUTED" : "DRY RUN"}`);
  console.log(`claims with history scanned: ${scanned}`);
  console.log(`axis mismatches found:       ${mismatched}`);
  console.log(`updated:                     ${updated}`);
  console.log(`mismatches by correct axis:`, byNewAxis);
  if (!EXECUTE && mismatched > 0) console.log(`\nRe-run with --execute to write.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
