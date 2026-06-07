// Nobel laureates from Wikidata SPARQL → INSTITUTIONAL HARD_FACT claims
// Pipeline tag: wikidata_nobel_v1 (distinct from `nobel_v1`, which sources the
// Nobel Foundation API). Wikidata adds rich biographical metadata (affiliation,
// field of work, country) and citizen-of links that the Foundation API lacks.
//
// One claim per laureate per prize (P166 = award received; instance-of Nobel
// Prize category). Deduplicates within a run by laureate QID + category QID +
// year so a person who won twice (Curie, Pauling, Bardeen, Sanger) gets one
// claim per prize.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-nobel-laureates.ts --dry-run --limit 5
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-nobel-laureates.ts --category physics --limit 50
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-nobel-laureates.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const MAILTO = 'robert.contofalsky@rutgers.edu'
const INGESTED_BY = 'wikidata_nobel_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SparqlBinding {
  value: string
  type: string
  datatype?: string
}

interface NobelRow {
  laureate: SparqlBinding
  laureateLabel?: SparqlBinding
  laureateDesc?: SparqlBinding
  prize: SparqlBinding
  prizeLabel?: SparqlBinding
  awardDate?: SparqlBinding
  affiliationLabel?: SparqlBinding
  fieldLabel?: SparqlBinding
  countryLabel?: SparqlBinding
}

interface SparqlResult {
  results: { bindings: NobelRow[] }
}

type Category = 'physics' | 'chemistry' | 'medicine' | 'literature' | 'peace' | 'economics' | 'all'
type IngestResult = 'ingested' | 'skipped' | 'failed' | 'dry-run'
type Counts = { ingested: number; skipped: number; errors: number }

// Wikidata QIDs for each Nobel Prize category
const PRIZE_QIDS: Record<Exclude<Category, 'all'>, string> = {
  physics:    'Q38104',   // Nobel Prize in Physics
  chemistry:  'Q44585',   // Nobel Prize in Chemistry
  medicine:   'Q80061',   // Nobel Prize in Physiology or Medicine
  literature: 'Q37922',   // Nobel Prize in Literature
  peace:      'Q35637',   // Nobel Peace Prize
  economics:  'Q47170',   // Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel
}

const CATEGORY_LABELS: Record<Exclude<Category, 'all'>, string> = {
  physics:    'Physics',
  chemistry:  'Chemistry',
  medicine:   'Physiology or Medicine',
  literature: 'Literature',
  peace:      'Peace',
  economics:  'Economic Sciences',
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { category: Category; limit: number; dryRun: boolean } {
  const args = process.argv.slice(2)
  const catIdx   = args.indexOf('--category')
  const limitIdx = args.indexOf('--limit')
  const dryRun   = args.includes('--dry-run')
  const rawCat   = catIdx !== -1 ? (args[catIdx + 1] ?? 'all') : 'all'
  const valid    = ['physics', 'chemistry', 'medicine', 'literature', 'peace', 'economics', 'all']
  const category = valid.includes(rawCat) ? (rawCat as Category) : 'all'
  const limit    = limitIdx !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { category, limit, dryRun }
}

// ── Rate limiting (2 req/sec — polite to Wikidata) ────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 500

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── SPARQL fetch with retry (exponential backoff on 429/503) ──────────────────

async function fetchSparql(query: string): Promise<NobelRow[]> {
  let delay = 2000
  for (let attempt = 0; attempt <= 3; attempt++) {
    await throttle()
    const url = new URL(SPARQL_ENDPOINT)
    url.searchParams.set('query', query)
    url.searchParams.set('format', 'json')

    let res: Response
    try {
      res = await fetch(url.toString(), {
        headers: {
          'Accept': 'application/sparql-results+json',
          'User-Agent': `epistemic-receipts/1.0 (mailto:${MAILTO})`,
        },
      })
    } catch (err) {
      if (attempt < 3) {
        console.warn(`  Network error — retrying in ${delay}ms`)
        await sleep(delay)
        delay = Math.min(delay * 2, 30000)
        continue
      }
      throw err
    }

    if ((res.status === 429 || res.status === 503) && attempt < 3) {
      const backoff = res.status === 429 ? 30000 : delay
      console.warn(`  HTTP ${res.status} — backing off ${backoff}ms`)
      await sleep(backoff)
      delay = Math.min(delay * 2, 30000)
      continue
    }

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`SPARQL ${res.status}: ${text.slice(0, 300)}`)
    }

    const data = await res.json() as SparqlResult
    return data.results.bindings
  }
  throw new Error('SPARQL fetch failed after retries')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractQid(uri: string): string | null {
  const m = uri.match(/\/entity\/(Q\d+)$/)
  return m ? m[1] : null
}

