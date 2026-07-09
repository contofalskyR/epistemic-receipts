/**
 * review-stamp-whitepaper-claims.ts — mark the two whitepaper-cited claims as
 * human-reviewed after Robert's read of the inspect dump.
 * (briefings/10-HANDOFF.md §remains #1; advisor redirect 2026-07-09.)
 *
 * The curves are ALREADY BUILT (real primary sources, real dates, receipt-grade
 * reasons — verified in logs/inspect-whitepaper-claims.log). The only thing
 * missing was the review stamp. This sets ONLY the four review fields on EXACTLY
 * these two ids and nothing else:
 *   humanReviewed = true
 *   reviewConfidence = HIGH   (primary-sourced, dated, Robert-eyeballed)
 *   reviewedAt = now
 *   reviewedBy = "robert"
 * It never touches currentStatus (deprecated), epistemicAxis, the status
 * history, or the curves. No updateMany, no filters — one exact-id update per
 * hardcoded target, so it is structurally impossible to hit a third claim.
 *
 * PREFLIGHT BY DEFAULT — reads + prints a before/after diff, writes nothing.
 * --execute performs the write. Idempotent: a claim already stamped by "robert"
 * is reported and skipped, so re-runs are safe.
 *
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/review-stamp-whitepaper-claims.ts            # preflight
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/review-stamp-whitepaper-claims.ts --execute  # write
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
loadEnv();
// Same guard as inspect-whitepaper-claims.ts / the --direct scripts: an empty or
// stale DATABASE_URL in the shell shadows .env.local (Prisma then reports it
// "not found"). Prefer the direct (non-pooled) URL; a two-row write is trivial.
if (process.env.DIRECT_URL) process.env.DATABASE_URL = process.env.DIRECT_URL;
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const EXECUTE = process.argv.includes("--execute");
const REVIEWER = "robert";
const CONFIDENCE = "HIGH" as const; // ReviewConfidence enum: HIGH | MEDIUM | LOW

const TARGETS = [
  { id: "cmqwoxe6l07dy8o0y6xrs8xnv", label: "Surgeon General 1964  (paper ref [1])" },
  { id: "cmqoappnu03yxsadpa90nu942", label: "Müller 1939          (paper ref [2])" },
];

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

async function main() {
  console.log(
    `review-stamp-whitepaper-claims — ${EXECUTE ? "EXECUTE (writing)" : "PREFLIGHT (no writes)"}`,
  );
  console.log(`  reviewer="${REVIEWER}"  confidence=${CONFIDENCE}\n`);

  const now = new Date();
  let wouldWrite = 0;
  let alreadyDone = 0;
  let notFound = 0;

  for (const t of TARGETS) {
    const claim = await prisma.claim.findUnique({
      where: { id: t.id },
      select: {
        id: true, externalId: true, epistemicAxis: true,
        humanReviewed: true, reviewConfidence: true, reviewedAt: true, reviewedBy: true,
        _count: { select: { statusHistory: true } },
      },
    });

    if (!claim) {
      console.log(`!! NOT FOUND: ${t.id}  (${t.label}) — skipping\n`);
      notFound++;
      continue;
    }

    console.log(`${t.label}`);
    console.log(`  id=${claim.id}  ${claim.externalId}`);
    console.log(`  axis=${claim.epistemicAxis}  historyRows=${claim._count.statusHistory}`);
    console.log(
      `  before: humanReviewed=${claim.humanReviewed} confidence=${claim.reviewConfidence} ` +
      `by=${claim.reviewedBy} at=${iso(claim.reviewedAt)}`,
    );

    if (claim.humanReviewed && claim.reviewedBy === REVIEWER) {
      console.log(`  = already stamped by "${REVIEWER}"; no change\n`);
      alreadyDone++;
      continue;
    }

    console.log(
      `  after : humanReviewed=true confidence=${CONFIDENCE} by=${REVIEWER} at=${iso(now)}`,
    );
    wouldWrite++;

    if (EXECUTE) {
      const res = await prisma.claim.update({
        where: { id: t.id }, // exact id — cannot match any other claim
        data: {
          humanReviewed: true,
          reviewConfidence: CONFIDENCE,
          reviewedAt: now,
          reviewedBy: REVIEWER,
        },
        select: {
          id: true, humanReviewed: true, reviewConfidence: true,
          reviewedBy: true, reviewedAt: true,
        },
      });
      console.log(`  ✓ written: ${JSON.stringify({ ...res, reviewedAt: iso(res.reviewedAt) })}`);
    }
    console.log();
  }

  console.log(
    `${EXECUTE ? "WROTE" : "would write"} ${wouldWrite} · already-stamped ${alreadyDone} · ` +
    `not-found ${notFound} · of ${TARGETS.length} targets`,
  );
  if (!EXECUTE && wouldWrite > 0) {
    console.log(`Re-run with --execute to write.`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
