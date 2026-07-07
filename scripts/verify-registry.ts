/**
 * verify-registry.ts — CI check: every non-retired pipeline tag must return >0 claims.
 *
 * Usage:
 *   npx tsx scripts/verify-registry.ts
 *
 * Exits non-zero if any non-retired tag has 0 claims in the database.
 */

import { PrismaClient } from "@prisma/client";
import { PIPELINES } from "../lib/pipelines/registry";

const prisma = new PrismaClient();

async function main() {
  const active = PIPELINES.filter(p => !p.retired);

  console.log(`Verifying ${active.length} active pipeline tags…\n`);

  const counts = await prisma.claim.groupBy({
    by: ["ingestedBy"],
    where: { ingestedBy: { in: active.map(p => p.tag) }, deleted: false },
    _count: { _all: true },
  });

  const countByTag = new Map(counts.map(r => [r.ingestedBy, r._count._all]));

  const failures: string[] = [];
  const rows: { tag: string; count: number; status: string }[] = [];

  for (const p of active) {
    const n = countByTag.get(p.tag) ?? 0;
    const ok = n > 0;
    rows.push({ tag: p.tag, count: n, status: ok ? "ok" : "FAIL" });
    if (!ok) failures.push(p.tag);
  }

  // Print aligned table
  const maxTag = Math.max(...rows.map(r => r.tag.length), 3);
  console.log(
    `${"TAG".padEnd(maxTag)}  ${"COUNT".padStart(8)}  STATUS`
  );
  console.log(`${"-".repeat(maxTag)}  ${"-".repeat(8)}  ------`);
  for (const r of rows) {
    const status = r.status === "ok" ? "ok" : "FAIL ← 0 rows";
    console.log(
      `${r.tag.padEnd(maxTag)}  ${String(r.count).padStart(8)}  ${status}`
    );
  }

  console.log("\n--- Retired (skipped) ---");
  const retired = PIPELINES.filter(p => p.retired);
  for (const p of retired) {
    console.log(`  ${p.tag}`);
  }

  if (failures.length > 0) {
    console.error(
      `\n✗ ${failures.length} non-retired tag(s) have 0 claims:\n  ${failures.join("\n  ")}`
    );
    console.error('\nMark as retired: true in lib/pipelines/registry.ts if these tags were never run.');
    process.exit(1);
  }

  console.log(`\n✓ All ${active.length} active tags have >0 claims.`);
}

main()
  .catch(err => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
