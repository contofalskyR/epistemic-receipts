// Significant space missions from Wikidata SPARQL → INSTITUTIONAL HARD_FACT claims
// Pipeline tag: wikidata_space_missions_v1 (distinct from `space_missions_v1`,
// which sources Jonathan McDowell's GCAT launch log). Wikidata rows carry
// agency, destination, and country-of-origin labels that bulk launch logs lack.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-space-missions-wikidata.ts --dry-run --limit 10
//   npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-space-missions-wikidata.ts --limit 500

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const MAILTO = 'robert.contofalsky@rutgers.edu'
const INGESTED_BY = 'wikidata_space_missions_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SparqlBinding {
  value: string
  type: string
  datatype?: string
}

interface MissionRow {
  mission: SparqlBinding
  missionLabel?: SparqlBinding
  missionDesc?: SparqlBinding
  operatorLabel?: SparqlBinding
  launchDate?: SparqlBinding
  destinationLabel?: SparqlBinding
  countryLabel?: SparqlBinding
}

interface SparqlResult {
  results: { bindings: MissionRow[] }
}

type IngestResult = 'ingested' | 'skipped' | 'failed' | 'dry-run'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { limit: number; dryRun: boolean } {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const dryRun   = args.includes('--dry-run')
  const limit    = limitIdx !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { limit, dryRun }
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

async function fetchSparql(query: string): Promise<MissionRow[]> {
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

    if ((res.status === 429 || res.status === 502 || res.status === 503) && attempt < 3) {
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

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  const d = new Date(s.replace(/^\+/, ''))
  return isNaN(d.getTime()) ? null : d
}

function formatDate(d: Date | null): string | null {
  if (!d) return null
  // YYYY-MM-DD, or just YYYY if month/day default to Jan 1 (Wikidata precision YEAR convention)
  const iso = d.toISOString().slice(0, 10)
  if (iso.endsWith('-01-01')) return iso.slice(0, 4)
  return iso
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
  operator: string | null,
  launchStr: string | null,
  destination: string | null,
  country: string | null,
  desc: string | null,
): string {
  const parts: string[] = []

  if (operator && launchStr) {
    parts.push(`${operator} mission launched ${launchStr}`)
  } else if (operator) {
    parts.push(`${operator} mission`)
  } else if (launchStr) {
    parts.push(`Launched ${launchStr}`)
  } else if (country) {
    parts.push(`${country} space mission`)
  }

  const objBits: string[] = []
  if (destination) objBits.push(`Destination: ${destination}`)
  if (country && operator && !operator.toLowerCase().includes(country.toLowerCase())) {
    objBits.push(country)
  }
  if (objBits.length) parts.push(objBits.join('; '))

  if (desc) {
    const d = desc.replace(/\s+/g, ' ').trim()
    if (d) parts.push(shortenDesc(d.charAt(0).toUpperCase() + d.slice(1)))
  }

  return parts.length ? `${name}: ${parts.join('. ')}.` : `${name}: space mission.`
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

async function ensureMissionTopics(): Promise<string[]> {
  const academic = await ensureTopic('academic-literature', 'Academic Literature', 'academic-literature')
  const space    = await ensureTopic('space-exploration',   'Space Exploration',   'academic-literature', 'academic-literature')
  return [space, academic]
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

// ── Core: ingest one mission row ──────────────────────────────────────────────

async function ingestMission(
  row: MissionRow,
  topicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const qid = extractQid(row.mission.value)
  if (!qid) return 'skipped'

  const name = cleanLabel(row.missionLabel?.value)
  if (!name) return 'skipped'

  const operator    = cleanLabel(row.operatorLabel?.value)
  const launchDate  = parseDate(row.launchDate?.value)
  const launchStr   = formatDate(launchDate)
  const destination = cleanLabel(row.destinationLabel?.value)
  const country     = cleanLabel(row.countryLabel?.value)
  const desc        = cleanLabel(row.missionDesc?.value)

  const claimText   = buildClaimText(name, operator, launchStr, destination, country, desc)
  const claimExtId  = `wikidata_space_missions_v1_${qid}`
  const sourceExtId = `wikidata_space_missions_source_${qid}`
  const wikidataUrl = `https://www.wikidata.org/wiki/${qid}`

  if (dryRun) {
    console.log(`  [DRY-RUN] ${qid} | ${claimText.slice(0, 130)}`)
    return 'dry-run'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId: claimExtId } })
  if (existing) return 'skipped'

  try {
    const source = await prisma.source.upsert({
      where:  { externalId: sourceExtId },
      create: {
        name: `Wikidata: ${name}${operator ? ` (${operator})` : ''}`,
        url: wikidataUrl,
        publishedAt: launchDate,
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
          claimEmergedAt: launchDate,
          claimEmergedPrecision: launchDate ? 'DAY' : null,
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: claimExtId,
          verificationStatus: 'VERIFIED',
          metadata: {
            dataset: INGESTED_BY,
            qid,
            name,
            operator,
            destination,
            country,
            launchDate: launchStr,
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
          newScore: 75,
          reason: 'wikidata-space-mission',
          changedAt: launchDate ?? new Date(),
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
// Q2133344 = space mission, Q5916 = crewed spaceflight, Q26540 = space probe,
// Q752783 = human spaceflight, Q26529 = space telescope, Q40218 = artificial
// satellite parent (excluded to keep the run focused on missions, not every
// minor satellite). P619 = orbital launch date — requiring it filters out
// proposed/cancelled items and prioritizes flown missions. P137 = operator,
// P840 = narrative location (destination), P17 = country.

const MISSION_CLASSES = [
  'Q2133344', // space mission
  'Q5916',    // crewed spaceflight
  'Q26540',   // space probe
  'Q752783',  // human spaceflight
  'Q26529',   // space telescope
  'Q14513900',// robotic space mission
  'Q1378150', // Mars mission
  'Q3079846', // lunar probe / lunar mission
  'Q628176',  // space exploration mission
].map(q => `wd:${q}`).join(' ')

// Direct instance-of (no transitive subclass — Wikidata query service 502s on
// the full closure). The class list is broad enough to cover crewed and
// robotic interplanetary missions modeled at the top level.

const MISSIONS_QUERY = `SELECT DISTINCT ?mission ?missionLabel ?missionDesc ?operatorLabel ?launchDate ?destinationLabel ?countryLabel WHERE {
  VALUES ?class { ${MISSION_CLASSES} }
  ?mission wdt:P31 ?class .
  ?mission wdt:P619 ?launchDate .
  OPTIONAL { ?mission wdt:P137 ?operator }
  OPTIONAL { ?mission wdt:P840 ?destination }
  OPTIONAL { ?mission wdt:P17 ?country }
  SERVICE wikibase:label {
    bd:serviceParam wikibase:language 'en' .
    ?mission     rdfs:label ?missionLabel ;
                 schema:description ?missionDesc .
    ?operator    rdfs:label ?operatorLabel .
    ?destination rdfs:label ?destinationLabel .
    ?country     rdfs:label ?countryLabel .
  }
}
ORDER BY ?launchDate`

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { limit, dryRun } = parseArgs()
  console.log(`\n=== Wikidata Space Missions Ingestion — limit: ${limit || 'all'}, dry-run: ${dryRun} ===\n`)

  const topicIds: string[] = dryRun ? [] : await ensureMissionTopics()

  console.log('--- Fetching space missions from Wikidata SPARQL...')
  const rows = await fetchSparql(MISSIONS_QUERY)
  console.log(`  Got ${rows.length} rows`)

  // Deduplicate by mission QID — multi-value operator/destination/country
  // produce cross-product rows
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seen = new Set<string>()

  for (const row of rows) {
    if (limit > 0 && counts.ingested >= limit) break

    const qid = extractQid(row.mission.value)
    if (!qid || seen.has(qid)) continue
    seen.add(qid)

    const result = await ingestMission(row, topicIds, dryRun)
    if (result === 'ingested' || result === 'dry-run') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++

    const total = counts.ingested + counts.skipped + counts.errors
    if (total % 50 === 0) {
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
