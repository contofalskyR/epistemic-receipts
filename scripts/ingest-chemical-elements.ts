// Chemical elements from Wikidata SPARQL → EMPIRICAL HARD_FACT claims
// Pipeline tag: wikidata_elements_v1 (complementary to the static
// `periodic_table_v1`, which seeds 118 elements from Bowserinator/IUPAC JSON).
// One claim per element, parented under the existing `chemistry` topic so the
// /chemistry taxonomy page's Live Research card surfaces these.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-chemical-elements.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-chemical-elements.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const MAILTO = 'robert.contofalsky@rutgers.edu'
const INGESTED_BY = 'wikidata_elements_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SparqlBinding {
  value: string
  type: string
  datatype?: string
}

interface ElementRow {
  element: SparqlBinding
  elementLabel?: SparqlBinding
  symbol?: SparqlBinding
  atomicNumber?: SparqlBinding
  atomicMass?: SparqlBinding
  categoryLabel?: SparqlBinding
  discoveryDate?: SparqlBinding
  discovererLabel?: SparqlBinding
}

interface SparqlResult {
  results: { bindings: ElementRow[] }
}

type IngestResult = 'ingested' | 'skipped' | 'failed' | 'dry-run'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean } {
  return { dryRun: process.argv.slice(2).includes('--dry-run') }
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

async function fetchSparql(query: string): Promise<ElementRow[]> {
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

function numVal(b: SparqlBinding | undefined): number | null {
  if (!b) return null
  const n = parseFloat(b.value)
  return isNaN(n) ? null : n
}

function intVal(b: SparqlBinding | undefined): number | null {
  if (!b) return null
  const n = parseInt(b.value, 10)
  return isNaN(n) ? null : n
}

function cleanLabel(s: string | undefined): string | null {
  if (!s) return null
  const trimmed = s.trim()
  if (!trimmed || /^Q\d+$/.test(trimmed)) return null
  return trimmed
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

function formatMass(m: number | null): string | null {
  if (m === null) return null
  if (m >= 100) return m.toFixed(2)
  if (m >= 10)  return m.toFixed(3)
  return m.toFixed(4)
}

// ── Claim text builder ────────────────────────────────────────────────────────

function buildClaimText(
  name: string,
  symbol: string | null,
  z: number | null,
  mass: number | null,
  category: string | null,
  discoveryYear: number | null,
  discoverer: string | null,
): string {
  const sym = symbol ? ` (${symbol})` : ''
  const parts: string[] = []

  const physBits: string[] = []
  if (z !== null) physBits.push(`atomic number ${z}`)
  const massStr = formatMass(mass)
  if (massStr) physBits.push(`atomic mass ${massStr} u`)
  if (physBits.length) parts.push(physBits.join(', '))

  if (category) parts.push(category.charAt(0).toUpperCase() + category.slice(1))

  const discBits: string[] = []
  if (discoveryYear !== null) discBits.push(`Discovered ${discoveryYear}`)
  if (discoverer) discBits.push(discBits.length ? `by ${discoverer}` : `Discovered by ${discoverer}`)
  if (discBits.length) parts.push(discBits.join(' '))

  return parts.length ? `${name}${sym}: ${parts.join('. ')}.` : `${name}${sym}: chemical element.`
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  // Prefer existing rows (chemistry is owned by the taxonomy page + OpenAlex bucket)
  const existing = await prisma.topic.findFirst({ where: { slug } })
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

async function ensureElementTopics(): Promise<string[]> {
  const academic  = await ensureTopic('academic-literature', 'Academic Literature', 'academic-literature')
  const chemistry = await ensureTopic('chemistry',           'Chemistry',           'academic-literature', 'academic-literature')
  return [chemistry, academic]
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

// ── Core: ingest one element row ──────────────────────────────────────────────

async function ingestElement(
  row: ElementRow,
  topicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const qid = extractQid(row.element.value)
  if (!qid) return 'skipped'

  const name = cleanLabel(row.elementLabel?.value)
  if (!name) return 'skipped'

  const symbol        = cleanLabel(row.symbol?.value)
  const z             = intVal(row.atomicNumber)
  const mass          = numVal(row.atomicMass)
  const category      = cleanLabel(row.categoryLabel?.value)
  const discoveryYear = parseYear(row.discoveryDate?.value)
  const discoveryDate = parseDate(row.discoveryDate?.value)
  const discoverer    = cleanLabel(row.discovererLabel?.value)

  const claimText   = buildClaimText(name, symbol, z, mass, category, discoveryYear, discoverer)
  const idKey       = z !== null ? `Z${z}` : qid
  const claimExtId  = `wikidata_elements_v1_${idKey}`
  const sourceExtId = `wikidata_elements_source_${idKey}`
  const wikidataUrl = `https://www.wikidata.org/wiki/${qid}`

  if (dryRun) {
    console.log(`  [DRY-RUN] Z=${z ?? '?'} | ${symbol ?? '??'} | ${claimText.slice(0, 130)}`)
    return 'dry-run'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId: claimExtId } })
  if (existing) return 'skipped'

  try {
    const source = await prisma.source.upsert({
      where:  { externalId: sourceExtId },
      create: {
        name: `Wikidata: ${name}${symbol ? ` (${symbol})` : ''}`,
        url: wikidataUrl,
        publishedAt: discoveryDate,
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
          claimType: 'EMPIRICAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: discoveryDate,
          claimEmergedPrecision: discoveryDate ? 'YEAR' : null,
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: claimExtId,
          verificationStatus: 'VERIFIED',
          metadata: {
            dataset: INGESTED_BY,
            qid,
            name,
            symbol,
            atomicNumber: z,
            atomicMass: mass,
            category,
            discoveryYear,
            discoverer,
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
          newScore: 90,
          reason: 'wikidata-element',
          changedAt: discoveryDate ?? new Date(),
        },
      })

      return { claimId: claim.id }
    }, { timeout: 30000 })

    await tagClaim(claimId, topicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${qid} (${name}) — ${msg}`)
    return 'failed'
  }
}

// ── SPARQL query ──────────────────────────────────────────────────────────────
// Q11344 = chemical element. P246 = chemical symbol, P1086 = atomic number,
// P2067 = mass (atomic), P575 = date of discovery / invention, P61 = discoverer
// or inventor. Category comes via subclass-of (P279) one step up.

// IUPAC currently recognizes elements 1–118 (oganesson is the heaviest
// confirmed). Wikidata also models predicted superheavies (Z ≥ 119) as
// instance-of Q11344; we exclude those with a FILTER so we get the 118
// canonical elements only.

const ELEMENTS_QUERY = `SELECT DISTINCT ?element ?elementLabel ?symbol ?atomicNumber ?atomicMass ?categoryLabel ?discoveryDate ?discovererLabel WHERE {
  ?element wdt:P31 wd:Q11344 .
  ?element wdt:P1086 ?atomicNumber .
  FILTER(?atomicNumber >= 1 && ?atomicNumber <= 118)
  OPTIONAL { ?element wdt:P246 ?symbol }
  OPTIONAL { ?element wdt:P2067 ?atomicMass }
  OPTIONAL { ?element wdt:P279 ?category }
  OPTIONAL { ?element wdt:P575 ?discoveryDate }
  OPTIONAL { ?element wdt:P61 ?discoverer }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language 'en' .
    ?element     rdfs:label ?elementLabel .
    ?category    rdfs:label ?categoryLabel .
    ?discoverer  rdfs:label ?discovererLabel .
  }
}
ORDER BY ?atomicNumber`

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun } = parseArgs()
  console.log(`\n=== Wikidata Chemical Elements Ingestion — dry-run: ${dryRun} ===\n`)

  const topicIds: string[] = dryRun ? [] : await ensureElementTopics()

  console.log('--- Fetching chemical elements from Wikidata SPARQL...')
  const rows = await fetchSparql(ELEMENTS_QUERY)
  console.log(`  Got ${rows.length} rows`)

  // Deduplicate by atomic number (Z) — preferred — or QID as fallback. Wikidata
  // rows multiply when category / discoverer / discovery-date have multi-values.
  // Keep the first hit for each Z so we get one claim per element.
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenZ = new Set<number>()
  const seenQ = new Set<string>()

  for (const row of rows) {
    const qid = extractQid(row.element.value)
    if (!qid) continue
    const z = intVal(row.atomicNumber)
    if (z !== null) {
      if (seenZ.has(z)) continue
      seenZ.add(z)
    } else {
      if (seenQ.has(qid)) continue
      seenQ.add(qid)
    }

    const result = await ingestElement(row, topicIds, dryRun)
    if (result === 'ingested' || result === 'dry-run') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++

    const total = counts.ingested + counts.skipped + counts.errors
    if (total % 30 === 0) {
      console.log(`  Progress: ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
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
