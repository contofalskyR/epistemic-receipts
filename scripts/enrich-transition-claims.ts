/**
 * Enrich ClaimStatusHistory transitions with structured claim snapshots.
 *
 * For each transition that (a) has a linked Source and (b) has no snapshot
 * yet, calls `claude --print` to extract a JSON array of {category, claim}
 * pairs from the transition's reason text + source name. Stores the result
 * in TransitionClaimsSnapshot. Powers /labs/claim-diff.
 *
 * Usage:
 *   npx ts-node --project tsconfig.scripts.json scripts/enrich-transition-claims.ts
 *   npx ts-node --project tsconfig.scripts.json scripts/enrich-transition-claims.ts --dry-run
 *   npx ts-node --project tsconfig.scripts.json scripts/enrich-transition-claims.ts --limit=50
 */
import { PrismaClient } from "@prisma/client";
import { execFileSync } from "child_process";

const prisma = new PrismaClient();
const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : Infinity;
const BATCH_SIZE = 10;

const CATEGORY_LIST =
  "dosing, efficacy, mechanism, safety, population, methodology, finding";

type Row = {
  id: string;
  reason: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
};

type Extracted = { category: string; claim: string };

function extractClaims(reason: string, sourceName: string): Extracted[] {
  const prompt = `Extract key factual claims from this scientific paper summary. Return JSON array of {category, claim} objects. Categories: ${CATEGORY_LIST}. Summary: ${sourceName}. ${reason}`;

  let out: string;
  try {
    out = execFileSync(
      "claude",
      ["--model", "claude-haiku-4-5-20251001", "--print", "-p", prompt],
      { encoding: "utf-8", timeout: 90000, maxBuffer: 4 * 1024 * 1024 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`claude CLI failed: ${msg.slice(0, 300)}`);
  }

  const match = out.match(/\[[\s\S]*\]/);
  if (!match) throw new Error(`no JSON array in claude output: ${out.slice(0, 200)}`);
  const parsed: unknown = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("parsed JSON is not an array");
  return parsed
    .filter(
      (r): r is Extracted =>
        typeof r === "object" &&
        r !== null &&
        typeof (r as { category?: unknown }).category === "string" &&
        typeof (r as { claim?: unknown }).claim === "string",
    )
    .map((r) => ({
      category: r.category.trim().toLowerCase().slice(0, 40),
      claim: r.claim.trim().slice(0, 500),
    }))
    .filter((r) => r.category && r.claim);
}

async function main() {
  console.log(
    `[enrich-transition-claims] starting${DRY_RUN ? " (dry-run)" : ""}${isFinite(LIMIT) ? ` limit=${LIMIT}` : ""}`,
  );

  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      csh.id,
      csh.reason,
      s.name AS "sourceName",
      s.url  AS "sourceUrl"
    FROM "ClaimStatusHistory" csh
    JOIN "Source" s ON csh."sourceId" = s.id
    LEFT JOIN "TransitionClaimsSnapshot" t ON t."claimStatusHistoryId" = csh.id
    WHERE csh."sourceId" IS NOT NULL
      AND csh.reason IS NOT NULL
      AND length(csh.reason) > 30
      AND t.id IS NULL
    ORDER BY csh."occurredAt" ASC
  `;

  const targets = isFinite(LIMIT) ? rows.slice(0, LIMIT) : rows;
  console.log(`[enrich-transition-claims] ${targets.length} transitions to enrich`);
  if (targets.length === 0) {
    await prisma.$disconnect();
    return;
  }

  let done = 0;
  let errors = 0;
  let skipped = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    for (const row of batch) {
      if (!row.reason || !row.sourceName) {
        skipped++;
        continue;
      }
      try {
        const extracted = extractClaims(row.reason, row.sourceName);
        if (extracted.length === 0) {
          console.warn(`  [skip] ${row.id}: 0 claims extracted`);
          skipped++;
          continue;
        }
        if (DRY_RUN) {
          console.log(
            `  [dry] ${row.id} → ${extracted.length} claims: ${extracted
              .map((c) => c.category)
              .join(", ")}`,
          );
        } else {
          await prisma.transitionClaimsSnapshot.create({
            data: {
              claimStatusHistoryId: row.id,
              extractedClaims: extracted,
            },
          });
        }
        done++;
      } catch (e) {
        errors++;
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  [err] ${row.id}: ${msg.slice(0, 200)}`);
      }
    }
    console.log(
      `[enrich-transition-claims] batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(targets.length / BATCH_SIZE)} — done=${done} skipped=${skipped} errors=${errors}`,
    );
  }

  console.log(
    `[enrich-transition-claims] finished: done=${done} skipped=${skipped} errors=${errors}${DRY_RUN ? " (dry-run — nothing written)" : ""}`,
  );

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
