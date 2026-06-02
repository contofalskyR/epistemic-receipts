/**
 * tag-retracted-claims.ts
 *
 * Marks claims whose findings have been formally retracted (i.e. they are the
 * `fromClaim` of a REVERSED ClaimRelation) as `verificationStatus: DISPUTED`.
 *
 * Why. As of 2026-06-02 there are 11,319 REVERSED ClaimRelation rows pointing
 * out of `openalex_v1` claims into `crossref_retractions_v1` retraction-notice
 * claims. Those `openalex_v1` "from" claims are currently `PROVISIONAL`, which
 * is misleading — the published findings have been formally disputed by the
 * journal of record. Setting them to `DISPUTED` reflects the actual state of
 * the literature and lets the homepage/topic views render retracted papers
 * with the correct status badge without re-querying ClaimRelation each time.
 *
 * Idempotent: a claim already at DISPUTED (or any non-PROVISIONAL status, e.g.
 * HARD_FACT or DEPRECATED) is skipped — we only flip PROVISIONAL → DISPUTED so
 * we don't trample human-reviewed claims or retired records.
 *
 * Writes use `prisma.$transaction(..., { timeout: 30_000 })` in 500-row batches
 * (CONSULTANT rule 5). `ALLOW_EDITS=true` required; otherwise dry-run only.
 *
 * Run:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/tag-retracted-claims.ts --dry-run
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/tag-retracted-claims.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = !process.env.ALLOW_EDITS || process.argv.includes("--dry-run");
const BATCH_SIZE = 500;

async function main() {
  console.log(`tag-retracted-claims — ${DRY_RUN ? "DRY RUN" : "WRITE MODE"}`);

  // 1. Distinct fromClaimIds with relationType=REVERSED
  const relations = await prisma.claimRelation.findMany({
    where: { relationType: "REVERSED" },
    select: { fromClaimId: true },
    distinct: ["fromClaimId"],
  });
  const fromIds = relations.map((r) => r.fromClaimId);
  console.log(`  REVERSED fromClaim distinct count: ${fromIds.length}`);

  // 2. Of those, which are still PROVISIONAL? (skip already-DISPUTED, HARD_FACT, DEPRECATED, etc.)
  const targets = await prisma.claim.findMany({
    where: { id: { in: fromIds }, verificationStatus: "PROVISIONAL" },
    select: { id: true },
  });
  const targetIds = targets.map((t) => t.id);
  console.log(`  Already-non-PROVISIONAL (skipped): ${fromIds.length - targetIds.length}`);
  console.log(`  To update PROVISIONAL → DISPUTED: ${targetIds.length}`);

  if (targetIds.length === 0) {
    console.log("  Nothing to do.");
    return;
  }

  if (DRY_RUN) {
    const sample = await prisma.claim.findMany({
      where: { id: { in: targetIds.slice(0, 5) } },
      select: { id: true, text: true, ingestedBy: true, verificationStatus: true },
    });
    console.log("  Sample targets:");
    for (const c of sample) {
      console.log(
        `    ${c.id} [${c.ingestedBy} · ${c.verificationStatus}] ${c.text.slice(0, 80)}`,
      );
    }
    console.log("\n  (dry run — no writes). Re-run with ALLOW_EDITS=true to apply.");
    return;
  }

  // 3. Batched updates in transactions
  let updated = 0;
  for (let i = 0; i < targetIds.length; i += BATCH_SIZE) {
    const batch = targetIds.slice(i, i + BATCH_SIZE);
    await prisma.$transaction(
      async (tx) => {
        const res = await tx.claim.updateMany({
          where: { id: { in: batch }, verificationStatus: "PROVISIONAL" },
          data: { verificationStatus: "DISPUTED" },
        });
        updated += res.count;
      },
      { timeout: 30_000 },
    );
    console.log(
      `  batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targetIds.length / BATCH_SIZE)} — running total: ${updated}`,
    );
  }

  console.log(`\n  DONE. Updated ${updated} claims PROVISIONAL → DISPUTED.`);

  // 4. Final DB-state verification (CONSULTANT rule 6)
  const finalDisputed = await prisma.claim.count({
    where: { id: { in: targetIds }, verificationStatus: "DISPUTED" },
  });
  console.log(`  Verification: ${finalDisputed} of ${targetIds.length} targets now DISPUTED.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
