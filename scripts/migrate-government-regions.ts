// One-time migration: group government/legislature topics under regional parent topics.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/migrate-government-regions.ts
// Safe to re-run (upserts regions, skips topics already wired).

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const REGIONS = [
  { slug: 'gov-region-europe',        name: 'Europe',        domain: 'government' },
  { slug: 'gov-region-americas',      name: 'Americas',      domain: 'government' },
  { slug: 'gov-region-asia-pacific',  name: 'Asia-Pacific',  domain: 'government' },
  { slug: 'gov-region-africa',        name: 'Africa',        domain: 'government' },
  { slug: 'gov-region-international', name: 'International', domain: 'government' },
]

// slug → region slug
const ASSIGNMENTS: Record<string, string> = {
  // Europe
  'at-nationalrat':           'gov-region-europe',
  'be-dekamer':               'gov-region-europe',
  'ch-fedlex':                'gov-region-europe',
  'de-bundestag':             'gov-region-europe',
  'dk-folketing':             'gov-region-europe',
  'eec-council-legislation':  'gov-region-europe',
  'es-boe':                   'gov-region-europe',
  'eu-legislation':           'gov-region-europe',
  'fi-eduskunta':             'gov-region-europe',
  'fr-parlement':             'gov-region-europe',
  'ie-oireachtas':            'gov-region-europe',
  'is-althingi':              'gov-region-europe',
  'it-parlamento':            'gov-region-europe',
  'nl-tweedekamer':           'gov-region-europe',
  'no-storting':              'gov-region-europe',
  'pl-sejm':                  'gov-region-europe',
  'pt-assembleia':            'gov-region-europe',
  'ru-gosduma':               'gov-region-europe',
  'se-riksdag':               'gov-region-europe',
  'uk-parliament':            'gov-region-europe',

  // Americas
  'ar-congreso':                       'gov-region-americas',
  'br-congresso':                      'gov-region-americas',
  'ca-parliament':                     'gov-region-americas',
  'cl-congreso':                       'gov-region-americas',
  'co-congreso':                       'gov-region-americas',
  'congress-enacted-bills':            'gov-region-americas',
  'congress-roll-call-votes':          'gov-region-americas',
  'federal-register-significant-rules':'gov-region-americas',
  'mx-congreso':                       'gov-region-americas',

  // Asia-Pacific
  'au-parliament':       'gov-region-asia-pacific',
  'bd-parliament':       'gov-region-asia-pacific',
  'in-parliament':       'gov-region-asia-pacific',
  'jp-kokkai':           'gov-region-asia-pacific',
  'nz-parliament':       'gov-region-asia-pacific',
  'ph-congress':         'gov-region-asia-pacific',
  'sg-statutes':         'gov-region-asia-pacific',
  'tw-legislative-yuan': 'gov-region-asia-pacific',

  // Africa
  'za-parliament': 'gov-region-africa',

  // International
  'nato-official-texts': 'gov-region-international',
}

async function main() {
  console.log('Upserting regional parent topics...')

  const regionIds: Record<string, string> = {}
  for (const r of REGIONS) {
    const topic = await prisma.topic.upsert({
      where: { slug: r.slug },
      update: {},
      create: { slug: r.slug, name: r.name, domain: r.domain },
    })
    regionIds[r.slug] = topic.id
    console.log(`  ${r.name}: ${topic.id}`)
  }

  console.log('\nAssigning country topics to regions...')
  let updated = 0, skipped = 0, missing = 0

  for (const [slug, regionSlug] of Object.entries(ASSIGNMENTS)) {
    const topic = await prisma.topic.findUnique({ where: { slug } })
    if (!topic) {
      console.log(`  MISSING: ${slug}`)
      missing++
      continue
    }
    if (topic.parentTopicId === regionIds[regionSlug]) {
      skipped++
      continue
    }
    await prisma.topic.update({
      where: { id: topic.id },
      data: { parentTopicId: regionIds[regionSlug] },
    })
    console.log(`  ${topic.name} → ${regionSlug.replace('gov-region-', '')}`)
    updated++
  }

  console.log(`\nDone. Updated: ${updated}, Already correct: ${skipped}, Missing slugs: ${missing}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
