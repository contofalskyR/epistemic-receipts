// Historical Event Graph Phase 3 — wires HistoricalEvent rows to LegislativeVote and Polity.
//
// Match rules (faithful to the brief — "countryCode match OR topic keyword match"):
//  - LegislativeVote: voteDate in [startYear-01-01, endYear-12-31] AND
//      (dataSource maps to a country in event's country set
//       OR vote's topics array intersects event's topicKeywords
//       OR vote's Source.name contains any title keyword)
//  - Polity: countryCode (alpha-3) in event's polity set AND
//      year ranges overlap (NULL startYear/endYear treated as open)
//
// Run: ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/link-historical-events.ts
//      (add --dry-run to preview without writes)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PIPELINE_COUNTRY } from '../lib/globe-pipeline-country'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')
const ALLOW_EDITS = process.env.ALLOW_EDITS === 'true'

// voteview_v1 isn't in PIPELINE_COUNTRY (it's a Voteview corpus, not a country
// ingester per se), but every roll call is US Congress. Augment locally.
const VOTE_DATASOURCE_COUNTRY: Record<string, string> = {
  ...PIPELINE_COUNTRY,
  voteview_v1: 'US',
  uk_parliament: 'GB',
  'uk-parliament': 'GB',
  openparliament: 'CA',
  howtheyvote_eu: 'EU',
}

interface EventConfig {
  voteCountryCodes: string[]                         // alpha-2 (matches LV dataSource)
  topicKeywords: string[]                            // matched against LV.topics JSON array
  titleKeywords: string[]                            // ILIKE against Source.name
  polities: { code: string; role: string }[]         // alpha-3 used by Polity.countryCode
}

const CONFIG: Record<string, EventConfig> = {
  'cuban-missile-crisis': {
    voteCountryCodes: ['US'],
    topicKeywords: ['defense', 'military', 'foreign_policy', 'war'],
    titleKeywords: ['cuba', 'missile', 'soviet'],
    polities: [
      { code: 'USA', role: 'primary' },
      { code: 'CUB', role: 'primary' },
      { code: 'SUN', role: 'adversary' },
    ],
  },
  'church-committee': {
    voteCountryCodes: ['US'],
    topicKeywords: ['judiciary', 'defense', 'foreign_policy', 'civil_rights', 'military'],
    titleKeywords: ['intelligence', 'cia', 'fbi', 'nsa', 'surveillance', 'church committee'],
    polities: [{ code: 'USA', role: 'primary' }],
  },
  'jfk-assassination': {
    voteCountryCodes: ['US'],
    topicKeywords: ['judiciary', 'defense'],
    titleKeywords: ['kennedy', 'assassination', 'warren commission'],
    polities: [{ code: 'USA', role: 'primary' }],
  },
  'vietnam-war': {
    voteCountryCodes: ['US'],
    topicKeywords: ['defense', 'military', 'foreign_policy', 'war', 'appropriations'],
    titleKeywords: ['vietnam', 'southeast asia', 'cambodia', 'tonkin', 'indochina', 'laos'],
    polities: [
      { code: 'USA', role: 'primary' },
      { code: 'VNM', role: 'involved' },
    ],
  },
  'cold-war': {
    voteCountryCodes: ['US'],
    topicKeywords: ['defense', 'military', 'foreign_policy', 'war', 'tariff_trade', 'civil_rights'],
    titleKeywords: ['soviet', 'communist', 'iron curtain', 'nato', 'warsaw pact', 'arms control', 'détente'],
    polities: [
      { code: 'USA', role: 'primary' },
      { code: 'SUN', role: 'adversary' },
      { code: 'DDR', role: 'involved' },
    ],
  },
  'cointelpro': {
    voteCountryCodes: ['US'],
    topicKeywords: ['civil_rights', 'judiciary', 'defense'],
    titleKeywords: ['fbi', 'surveillance', 'civil rights', 'counterintelligence'],
    polities: [{ code: 'USA', role: 'primary' }],
  },
  'world-war-ii': {
    voteCountryCodes: ['US'],
    topicKeywords: ['defense', 'military', 'foreign_policy', 'war', 'appropriations'],
    titleKeywords: ['war', 'lend-lease', 'pearl harbor', 'declaration of war', 'manhattan project'],
    polities: [
      { code: 'USA', role: 'primary' },
      { code: 'DEU', role: 'adversary' },
      { code: 'JPN', role: 'adversary' },
      { code: 'GBR', role: 'involved' },
      { code: 'SUN', role: 'involved' },
      { code: 'ITA', role: 'adversary' },
      { code: 'FRA', role: 'involved' },
      { code: 'CHN', role: 'involved' },
    ],
  },
  'korean-war': {
    voteCountryCodes: ['US'],
    topicKeywords: ['defense', 'military', 'foreign_policy', 'war', 'appropriations'],
    titleKeywords: ['korea', 'korean', 'far east', 'mac arthur'],
    polities: [
      { code: 'USA', role: 'primary' },
      { code: 'KOR', role: 'involved' },
      { code: 'PRK', role: 'adversary' },
      { code: 'CHN', role: 'adversary' },
    ],
  },
  'bay-of-pigs': {
    voteCountryCodes: ['US'],
    topicKeywords: ['defense', 'military', 'foreign_policy'],
    titleKeywords: ['cuba', 'cuban', 'bay of pigs', 'playa girón'],
    polities: [
      { code: 'USA', role: 'primary' },
      { code: 'CUB', role: 'adversary' },
    ],
  },
}

