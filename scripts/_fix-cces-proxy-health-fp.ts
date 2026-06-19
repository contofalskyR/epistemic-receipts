/**
 * One-shot migration: remap ConstituentOpinion rows for `health` and
 * `foreign_policy` from their broken proxy variables to `dem` (pid3 % Democrat).
 *
 *  - health:          questionCode "uninsured" → "dem", supportPct ← metadata.demPct
 *  - foreign_policy:  questionCode "liberal"   → "dem", supportPct ← metadata.demPct
 *
 * The `demPct` value is already present in the stored `metadata` blob from
 * the original _cces_extract.py run.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- \
 *     npx ts-node --project tsconfig.scripts.json \
 *     scripts/_fix-cces-proxy-health-fp.ts [--dry-run]
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";

if (typeof WebSocket === "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  neonConfig.webSocketConstructor = require("ws");
}

function makePrisma() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL not set");
  return new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });
}

type FixTarget = { topicSlug: string; oldCode: string };

const FIXES: FixTarget[] = [
  { topicSlug: "health", oldCode: "uninsured" },
  { topicSlug: "foreign_policy", oldCode: "liberal" },
];

async function main() {
  const dryRun = !process.argv.includes("--apply");
  console.log(`[fix-cces-proxy] mode=${dryRun ? "DRY-RUN (pass --apply to write)" : "APPLY"}`);

  const prisma = makePrisma();
  try {
    for (const { topicSlug, oldCode } of FIXES) {
      const rows = await prisma.constituentOpinion.findMany({
        where: { topicSlug, questionCode: oldCode },
        select: {
          id: true, state: true, year: true, supportPct: true,
          sampleSize: true, questionCode: true, metadata: true,
        },
      });

      console.log(`\n[${topicSlug}] found ${rows.length} rows with questionCode="${oldCode}"`);
      if (rows.length === 0) continue;

      let updated = 0;
      let skipped = 0;
      let noMetaDem = 0;

      for (const row of rows) {
        const meta = row.metadata as Record<string, unknown> | null;
        const demPct = meta && typeof meta["demPct"] === "number" ? meta["demPct"] : null;

        if (demPct === null) {
          noMetaDem += 1;
          if (noMetaDem <= 3) {
            console.log(`  WARN: no demPct in metadata for ${row.state}/${row.year} — skipping`);
          }
          continue;
        }

        // Derive sampleSize from metadata.respondents if possible (pid_n is
        // the denominator for dem_pct, but we don't store it separately).
        // Best we can do is use the stored respondents count as a proxy —
        // or keep existing sampleSize (less accurate but not harmful).
        const newSampleSize = typeof meta?.["respondents"] === "number"
          ? (meta["respondents"] as number)
          : row.sampleSize;

        if (dryRun) {
          console.log(
            `  DRY: ${row.state} ${row.year} ${topicSlug}: supportPct ${row.supportPct.toFixed(1)}%→${demPct.toFixed(1)}% questionCode ${row.questionCode}→dem sampleSize ${row.sampleSize}→${newSampleSize}`,
          );
          updated += 1;
          continue;
        }

        // Check for a conflicting row with questionCode="dem" (shouldn't exist, but be safe).
        const conflict = await prisma.constituentOpinion.findFirst({
          where: {
            state: row.state,
            district: null,
            year: row.year,
            topicSlug,
            questionCode: "dem",
          },
          select: { id: true },
        });

        if (conflict) {
          // A dem row already exists — delete the old one, keep the dem one.
          await prisma.constituentOpinion.delete({ where: { id: row.id } });
          console.log(`  CONFLICT: deleted old ${oldCode} row for ${row.state}/${row.year} (dem row already present)`);
          skipped += 1;
          continue;
        }

        await prisma.constituentOpinion.update({
          where: { id: row.id },
          data: {
            supportPct: demPct,
            sampleSize: newSampleSize,
            questionCode: "dem",
          },
        });
        updated += 1;
      }

      console.log(`[${topicSlug}] updated=${updated} skipped=${skipped} noMetaDem=${noMetaDem}`);
    }

    if (!dryRun) {
      // Verify final state
      for (const { topicSlug } of FIXES) {
        const demCount = await prisma.constituentOpinion.count({
          where: { topicSlug, questionCode: "dem" },
        });
        const oldCount = await prisma.constituentOpinion.count({
          where: { topicSlug, questionCode: { in: ["uninsured", "liberal"] } },
        });
        console.log(`\n[verify] ${topicSlug}: dem rows=${demCount} remaining old-code rows=${oldCount}`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
