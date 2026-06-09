import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const ALLOWED_AXES = new Set(["SETTLED", "CONTESTED", "RECORDED", "OPEN", "UNRESOLVABLE"]);
const SOURCE_URL_WARN_THRESHOLD = 0.8;

type CheckResult = {
  name: string;
  count: number;
  pass: boolean;
  message: string;
  warnOnly?: boolean;
};

async function checkSourceUrlCoverage(): Promise<CheckResult> {
  // Claims linked to at least one Source that has a non-null URL (via Edge)
  const rows = await prisma.$queryRaw<[{ total: bigint; with_url: bigint }]>`
    SELECT
      count(DISTINCT c."id")::bigint AS total,
      count(DISTINCT CASE WHEN s."url" IS NOT NULL THEN c."id" END)::bigint AS with_url
    FROM "Claim" c
    LEFT JOIN "Edge" e ON e."claimId" = c."id" AND e."deleted" = false
    LEFT JOIN "Source" s ON s."id" = e."sourceId"
    WHERE c."deleted" = false
  `;
  const total = Number(rows[0].total);
  const withUrl = Number(rows[0].with_url);
  const coverage = total > 0 ? withUrl / total : 1;
  const pct = (coverage * 100).toFixed(1);
  const pass = coverage >= SOURCE_URL_WARN_THRESHOLD;
  return {
    name: "Source URL coverage",
    count: total - withUrl,
    pass,
    message: `${withUrl}/${total} claims have a Source with URL (${pct}%)`,
    warnOnly: true,
  };
}

async function checkOrphanedEdges(): Promise<CheckResult> {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT count(*)::bigint AS count
    FROM "ClaimRelation" cr
    WHERE NOT EXISTS (SELECT 1 FROM "Claim" c WHERE c."id" = cr."fromClaimId")
       OR NOT EXISTS (SELECT 1 FROM "Claim" c WHERE c."id" = cr."toClaimId")
  `;
  const count = Number(rows[0].count);
  return {
    name: "Orphaned ClaimRelation edges",
    count,
    pass: count === 0,
    message: `${count} ClaimRelation rows reference non-existent claim IDs`,
  };
}

async function checkStatusVocabulary(): Promise<CheckResult> {
  const rows = await prisma.$queryRaw<Array<{ epistemicAxis: string; cnt: bigint }>>`
    SELECT "epistemicAxis", count(*)::bigint AS cnt
    FROM "Claim"
    WHERE "deleted" = false
      AND "epistemicAxis" IS NOT NULL
    GROUP BY "epistemicAxis"
  `;
  const bad = rows.filter(r => !ALLOWED_AXES.has(r.epistemicAxis));
  const count = bad.reduce((sum, r) => sum + Number(r.cnt), 0);
  const badValues = bad.map(r => `${r.epistemicAxis}(${r.cnt})`).join(", ");
  return {
    name: "epistemicAxis vocabulary",
    count,
    pass: count === 0,
    message: count === 0
      ? `All epistemicAxis values are valid`
      : `${count} claims have invalid epistemicAxis: ${badValues}`,
  };
}

async function checkDuplicates(): Promise<CheckResult> {
  const rows = await prisma.$queryRaw<[{ count: bigint }]>`
    SELECT count(*)::bigint AS count
    FROM (
      SELECT "text", "claimType", "sourceUrl"
      FROM "Claim"
      WHERE "deleted" = false
        AND "sourceUrl" IS NOT NULL
      GROUP BY "text", "claimType", "sourceUrl"
      HAVING count(*) > 1
    ) dupes
  `;
  const count = Number(rows[0].count);
  return {
    name: "Duplicate claims (text+claimType+sourceUrl)",
    count,
    pass: count === 0,
    message: `${count} distinct (text, claimType, sourceUrl) triplets have duplicates`,
  };
}

async function main() {
  console.log("=== Epistemic Receipts — Data Integrity Check ===\n");

  const checks: CheckResult[] = await Promise.all([
    checkSourceUrlCoverage(),
    checkOrphanedEdges(),
    checkStatusVocabulary(),
    checkDuplicates(),
  ]);

  let anyFail = false;

  for (const c of checks) {
    const icon = c.pass ? "✅" : c.warnOnly ? "⚠️ " : "❌";
    const status = c.pass ? "PASS" : c.warnOnly ? "WARN" : "FAIL";
    console.log(`${icon} [${status}] ${c.name}`);
    console.log(`       ${c.message}\n`);
    if (!c.pass && !c.warnOnly) anyFail = true;
  }

  const failures = checks.filter(c => !c.pass && !c.warnOnly);
  const warnings = checks.filter(c => !c.pass && c.warnOnly);

  console.log(`--- Summary: ${checks.filter(c => c.pass).length} passed, ${warnings.length} warned, ${failures.length} failed ---`);

  if (anyFail) process.exit(1);
}

main()
  .catch(err => {
    console.error("Integrity check failed with error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