function parseTopics(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.map((x) => String(x)) : []
  } catch {
    return []
  }
}

async function linkVotesForEvent(event: { id: string; slug: string; startDate: Date | null; endDate: Date | null }, cfg: EventConfig) {
  if (!event.startDate || !event.endDate) {
    console.log(`  [skip] ${event.slug}: missing startDate/endDate`)
    return { inserted: 0, skipped: 0, total: 0 }
  }
  const startYear = event.startDate.getUTCFullYear()
  const endYear = event.endDate.getUTCFullYear()
  const winStart = new Date(Date.UTC(startYear, 0, 1))
  const winEnd = new Date(Date.UTC(endYear, 11, 31, 23, 59, 59))

  // Pull candidate votes once, then partition by match path in JS. Includes
  // Source.name for title-keyword matching.
  const votes = await prisma.legislativeVote.findMany({
    where: { voteDate: { gte: winStart, lte: winEnd } },
    select: { id: true, dataSource: true, topics: true, source: { select: { name: true } } },
  })

  // Existing links — fetch once per event to make this idempotent.
  const existing = new Set(
    (await prisma.historicalEventVote.findMany({ where: { eventId: event.id }, select: { voteId: true } })).map(
      (r) => r.voteId,
    ),
  )

  const titleKeywordsLc = cfg.titleKeywords.map((k) => k.toLowerCase())
  const topicKeywordsSet = new Set(cfg.topicKeywords)
  const countryCodeSet = new Set(cfg.voteCountryCodes)

  const toInsert: { eventId: string; voteId: string; matchReason: string }[] = []
  let countryHits = 0
  let topicHits = 0
  let titleHits = 0

  for (const v of votes) {
    if (existing.has(v.id)) continue
    const reasons: string[] = []

    const ds = v.dataSource ?? ''
    const country = VOTE_DATASOURCE_COUNTRY[ds]
    if (country && countryCodeSet.has(country)) {
      reasons.push(`country:${country}`)
      countryHits++
    }

    const topics = parseTopics(v.topics)
    const matchedTopic = topics.find((t) => topicKeywordsSet.has(t))
    if (matchedTopic) {
      reasons.push(`topic:${matchedTopic}`)
      topicHits++
    }

    if (titleKeywordsLc.length > 0) {
      const titleLc = (v.source?.name ?? '').toLowerCase()
      const matchedTitle = titleKeywordsLc.find((k) => titleLc.includes(k))
      if (matchedTitle) {
        reasons.push(`title:${matchedTitle}`)
        titleHits++
      }
    }

    if (reasons.length === 0) continue
    toInsert.push({ eventId: event.id, voteId: v.id, matchReason: reasons.join(',') })
  }

  let inserted = 0
  if (toInsert.length > 0 && !DRY_RUN && ALLOW_EDITS) {
    const BATCH = 1000
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH)
      const r = await prisma.historicalEventVote.createMany({ data: chunk, skipDuplicates: true })
      inserted += r.count
    }
  }

  console.log(
    `  ${event.slug}: votes_in_window=${votes.length} new=${toInsert.length} (country=${countryHits} topic=${topicHits} title=${titleHits}) inserted=${inserted} preexisting=${existing.size}`,
  )
  return { inserted, skipped: existing.size, total: toInsert.length + existing.size }
}

