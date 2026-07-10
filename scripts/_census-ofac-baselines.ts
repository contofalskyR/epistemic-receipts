/**
 * _census-ofac-baselines.ts — READ-ONLY census resolving the 2026-07-10
 * discrepancy: the ofac_sdn_v1 audit shows 8,981 transitions on 8,973 claims
 * (= one baseline each + 8 pilot inserts), yet the delistings pipeline
 * residued 11 matched claims as "terminal none" (statusHistory empty).
 *
 * Prints: (a) global count of ofac_sdn_v1 claims with ZERO history rows,
 * (b) per-entity detail for the 11 terminal-none residues (all claims whose
 * text contains the name: id, createdAt, claimEmergedAt, history count,
 * terminal axis) — which also surfaces duplicate-claim explanations.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/_census-ofac-baselines.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PIPELINE = "ofac_sdn_v1";

const RESIDUE_NAMES = [
  "RAYKES",
  "KRUGOVOV",
  "TOPCHI",
  "BELOUS",
  "KLYUKIN",
  "KREMLEVA",
  "NIKOLAEV",
  "IDA ASANSOR",
  "MEGASAN",
  "SSGCTM",
  "MINYON",
];

async function main() {
  const zeroHistory = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n
    FROM "Claim" c
    WHERE c."ingestedBy" = ${PIPELINE}
      AND c.deleted = false
      AND NOT EXISTS (SELECT 1 FROM "ClaimStatusHistory" h WHERE h."claimId" = c.id)`;
  console.log(`\nofac_sdn_v1 claims with ZERO ClaimStatusHistory rows: ${zeroHistory[0].n}`);

  const multiRow = await prisma.$queryRaw<Array<{ n: number }>>`
    SELECT COUNT(*)::int AS n FROM (
      SELECT h."claimId"
      FROM "ClaimStatusHistory" h
      JOIN "Claim" c ON c.id = h."claimId"
      WHERE c."ingestedBy" = ${PIPELINE} AND c.deleted = false
      GROUP BY h."claimId"
      HAVING COUNT(*) > 1
    ) t`;
  console.log(`ofac_sdn_v1 claims with >1 history rows: ${multiRow[0].n} (8 expected from the pilot)`);

  console.log(`\nPer-entity detail (${RESIDUE_NAMES.length} terminal-none residues):`);
  for (const name of RESIDUE_NAMES) {
    const rows = await prisma.claim.findMany({
      where: { ingestedBy: PIPELINE, deleted: false, text: { contains: name, mode: "insensitive" } },
      select: {
        id: true,
        text: true,
        createdAt: true,
        claimEmergedAt: true,
        statusHistory: {
          orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
          select: { toAxis: true, occurredAt: true },
        },
      },
      take: 5,
    });
    console.log(`\n  "${name}" → ${rows.length} claim(s):`);
    for (const r of rows) {
      const nm = /^[^:]+:\s*(.*?)\s*\(OFAC SDN\)/.exec(r.text)?.[1] ?? r.text.slice(0, 60);
      console.log(
        `    ${r.id}  hist=${r.statusHistory.length}  terminal=${r.statusHistory[0]?.toAxis ?? "NONE"}` +
        `  emergedAt=${r.claimEmergedAt ? r.claimEmergedAt.toISOString().slice(0, 10) : "null"}` +
        `  createdAt=${r.createdAt.toISOString().slice(0, 10)}  ${nm}`,
      );
    }
  }
  console.log();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 2;
  })
  .finally(() => prisma.$disconnect());
