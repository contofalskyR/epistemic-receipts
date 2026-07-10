/**
 * _census-axis-mismatch.ts — READ-ONLY diagnosis for the Phase-3 backfill
 * STOP gate (2026-07-10: dry run found 825,803 mismatches, RECORDED-dominated
 * at 779,137 — formally breaching the packet's "REVERSED+ABANDONED dominate"
 * expectation, which was written before the same-day OFAC additions backfill
 * and before accounting for never-classified claims).
 *
 * Splits mismatches by (stored axis incl. NULL) × (correct/terminal axis) ×
 * pipeline, so the verdict can distinguish:
 *   - stored NULL → X: first-time classification from trajectory (benign);
 *   - stored SETTLED → RECORDED etc.: OVERWRITES of prior classification —
 *     the slice the gate exists to protect; needs per-pipeline judgment.
 * Also counts NULL-seq history rows: the backfill's terminal pick uses
 * Prisma seq desc (Postgres NULLS FIRST) while lib/effective-axis uses
 * NULLS LAST — they can only diverge if NULL-seq rows exist.
 *
 * The LATERAL mirrors the BACKFILL's exact ordering (seq DESC NULLS FIRST)
 * so the census counts what the script would actually write.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/_census-axis-mismatch.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const nullSeq = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM "ClaimStatusHistory" WHERE seq IS NULL`;
  console.log(`NULL-seq history rows (ordering-divergence risk if > 0): ${nullSeq[0].n}\n`);

  console.log("Mismatch census (stored → correct), grouped:\n");
  const rows = await prisma.$queryRaw<
    Array<{ stored: string; correct: string; n: number }>
  >`
    SELECT COALESCE(c."epistemicAxis", '(null)') AS stored,
           term.term AS correct,
           COUNT(*)::int AS n
    FROM "Claim" c
    JOIN LATERAL (
      SELECT h."toAxis" AS term
      FROM "ClaimStatusHistory" h
      WHERE h."claimId" = c.id
      ORDER BY h.seq DESC NULLS FIRST, h."occurredAt" DESC, h."createdAt" DESC
      LIMIT 1
    ) term ON true
    WHERE c."epistemicAxis" IS DISTINCT FROM term.term
    GROUP BY 1, 2
    ORDER BY n DESC`;
  for (const r of rows) console.log(`  ${r.stored.padEnd(14)} → ${r.correct.padEnd(12)} ${r.n}`);

  console.log("\nTop 30 pipelines among NON-NULL-stored mismatches (the overwrite slice):\n");
  const pipes = await prisma.$queryRaw<
    Array<{ pipeline: string; stored: string; correct: string; n: number }>
  >`
    SELECT c."ingestedBy" AS pipeline,
           c."epistemicAxis" AS stored,
           term.term AS correct,
           COUNT(*)::int AS n
    FROM "Claim" c
    JOIN LATERAL (
      SELECT h."toAxis" AS term
      FROM "ClaimStatusHistory" h
      WHERE h."claimId" = c.id
      ORDER BY h.seq DESC NULLS FIRST, h."occurredAt" DESC, h."createdAt" DESC
      LIMIT 1
    ) term ON true
    WHERE c."epistemicAxis" IS NOT NULL
      AND c."epistemicAxis" IS DISTINCT FROM term.term
    GROUP BY 1, 2, 3
    ORDER BY n DESC
    LIMIT 30`;
  for (const p of pipes)
    console.log(`  ${String(p.pipeline).padEnd(34)} ${p.stored.padEnd(12)} → ${p.correct.padEnd(12)} ${p.n}`);

  console.log("\nRead-only census complete — no writes.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
