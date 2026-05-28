// Link NARA claims to historical events via keyword pattern matching
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/link-nara-to-events.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const INGESTED_BY = 'nara_catalog_v1'

interface EventPattern {
  slug: string
  keywords: RegExp
}

const EVENT_PATTERNS: EventPattern[] = [
  {
    slug: 'cuban-missile-crisis',
    keywords: /\bcuba[n]?\b|\bmissile crisis\b/i,
  },
  {
    slug: 'church-committee',
    keywords: /\bchurch\s+committee\b|\bselect\s+committee.*intelligence\b|\bintelligence\s+activities\b/i,
  },
  {
    slug: 'jfk-assassination',
    keywords: /\bjfk\b|\bkennedy\s+assassination\b|\bassassination.*kennedy\b|\bjohn\s+f\.?\s+kennedy\b|\barrb\b|\bassassination\s+records\b/i,
  },
  {
    slug: 'vietnam-war',
    keywords: /\bvietnam\b|\bviet\s*cong\b|\bsaigon\b|\bviet\s*nam\b/i,
  },
  {
    slug: 'cold-war',
    keywords: /\bcold\s+war\b|\bsoviet\b|\bussr\b|\bkgb\b|\bnato\b|\bnuclear\b|\bcontainment\b|\bcommunis[mt]\b/i,
  },
  {
    slug: 'cointelpro',
    keywords: /\bcointelpro\b|\bcounterinte[l]?ligence\s+program\b/i,
  },
  {
    slug: 'world-war-ii',
    keywords: /\bworld\s+war\s+i{2}\b|\bwwii\b|\bww2\b|\bnazi\b|\bpacific\s+(theater|war|front)\b|\bnormandy\b|\bhiroshima\b|\batomic\s+bomb\b/i,
  },
  {
    slug: 'korean-war',
    keywords: /\bkorea[n]?\b|\binchon\b|\bpusan\b|\bchosin\b/i,
  },
  {
    slug: 'bay-of-pigs',
    keywords: /\bbay\s+of\s+pigs\b|\bcuba\s+invasion\b|\bbrigade\s+2506\b|\bplaya\s+giron\b/i,
  },
]

async function main() {
  console.log('Loading historical events...')
  const events = await prisma.historicalEvent.findMany()
  const eventBySlug = new Map(events.map(e => [e.slug, e]))

  for (const ep of EVENT_PATTERNS) {
    if (!eventBySlug.has(ep.slug)) {
      console.error(`  Missing event slug: ${ep.slug} — run seed-historical-events.ts first`)
      process.exit(1)
    }
  }
  console.log(`  ${events.length} events loaded`)

  console.log('\nQuerying NARA claims...')
  const claims = await prisma.claim.findMany({
    where: {
      ingestedBy: INGESTED_BY,
      deleted: false,
    },
    select: { id: true, text: true },
  })
  console.log(`  ${claims.length} NARA claims found`)

  const summary: Record<string, number> = {}
  for (const ep of EVENT_PATTERNS) summary[ep.slug] = 0

  let linked = 0
  let skipped = 0

  for (const claim of claims) {
    for (const ep of EVENT_PATTERNS) {
      if (!ep.keywords.test(claim.text)) continue
      const event = eventBySlug.get(ep.slug)!
      try {
        await prisma.claimHistoricalEvent.upsert({
          where: { claimId_historicalEventId: { claimId: claim.id, historicalEventId: event.id } },
          update: {},
          create: { claimId: claim.id, historicalEventId: event.id },
        })
        summary[ep.slug]++
        linked++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed to link ${claim.id} → ${ep.slug}: ${msg}`)
        skipped++
      }
    }
  }

  console.log('\nLink summary:')
  for (const ep of EVENT_PATTERNS) {
    const event = eventBySlug.get(ep.slug)!
    console.log(`  ${event.name}: ${summary[ep.slug]} claims linked`)
  }
  console.log(`\nTotal: ${linked} links created, ${skipped} errors`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