function parseYear(s: string | undefined): number | null {
  if (!s) return null
  const m = s.match(/^[+-]?(\d{1,4})-/)
  return m ? parseInt(m[1], 10) : null
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s.replace(/^\+/, ''))
  return isNaN(d.getTime()) ? null : d
}

function cleanLabel(s: string | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  if (!trimmed || /^Q\d+$/.test(trimmed)) return null
  return trimmed
}

function shortenDesc(desc: string, max = 140): string {
  if (desc.length <= max) return desc
  return desc.slice(0, max - 1).trimEnd() + '…'
}

// ── Claim text builder ────────────────────────────────────────────────────────

function buildClaimText(
  name: string,
  categoryLabel: string,
  year: number | null,
  affiliation: string | null,
  field: string | null,
  country: string | null,
  desc: string | null,
): string {
  const yearStr = year !== null ? ` (${year})` : ''
  const head = `${name}: Nobel Prize in ${categoryLabel}${yearStr}.`

  const tailParts: string[] = []
  if (desc) {
    const d = desc.replace(/\s+/g, ' ').trim()
    if (d) tailParts.push(shortenDesc(d.charAt(0).toUpperCase() + d.slice(1)))
  }

  const contextBits: string[] = []
  if (field) contextBits.push(field)
  if (affiliation) contextBits.push(`affiliated with ${affiliation}`)
  if (country) contextBits.push(country)

  if (contextBits.length && !desc) {
    tailParts.push(contextBits.join('; '))
  } else if (contextBits.length && desc) {
    tailParts.push(`Context: ${contextBits.join('; ')}.`)
  }

  return tailParts.length ? `${head} ${tailParts.join(' ')}` : head
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureNobelTopics(): Promise<string[]> {
  const academic = await ensureTopic('academic-literature', 'Academic Literature', 'academic-literature')
  const nobel    = await ensureTopic('nobel-prizes',        'Nobel Prizes',        'academic-literature', 'academic-literature')
  return [nobel, academic]
}

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where:  { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Core: ingest one laureate row ─────────────────────────────────────────────

async function ingestLaureate(
  row: NobelRow,
  categoryLabel: string,
  topicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const laureateQid = extractQid(row.laureate.value)
  const prizeQid    = extractQid(row.prize.value)
  if (!laureateQid || !prizeQid) return 'skipped'

  const name = cleanLabel(row.laureateLabel?.value)
  if (!name) return 'skipped'

  const year        = parseYear(row.awardDate?.value)
  const awardDate   = parseDate(row.awardDate?.value)
  const affiliation = cleanLabel(row.affiliationLabel?.value)
  const field       = cleanLabel(row.fieldLabel?.value)
  const country     = cleanLabel(row.countryLabel?.value)
  const desc        = cleanLabel(row.laureateDesc?.value)

  const claimText = buildClaimText(name, categoryLabel, year, affiliation, field, country, desc)

  // External IDs include the prize QID + year so multi-prize laureates get distinct rows
  const idSuffix    = `${laureateQid}_${prizeQid}${year !== null ? `_${year}` : ''}`
  const claimExtId  = `wikidata_nobel_v1_${idSuffix}`
  const sourceExtId = `wikidata_nobel_source_${idSuffix}`
  const wikidataUrl = `https://www.wikidata.org/wiki/${laureateQid}`

  if (dryRun) {
    console.log(`  [DRY-RUN] ${categoryLabel} | ${laureateQid} | ${claimText.slice(0, 130)}`)
    return 'dry-run'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId: claimExtId } })
  if (existing) return 'skipped'

  try {
    const source = await prisma.source.upsert({
      where:  { externalId: sourceExtId },
      create: {
        name: `Wikidata: ${name} (Nobel ${categoryLabel}${year !== null ? ` ${year}` : ''})`,
        url: wikidataUrl,
        publishedAt: awardDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        humanReviewed: false,
        autoApproved: true,
        externalId: sourceExtId,
      },
      update: {},
    })

    const { claimId } = await prisma.$transaction(async tx => {
      const claim = await tx.claim.create({
        data: {
          text: claimText,
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: awardDate,
          claimEmergedPrecision: awardDate ? 'YEAR' : null,
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: claimExtId,
          verificationStatus: 'VERIFIED',
          metadata: {
            dataset: INGESTED_BY,
            laureateQid,
            prizeQid,
            category: categoryLabel,
            year,
            name,
            affiliation,
            field,
            country,
          },
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId: source.id,
          claimId: claim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 80,
          reason: 'wikidata-nobel',
          changedAt: awardDate ?? new Date(),
        },
      })

      return { claimId: claim.id }
    }, { timeout: 30000 })

    await tagClaim(claimId, topicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${laureateQid} (${name}) — ${msg}`)
    return 'failed'
  }
}

// ── SPARQL query per Nobel category ───────────────────────────────────────────
// P166 = award received, P108 = employer (affiliation), P101 = field of work,
// P27  = country of citizenship. The award statement carries P585 (point in
// time) for the award year on most laureate records.

function buildQuery(prizeQid: string): string {
  return `SELECT DISTINCT ?laureate ?laureateLabel ?laureateDesc ?prize ?prizeLabel ?awardDate ?affiliationLabel ?fieldLabel ?countryLabel WHERE {
  VALUES ?prize { wd:${prizeQid} }
  ?laureate p:P166 ?awardStatement .
  ?awardStatement ps:P166 ?prize .
  OPTIONAL { ?awardStatement pq:P585 ?awardDate }
  OPTIONAL { ?laureate wdt:P108 ?affiliation }
  OPTIONAL { ?laureate wdt:P101 ?field }
  OPTIONAL { ?laureate wdt:P27 ?country }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language 'en' .
    ?laureate rdfs:label ?laureateLabel ;
              schema:description ?laureateDesc .
    ?prize        rdfs:label ?prizeLabel .
    ?affiliation  rdfs:label ?affiliationLabel .
    ?field        rdfs:label ?fieldLabel .
    ?country      rdfs:label ?countryLabel .
  }
}`
}

// ── Run one category ──────────────────────────────────────────────────────────

async function runCategory(
  cat: Exclude<Category, 'all'>,
  limit: number,
  dryRun: boolean,
  counts: Counts,
  globalSeen: Set<string>,
  topicIds: string[],
): Promise<void> {
  const label    = CATEGORY_LABELS[cat]
  const prizeQid = PRIZE_QIDS[cat]
  console.log(`\n--- Fetching Nobel ${label} (${prizeQid}) from Wikidata SPARQL...`)
  const rows = await fetchSparql(buildQuery(prizeQid))
  console.log(`  Got ${rows.length} rows`)

  // Deduplicate by laureate QID + prize QID + year — affiliation/field/country
  // multi-values cause cross-product expansion
  const seenThisCat = new Set<string>()

  for (const row of rows) {
    if (limit > 0 && counts.ingested >= limit) break

    const lqid = extractQid(row.laureate.value)
    if (!lqid) continue
    const year = parseYear(row.awardDate?.value)
    const key  = `${lqid}|${prizeQid}|${year ?? '?'}`
    if (seenThisCat.has(key) || globalSeen.has(key)) continue
    seenThisCat.add(key)
    globalSeen.add(key)

    const result = await ingestLaureate(row, label, topicIds, dryRun)
    if (result === 'ingested' || result === 'dry-run') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++

    const total = counts.ingested + counts.skipped + counts.errors
    if (total % 50 === 0) {
      console.log(`  Progress: ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
  }

  console.log(`  ${label} done: cat-unique=${seenThisCat.size} running ingested=${counts.ingested}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { category, limit, dryRun } = parseArgs()
  console.log(`\n=== Wikidata Nobel Laureates Ingestion — category: ${category}, limit: ${limit || 'all'}, dry-run: ${dryRun} ===\n`)

  const topicIds: string[] = dryRun ? [] : await ensureNobelTopics()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const globalSeen = new Set<string>()

  const cats: Exclude<Category, 'all'>[] = category === 'all'
    ? ['physics', 'chemistry', 'medicine', 'literature', 'peace', 'economics']
    : [category]

  for (const cat of cats) {
    await runCategory(cat, limit, dryRun, counts, globalSeen, topicIds)
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${counts.ingested}`)
  console.log(`  Skipped  : ${counts.skipped}`)
  console.log(`  Errors   : ${counts.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
