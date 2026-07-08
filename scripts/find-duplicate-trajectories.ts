// Find near-duplicate curated trajectories (READ-ONLY).
//
// Motivation: the /settling-curve default view showed the same Jan 2023 AAP
// childhood-obesity guideline as four separately-worded trajectories, inside a
// wall of ~14 near-identical AAP entries (AUDIT-PRELAUNCH-2026-07-06 §6).
// This script lists duplicate groups for editorial review — it never writes.
// Cleanup (merging / flagging DEPRECATED) is a human decision, per house rules.
//
// Run (list only, READ-ONLY):
//   npx tsx scripts/find-duplicate-trajectories.ts [--threshold 0.55]
//
// Run (perform cleanup — WRITES to the DB, your decision):
//   npx tsx scripts/find-duplicate-trajectories.ts --deprecate
// This flags every non-kept member verificationStatus=DEPRECATED (preserved
// for the audit trail, hidden from default views). It never hard-deletes.
// The "keep" pick is a heuristic (most transitions, then shortest slug) — eyeball
// the --list output first; some groups keep a narrower-span entry. Override by
// re-running after manually promoting the one you want (give it more history) or
// edit KEEP_OVERRIDES below.

// Own client, NOT the app singleton — lib/prisma.ts imports "server-only",
// which throws when run outside the Next runtime (fixed 2026-07-08).
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const threshold = (() => {
  const i = process.argv.indexOf("--threshold");
  return i === -1 ? 0.55 : Number(process.argv[i + 1]);
})();

const doDeprecate = process.argv.includes("--deprecate");

// externalId (without the "trajectory:" prefix) → force-keep this group member.
// Populate after reviewing --list output where the heuristic picks wrong.
const KEEP_OVERRIDES = new Set<string>([
  // e.g. "pap-smear-cervical-cancer-screening-1941",
]);

function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

async function main() {
  const rows = await prisma.claim.findMany({
    where: { externalId: { startsWith: "trajectory:" }, deleted: false },
    select: {
      id: true,
      externalId: true,
      ingestedBy: true,
      text: true,
      verificationStatus: true,
      _count: { select: { statusHistory: true } },
    },
    orderBy: { externalId: "asc" },
  });
  console.log(`trajectory: claims = ${rows.length}\n`);

  type Group = { toks: Set<string>; rows: typeof rows };
  const groups: Group[] = [];
  for (const r of rows) {
    const toks = tokens(r.text);
    const g = groups.find((g) => jaccard(toks, g.toks) > threshold);
    if (g) {
      g.rows.push(r);
      for (const t of toks) g.toks.add(t);
    } else {
      groups.push({ toks, rows: [r] });
    }
  }

  const dupes = groups.filter((g) => g.rows.length > 1);
  const slug = (extId: string | null) => (extId ?? "").replace(/^trajectory:/, "");
  const pickKeep = (rows: Group["rows"]) =>
    rows.find((r) => KEEP_OVERRIDES.has(slug(r.externalId))) ??
    [...rows].sort(
      (a, b) =>
        b._count.statusHistory - a._count.statusHistory ||
        slug(a.externalId).length - slug(b.externalId).length,
    )[0];

  console.log(`near-duplicate groups (jaccard > ${threshold}): ${dupes.length}`);
  const dropTotal = dupes.reduce((s, g) => s + g.rows.length - 1, 0);
  console.log(`trajectories in groups: ${dupes.reduce((s, g) => s + g.rows.length, 0)} · would deprecate: ${dropTotal}\n`);

  const toDeprecate: string[] = [];
  for (const [i, g] of dupes.entries()) {
    const keep = pickKeep(g.rows);
    console.log(`── group ${i + 1} ─ ${g.rows.length} trajectories ──`);
    for (const r of g.rows) {
      const tag = r.id === keep.id ? "KEEP" : "drop";
      if (r.id !== keep.id) toDeprecate.push(r.id);
      console.log(
        `  [${tag}] ${slug(r.externalId)}  ` +
          `transitions=${r._count.statusHistory}  vs=${r.verificationStatus ?? "NULL"}`,
      );
    }
    console.log(`    > ${keep.text.slice(0, 110).replace(/\s+/g, " ")}…`);
    console.log();
  }

  if (!doDeprecate) {
    console.log(
      `Dry run. Re-run with --deprecate to flag ${toDeprecate.length} non-kept ` +
        `members verificationStatus=DEPRECATED (reversible; nothing is deleted).`,
    );
    return;
  }

  const res = await prisma.claim.updateMany({
    where: { id: { in: toDeprecate } },
    data: { verificationStatus: "DEPRECATED" },
  });
  console.log(`Deprecated ${res.count} duplicate trajectories. Kept ${dupes.length} canonical.`);
}

main().finally(() => prisma.$disconnect());