async function linkPolitiesForEvent(event: { id: string; slug: string; startDate: Date | null; endDate: Date | null }, cfg: EventConfig) {
  if (cfg.polities.length === 0) return { inserted: 0, skipped: 0, total: 0 }
  const startYear = event.startDate?.getUTCFullYear() ?? null
  const endYear = event.endDate?.getUTCFullYear() ?? null

  const candidates = await prisma.polity.findMany({
    where: { countryCode: { in: cfg.polities.map((p) => p.code) } },
    select: { id: true, name: true, countryCode: true, startYear: true, endYear: true },
  })

  const existing = new Set(
    (await prisma.historicalEventPolity.findMany({ where: { eventId: event.id }, select: { polityId: true } })).map(
      (r) => r.polityId,
    ),
  )

  const roleByCode = new Map(cfg.polities.map((p) => [p.code, p.role] as const))
  const toInsert: { eventId: string; polityId: string; role: string }[] = []
  for (const p of candidates) {
    if (existing.has(p.id)) continue
    // Overlap: treat NULL as open-ended. If both ends are known on the polity,
    // require [pStart, pEnd] ∩ [eStart, eEnd] ≠ ∅.
    if (startYear != null && endYear != null) {
      const pStart = p.startYear ?? -100000
      const pEnd = p.endYear ?? 100000
      if (pEnd < startYear || pStart > endYear) continue
    }
    const role = roleByCode.get(p.countryCode ?? '') ?? 'involved'
    toInsert.push({ eventId: event.id, polityId: p.id, role })
  }

  let inserted = 0
  if (toInsert.length > 0 && !DRY_RUN && ALLOW_EDITS) {
    const r = await prisma.historicalEventPolity.createMany({ data: toInsert, skipDuplicates: true })
    inserted = r.count
  }

  console.log(
    `  ${event.slug}: polity_candidates=${candidates.length} new=${toInsert.length} inserted=${inserted} preexisting=${existing.size}`,
  )
  return { inserted, skipped: existing.size, total: toInsert.length + existing.size }
}

async function main() {
  if (!DRY_RUN && !ALLOW_EDITS) {
    console.error('Refusing to write: set ALLOW_EDITS=true or pass --dry-run')
    process.exit(2)
  }

  const events = await prisma.historicalEvent.findMany({ orderBy: { startDate: 'asc' } })
  console.log(`Found ${events.length} HistoricalEvents`)
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'WRITE'}`)

  console.log('\n── Votes ──')
  let totalVotesInserted = 0
  for (const ev of events) {
    const cfg = CONFIG[ev.slug]
    if (!cfg) {
      console.log(`  [skip] ${ev.slug}: no config`)
      continue
    }
    const r = await linkVotesForEvent(ev, cfg)
    totalVotesInserted += r.inserted
  }

  console.log('\n── Polities ──')
  let totalPolitiesInserted = 0
  for (const ev of events) {
    const cfg = CONFIG[ev.slug]
    if (!cfg) continue
    const r = await linkPolitiesForEvent(ev, cfg)
    totalPolitiesInserted += r.inserted
  }

  // DB-side verification per CLAUDE rule 6.
  const finalVoteCount = await prisma.historicalEventVote.count()
  const finalPolityCount = await prisma.historicalEventPolity.count()
  console.log('\n── Summary ──')
  console.log(`inserted vote links this run: ${totalVotesInserted}`)
  console.log(`inserted polity links this run: ${totalPolitiesInserted}`)
  console.log(`total HistoricalEventVote rows: ${finalVoteCount}`)
  console.log(`total HistoricalEventPolity rows: ${finalPolityCount}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
