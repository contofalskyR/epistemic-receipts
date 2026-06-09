/**
 * check-data-integrity.ts
 *
 * Nightly data-integrity invariant checks. Reports violations but does not
 * modify any data.
 *
 * Usage:
 *   npx tsx scripts/check-data-integrity.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const VALID_AXES = [
  "SETTLED",
  "CONTESTED",
  "RECORDED",
  "OPEN",
  "UNRESOLVABLE",
] as const;

interface CheckResult {
  name: string;
  violations: number;
  details?: string;
}

async function checkClaimsWithoutSource(): Promise<CheckResult> {
  // Claims that have zero non-deleted edges (i.e. no source link at all),
  // or whose only edges point to sources with a NULL url.
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT count(*)::bigint AS count
    FROM "Claim" c
    WHERE c."deleted" = false
      AND NOT EXISTS (
        SELECT 1
        FROM "Edge" e
        JOIN "Source" s ON s."id" = e."sourceId"
        WHERE e."claimId" = c."id"
          AND e."deleted" = false
          AND s."url" IS NOT NULL
          AND s."url" <> ''
      )
  `);
  return {
    name: "Claims without a source URL",
    violations: Number(rows[0].count),
  };
}

async function checkOrphanedClaimRelations(): Promise<CheckResult> {
  // ClaimRelation edges where either side no longer exists.
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(`
    SELECT count(*)::bigint AS count
    FROM "ClaimRelation" cr
    WHERE NOT EXISTS (SELECT 1 FROM "Claim" WHERE "id" = cr."fromClaimId")
       OR NOT EXISTS (SELECT 1 FROM "Claim" WHERE "id" = cr."toClaimId")
  `);
  return {
    name: "Orphaned ClaimRelation edges (missing from/to claim)",
    violations: Number(rows[0].count),
  };
}

async function checkInvalidEpistemicAxis(): Promise<CheckResult> {
  const placeholders = VALID_AXES.map((_, i) => `$${i + 1}`).join(", ");
  const rows = await prisma.$queryRawUnsafe<[{ count: bigint }]>(
    `SELECT count(*)::bigint AS count
     FROM "Claim"
     WHERE "epistemicAxis" IS NOT NULL
       AND "epistemicAxis" NOT IN (${placeholders})`,
    ...VALID_AXES,
  );
  return {
    name: "Claims with invalid epistemicAxis value",
    violations: Number(rows[0].count),
  };
}

async function checkDuplicateClaims(): Promise<CheckResult> {
  // Duplicate = same (text, ingestedBy) appearing more than once among
  // non-deleted claims.
  const rows = await prisma.$queryRawUnsafe<Array<{ text: string; ingestedBy: string; cnt: bigint }>>(`
    SELECT c."text", c."ingestedBy", count(*)::bigint AS cnt
    FROM "Claim" c
    WHERE c."deleted" = false
    GROUP BY c."text", c."ingestedBy"
    HAVING count(*) > 1
    ORDER BY cnt DESC
    LIMIT 25
  `);

  const totalDupes = rows.reduce((sum, r) => sum + Number(r.cnt), 0);
  const groupCount = rows.length;
  const details =
    groupCount > 0
      ? `Top duplicate groups (showing up to 25):\n` +
        rows
          .slice(0, 10)
          .map(
            (r) =>
              `  [${r.ingestedBy}] "${r.text.slice(0, 80)}${r.text.length > 80 ? "..." : ""}" x${r.cnt}`,
          )
          .join("\n")
      : undefined;

  return {
    name: "Duplicate claims (same text + ingestedBy)",
    violations: totalDupes,
    details: groupCount > 10 ? `${details}\n  ... and ${groupCount - 10} more groups` : details,
  };
}

async function main() {
  console.log("=== Epistemic Receipts — Data Integrity Check ===");
  console.log(`Run at: ${new Date().toISOString()}\n`);

  const checks: CheckResult[] = await Promise.all([
    checkClaimsWithoutSource(),
    checkOrphanedClaimRelations(),
    checkInvalidEpistemicAxis(),
    checkDuplicateClaims(),
  ]);

  let totalViolations = 0;

  for (const check of checks) {
    const status = check.violations === 0 ? "PASS" : "WARN";
    console.log(`[${status}] ${check.name}: ${check.violations.toLocaleString()} violations`);
    if (check.details) {
      console.log(check.details);
    }
    totalViolations += check.violations;
  }

  console.log(`\n--- Summary: ${totalViolations.toLocaleString()} total violations across ${checks.length} checks ---`);

  await prisma.$disconnect();
  process.exit(totalViolations > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
