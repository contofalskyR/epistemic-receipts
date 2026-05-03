// Seed the topic taxonomy across 6 domains.
// Domain-neutral: same schema handles "Constitutional Law → First Amendment"
// and "Psychology → Personality Psychology → Trait Models" identically.
// Run: npx tsx scripts/seed-topics.ts

import 'dotenv/config'
import { PrismaClient } from '../app/generated/prisma/client'

const prisma = new PrismaClient()

type TopicDef = {
  name: string
  slug: string
  domain: string
  description?: string
  children?: TopicDef[]
}

const TREE: TopicDef[] = [
  // ── Law ────────────────────────────────────────────────────────────────────
  {
    name: 'Supreme Court Ruling', slug: 'supreme-court-ruling', domain: 'law',
    description: 'U.S. Supreme Court decisions, regardless of subject matter.',
  },
  {
    name: 'Constitutional Law', slug: 'constitutional-law', domain: 'law',
    description: 'Legal claims concerning the interpretation and application of constitutional provisions',
    children: [
      { name: 'First Amendment',     slug: 'first-amendment',     domain: 'law' },
      {
        name: 'Fourteenth Amendment', slug: 'fourteenth-amendment', domain: 'law',
        children: [
          { name: 'Equal Protection', slug: 'equal-protection', domain: 'law' },
        ],
      },
      { name: 'Wartime Powers',  slug: 'wartime-powers',  domain: 'law' },
      { name: 'Judicial Review', slug: 'judicial-review', domain: 'law' },
    ],
  },
  {
    name: 'Drug Regulation', slug: 'drug-regulation', domain: 'law',
    description: 'Legal and regulatory frameworks governing pharmaceutical approval and control',
  },

  // ── Medicine ───────────────────────────────────────────────────────────────
  {
    name: 'Pharmacology', slug: 'pharmacology', domain: 'medicine',
    description: 'Claims about drug mechanisms, efficacy, and safety',
    children: [
      {
        name: 'Drug Approval', slug: 'drug-approval', domain: 'medicine',
        description: 'Claims about regulatory approval of pharmaceutical compounds',
      },
    ],
  },
  {
    name: 'Endocrinology', slug: 'endocrinology', domain: 'medicine',
    description: 'Claims about hormonal systems and metabolic disease',
    children: [
      { name: 'Diabetes Treatment', slug: 'diabetes-treatment', domain: 'medicine' },
    ],
  },
  {
    name: 'Pharmaceutical Industry Conduct', slug: 'pharmaceutical-industry-conduct', domain: 'medicine',
    description: 'Claims about how pharmaceutical and tobacco industry actors behave relative to scientific evidence',
  },

  // ── Public Health ──────────────────────────────────────────────────────────
  {
    name: 'Epidemiology', slug: 'epidemiology', domain: 'public_health',
    description: 'Claims about disease distribution, risk factors, and population-level health patterns',
  },
  {
    name: 'Tobacco Control', slug: 'tobacco-control', domain: 'public_health',
    description: 'Claims about tobacco health effects, industry conduct, and policy responses',
  },
  {
    name: 'Pandemic Origins', slug: 'pandemic-origins', domain: 'public_health',
    description: 'Claims about the source and emergence of pandemic pathogens',
  },

  // ── Psychology ─────────────────────────────────────────────────────────────
  {
    name: 'Personality Psychology', slug: 'personality-psychology', domain: 'psychology',
    description: 'Claims about personality structure, measurement, and stability',
    children: [
      { name: 'Trait Models',           slug: 'trait-models',            domain: 'psychology' },
      { name: 'Person-Situation Debate', slug: 'person-situation-debate', domain: 'psychology' },
    ],
  },
  {
    name: 'Philosophy of Mind', slug: 'philosophy-of-mind', domain: 'psychology',
    description: 'Claims at the intersection of cognitive science and philosophical inquiry',
  },

  // ── History ────────────────────────────────────────────────────────────────
  {
    name: 'World War II', slug: 'world-war-ii', domain: 'history',
    description: 'Claims about events, decisions, and consequences of the Second World War',
    children: [
      { name: 'Pacific Theater',   slug: 'pacific-theater',   domain: 'history' },
      { name: 'Atomic Bombings',   slug: 'atomic-bombings',   domain: 'history' },
    ],
  },

  // ── Astronomy ──────────────────────────────────────────────────────────────
  {
    name: 'Solar System', slug: 'solar-system', domain: 'astronomy',
    description: 'Claims about the structure, composition, and classification of solar system bodies',
    children: [
      { name: 'Planetary Classification', slug: 'planetary-classification', domain: 'astronomy' },
    ],
  },
]

async function upsertTopic(def: TopicDef, parentId?: string): Promise<string> {
  const topic = await prisma.topic.upsert({
    where: { slug: def.slug },
    update: { name: def.name, description: def.description ?? null, parentTopicId: parentId ?? null },
    create: {
      name:          def.name,
      slug:          def.slug,
      domain:        def.domain,
      description:   def.description ?? null,
      parentTopicId: parentId ?? null,
    },
  })
  if (def.children) {
    for (const child of def.children) {
      await upsertTopic(child, topic.id)
    }
  }
  return topic.id
}

async function main() {
  console.log('=== Topic Taxonomy Seed ===\n')
  let count = 0
  for (const root of TREE) {
    await upsertTopic(root)
    count++
    console.log(`  Seeded: ${root.domain} — ${root.name}`)
    if (root.children) {
      for (const c of root.children) {
        count++
        if (c.children) count += c.children.length
      }
    }
  }
  const total = await prisma.topic.count()
  console.log(`\nTotal topics in DB: ${total}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
