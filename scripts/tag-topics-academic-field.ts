/**
 * Tag Topics with their matching AcademicField.
 *
 * Maps each Topic.domain to a level-1 AcademicField slug.
 * Idempotent — only writes for topics where academicFieldId is null.
 *
 * Usage:
 *   npx dotenv-cli -e .env.local -- npx tsx scripts/tag-topics-academic-field.ts
 *   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/tag-topics-academic-field.ts
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DRY_RUN = process.env.ALLOW_EDITS !== "true";

// domain → level-1 AcademicField slug (single source of truth for DB-level tagging)
const DOMAIN_TO_FIELD_SLUG: Record<string, string> = {
  "academic-literature":  "social-science--interdisciplinary-studies",
  "archives":             "humanities--history",
  "astronomy":            "natural-science--physical-science",
  "chemistry":            "natural-science--physical-science",
  "clinical-trials":      "applied-science--medicine-and-health",
  "culture":              "humanities--languages-and-literature",
  "defense":              "applied-science--military-sciences",
  "diplomacy":            "social-science--political-science",
  "economics":            "social-science--economics",
  "environment":          "applied-science--environmental-studies-and-forestry",
  "genetics":             "natural-science--life-science",
  "geology":              "natural-science--physical-science",
  "government":           "social-science--political-science",
  "history":              "humanities--history",
  "institutional":        "social-science--political-science",
  "intelligence":         "applied-science--military-sciences",
  "international":        "social-science--political-science",
  "labor":                "social-science--economics",
  "law":                  "humanities--law",
  "legislation":          "social-science--political-science",
  "medicine":             "applied-science--medicine-and-health",
  "physics":              "natural-science--physical-science",
  "politics":             "social-science--political-science",
  "psychology":           "social-science--psychology",
  "public_health":        "applied-science--medicine-and-health",
  "public-health":        "applied-science--medicine-and-health",
  "research-funding":     "social-science--interdisciplinary-studies",
  "science":              "natural-science--physical-science",
  "scientific-integrity": "social-science--interdisciplinary-studies",
  "technology":           "applied-science--engineering-and-technology",
};

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

  // Resolve each known domain → field id (one query per unique slug)
  const usedDomains = [...new Set(toTag.map(t => t.domain))];
  const fieldIdByDomain: Record<string, number | null> = {};
  for (const domain of usedDomains) {
    const slug = DOMAIN_TO_FIELD_SLUG[domain];
    if (!slug) {
      fieldIdByDomain[domain] = null;
      console.log(`  domain="${domain}" → NO MAPPING (skip)`);
      continue;
    }
    const field = await prisma.academicField.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!field) {
      fieldIdByDomain[domain] = null;
      console.log(`  domain="${domain}" → slug "${slug}" NOT FOUND in AcademicField (skip)`);
      continue;
    }
    fieldIdByDomain[domain] = field.id;
    console.log(`  domain="${domain}" → ${slug} (id=${field.id})`);
  }

  let tagged = 0;
  let skipped = 0;
  for (const topic of toTag) {
    const fieldId = fieldIdByDomain[topic.domain];
    if (fieldId == null) {
      skipped++;
      continue;
    }
    if (!DRY_RUN) {
      await prisma.topic.update({
        where: { id: topic.id },
        data: { academicFieldId: fieldId },
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
