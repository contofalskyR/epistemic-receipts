/**
 * Guard: asserts every slug in lib/domain-trajectories.ts resolves to a live,
 * non-deprecated trajectory: claim in the DB. Fails with exit code 1 if any
 * slug is missing — catches typos or renamed trajectories before they ship a
 * broken rail.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/verify-domain-trajectories.ts
 */

import { PrismaClient } from "@prisma/client";
import { DOMAIN_TRAJECTORIES } from "../lib/domain-trajectories";

const prisma = new PrismaClient();

async function main() {
  const allSlugs = [
    ...new Set(Object.values(DOMAIN_TRAJECTORIES).flat()),
  ];
  const externalIds = allSlugs.map((s) => `trajectory:${s}`);

  const found = await prisma.claim.findMany({
    where: { externalId: { in: externalIds }, deleted: false },
    select: { externalId: true },
  });
  const foundSet = new Set(found.map((r) => r.externalId!.replace(/^trajectory:/, "")));

  let ok = true;
  for (const slug of allSlugs) {
    if (!foundSet.has(slug)) {
      console.error(`MISSING trajectory slug: "${slug}" — not in DB or deprecated`);
      ok = false;
    }
  }
  if (ok) {
    console.log(`✓ All ${allSlugs.length} domain trajectory slugs verified in DB`);
  } else {
    process.exit(1);
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
