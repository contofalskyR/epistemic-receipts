/**
 * B17-3 — Import promoter review verdicts into Claim.metadata (OWNER-GATED).
 *
 * Reads the corpus promoter's attempted ledger (gitignored, lives on the
 * owner's Mac) and writes metadata.promoterReview onto each SKIPPED claim:
 *
 *   promoterReview = { reviewedAt, result, model?, skipReason? (truncated) }
 *
 * so /canon can render the third state: "Reviewed <date> · no settling event
 * found". Promoted rows are ignored (their receipts are the transitions).
 *
 * Contract (per brief + OPENCLAW data doctrine):
 *   - DRY-RUN BY DEFAULT. `--execute` performs writes, and only after the
 *     checkpoint memo has its recorded owner yes.
 *   - MERGE, never clobber: only the promoterReview key is touched; a claim
 *     whose promoterReview already matches is skipped (idempotent).
 *   - Deterministic order (claimId asc), cursor-resumable via --resume-from.
 *   - Re-runnable as a standing post-tier step: after the fable ≥4,000 tier
 *     completes, one re-run imports its skips.
 *
 * Usage:
 *   npx tsx scripts/import-promoter-review-status.ts                 # dry run
 *   npx tsx scripts/import-promoter-review-status.ts --execute
 *   npx tsx scripts/import-promoter-review-status.ts --ledger <path> --resume-from <claimId>
 */

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";

const prisma = new PrismaClient();
const SKIP_REASON_CAP = 500;

type LedgerRow = {
  claimId: string;
  ts: string;
  result: string;
  pipeline?: string;
  model?: string;
  skipReason?: string;
};

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  return i > -1 ? process.argv[i + 1] : undefined;
}

async function main() {
  const execute = process.argv.includes("--execute");
  const ledgerPath = arg("--ledger") ?? "logs/corpus-promoter-attempted.jsonl";
  const resumeFrom = arg("--resume-from") ?? "";

  if (!fs.existsSync(ledgerPath)) {
    console.error(`Ledger not found: ${ledgerPath} (run on the owner's Mac, or pass --ledger <copy>)`);
    process.exit(1);
  }

  // Parse ledger; keep the LATEST skip entry per claimId (re-reviews supersede).
  const latestSkip = new Map<string, LedgerRow>();
  let promoted = 0,
    malformed = 0,
    totalRows = 0;
  for (const line of fs.readFileSync(ledgerPath, "utf8").split("\n")) {
    if (!line.trim()) continue;
    totalRows++;
    let row: LedgerRow;
    try {
      row = JSON.parse(line);
    } catch {
      malformed++;
      continue;
    }
    if (!row.claimId || !row.ts) {
      malformed++;
      continue;
    }
    if (row.result === "skipped") {
      const prev = latestSkip.get(row.claimId);
      if (!prev || row.ts > prev.ts) latestSkip.set(row.claimId, row);
    } else {
      promoted++;
    }
  }

  const targets = [...latestSkip.values()]
    .sort((a, b) => (a.claimId < b.claimId ? -1 : 1))
    .filter((r) => r.claimId > resumeFrom);

  console.log(
    `Ledger: ${totalRows} rows · ${latestSkip.size} distinct skipped claims · ${promoted} promoted/other rows · ${malformed} malformed`
  );
  console.log(`${targets.length} to process${resumeFrom ? ` (resuming after ${resumeFrom})` : ""} · mode: ${execute ? "EXECUTE" : "dry-run"}\n`);

  let written = 0,
    alreadyCurrent = 0,
    missing = 0,
    wouldWrite = 0;
  let lastProcessed = resumeFrom;

  for (const row of targets) {
    const claim = await prisma.claim.findUnique({
      where: { id: row.claimId },
      select: { id: true, metadata: true },
    });
    if (!claim) {
      missing++;
      lastProcessed = row.claimId;
      continue;
    }
    const meta = (claim.metadata ?? {}) as Record<string, unknown>;
    const next = {
      reviewedAt: row.ts,
      result: "no_settling_event_found",
      ...(row.model ? { model: row.model } : {}),
      ...(row.skipReason ? { skipReason: row.skipReason.trim().slice(0, SKIP_REASON_CAP) } : {}),
    };
    const current = meta.promoterReview as Record<string, unknown> | undefined;
    if (current && JSON.stringify(current) === JSON.stringify(next)) {
      alreadyCurrent++;
      lastProcessed = row.claimId;
      continue;
    }
    if (execute) {
      // Merge: spread existing metadata, replace only promoterReview.
      await prisma.claim.update({
        where: { id: claim.id },
        data: { metadata: { ...meta, promoterReview: next } as object },
      });
      written++;
    } else {
      wouldWrite++;
    }
    lastProcessed = row.claimId;
  }

  console.log(`\n${execute ? "EXECUTED" : "DRY RUN"} summary:`);
  console.log(`  ${execute ? "written" : "would write"}: ${execute ? written : wouldWrite}`);
  console.log(`  already current (idempotent skips): ${alreadyCurrent}`);
  console.log(`  claimIds not found in DB: ${missing}`);
  console.log(`  last processed claimId (for --resume-from): ${lastProcessed || "(none)"}`);

  if (execute) {
    // DB-verified count per the verify-against-DB-state rule.
    const dbCount = await prisma.$queryRawUnsafe<{ n: number }[]>(
      `SELECT COUNT(*)::int AS n FROM "Claim" WHERE metadata ? 'promoterReview'`
    );
    console.log(`  DB-verified: ${dbCount[0].n} claims now carry metadata.promoterReview`);
  } else {
    console.log(`\nNext: paste these counts into the C-3 checkpoint memo; after the owner's recorded yes, re-run with --execute.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
