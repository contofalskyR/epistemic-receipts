/**
 * One-time script: tag existing Topics with their matching AcademicField.
 *
 * Maps each Topic.domain to the closest AcademicField by slug matching.
 * Run manually after the link-topic-academic-field migration.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/tag-topics-academic-field.ts
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/tag-topics-academic-field.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.env.ALLOW_EDITS !== "true";

// Domain → ordered list of slug substrings to try (first match wins)
const DOMAIN_SLUG_CANDIDATES: Record<string, string[]> = {
  history:      ["history"],
  astronomy:    ["astronomy"],
  psychology:   ["psychology"],
  law:          ["law"],
  medicine:     ["medicine", "health-sciences", "health-science"],
  government:   ["political-science", "politics", "government"],
  public_health: ["public-health", "epidemiology"],
  archives:     ["history", "archival-science", "library-science"],
};

async function findField(candidates: string[]): Promise<{ id: number; name: string; slug: string } | null> {
  for (const fragment of candidates) {
    const field = await prisma.academicField.findFirst({
      where: { slug: { contains: fragment } },
      select: { id: true, name: true, slug: true },
    });
    if (field) return field;
  }
  return null;
}

async function main() {
  if (DRY_RUN) {
    console.log("DRY RUN — set ALLOW_EDITS=true to write changes");
  }

  const topics = await prisma.topic.findMany({
    select: { id: true, slug: true, domain: true, academicFieldId: true },
  });

  console.log(`Found ${topics.length} topics total`);

  const toTag = topics.filter(t => t.academicFieldId === null);
  console.log(`${toTag.length} topics without an academicFieldId`);

  // Resolve a field for each domain once
  const domainToField: Record<string, { id: number; name: string; slug: string } | null> = {};
  const domains = [...new Set(toTag.map(t => t.domain))];
  for (const domain of domains) {
    const candidates = DOMAIN_SLUG_CANDIDATES[domain] ?? [domain];
    domainToField[domain] = await findField(candidates);
    console.log(
      `  domain="${domain}" → field: ${domainToField[domain] ? domainToField[domain]!.slug : "NOT FOUND"}`
    );
  }

  let tagged = 0;
  let skipped = 0;

  for (const topic of toTag) {
    const field = domainToField[topic.domain];
    if (!field) {
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      await prisma.topic.update({
        where: { id: topic.id },
        data: { academicFieldId: field.id },
      });
    }
    tagged++;
  }

  console.log(`\nResult: ${tagged} topics tagged, ${skipped} skipped (no field match)`);
  if (DRY_RUN) console.log("(Dry run — no writes made)");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
