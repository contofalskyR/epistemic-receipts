// CPU and GPU specs from Wikidata SPARQL → EMPIRICAL HARD_FACT claims
// Classes: Q122967152 (CPU model), Q122760264 (graphics card model)
// Run: npx dotenv-cli -e .env.local -- npx tsx --tsconfig tsconfig.scripts.json scripts/ingest-chips-wikidata.ts --type cpu --limit 20 --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const SPARQL_ENDPOINT = 'https://query.wikidata.org/sparql'
const MAILTO = 'robert.contofalsky@rutgers.edu'
const INGESTED_BY = 'wikidata_chips_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SparqlBinding {
  value: string
  type: string
  datatype?: string
}

interface ChipRow {
  chip: SparqlBinding
  chipLabel?: SparqlBinding
  manufacturerLabel?: SparqlBinding
  released?: SparqlBinding
  cores?: SparqlBinding
  threads?: SparqlBinding
  tdp?: SparqlBinding
  clockAmt?: SparqlBinding
  clockUnit?: SparqlBinding
}

interface SparqlResult {
  results: { bindings: ChipRow[] }
}

type ChipType = 'cpu' | 'gpu'
type IngestResult = 'ingested' | 'skipped' | 'failed' | 'dry-run'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { type: ChipType | 'all'; limit: number; dryRun: boolean } {
  const args = process.argv.slice(2)
  const typeIdx  = args.indexOf('--type')
  const limitIdx = args.indexOf('--limit')
  const dryRun   = args.includes('--dry-run')
  const rawType  = typeIdx !== -1 ? (args[typeIdx + 1] ?? 'all') : 'all'
  const type     = ['cpu', 'gpu', 'all'].includes(rawType) ? rawType as ChipType | 'all' : 'all'
  const limit    = limitIdx !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { type, limit, dryRun }
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

// ── SPARQL fetch with retry (30s backoff on 429/503) ──────────────────────────

async function fetchSparql(query: string): Promise<ChipRow[]> {
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

// Wikidata clock speed units (P2149): Q3276763=GHz, Q39369=Hz, Q732707=MHz
function clockToGhz(amount: number | null, unitQid: string | null): number | null {
  if (amount === null || amount <= 0) return null
  switch (unitQid) {
    case 'Q3276763': return amount              // gigahertz — use as-is
    case 'Q39369':   return amount / 1e9        // hertz → GHz
    case 'Q732707':  return amount / 1e3        // megahertz → GHz
    default:
      // Unknown unit: heuristic — > 1e6 = Hz, > 10 = MHz, else GHz
      if (amount > 1e6) return amount / 1e9
      if (amount > 10)  return amount / 1e3
      return amount
  }
}

function formatClockGhz(ghz: number): string | null {
  if (ghz <= 0) return null
  if (ghz >= 1) {
    const rounded = Math.round(ghz * 10) / 10
    return `${rounded} GHz`
  }
  return `${Math.round(ghz * 1000)} MHz`
}

function parseDate(s: string | undefined): Date | null {
  if (!s) return null
  // Wikidata dates may have a leading '+' (e.g. +2017-01-01T00:00:00Z)
  const d = new Date(s.replace(/^\+/, ''))
  return isNaN(d.getTime()) ? null : d
}

// ── Claim text builder ────────────────────────────────────────────────────────

function buildClaimText(
  name: string,
  type: ChipType,
  manufacturer: string | null,
  released: Date | null,
  cores: number | null,
  threads: number | null,
  tdp: number | null,
  clockGhz: number | null,
): string {
  const typeWord = type === 'cpu' ? 'processor' : 'GPU'
  const parts: string[] = []

  // Core/thread count + type label
  let typeDesc = ''
  if (cores !== null) {
    typeDesc = threads !== null && type === 'cpu'
      ? `${cores}-core ${threads}-thread `
      : `${cores}-core `
  }
  typeDesc += typeWord
  parts.push(typeDesc)

  if (manufacturer) parts.push(`manufactured by ${manufacturer}`)
  if (released) parts.push(`released ${released.getFullYear()}`)
  if (tdp !== null && tdp > 0) parts.push(`${tdp}W TDP`)
  if (clockGhz !== null) {
    const cs = formatClockGhz(clockGhz)
    if (cs) parts.push(`${cs} base clock`)
  }

  // Minimal fallback when only the label is known
  if (parts.length === 1 && !manufacturer && !released) {
    const what = type === 'cpu' ? 'microprocessor' : 'graphics processor'
    return `${name}: ${what}`
  }

  return `${name}: ${parts.join(', ')}`
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

async function ensureChipTopics(type: ChipType): Promise<string[]> {
  const hw   = await ensureTopic('computer-hardware', 'Computer Hardware', 'technology')
  const semi = await ensureTopic('semiconductors',    'Semiconductors',    'technology', 'computer-hardware')
  const tech = await ensureTopic('technology',        'Technology',        'technology')
  const ids  = [hw, semi, tech]
  if (type === 'gpu') {
    const gfx = await ensureTopic('graphics', 'Graphics Processing', 'technology', 'computer-hardware')
    ids.push(gfx)
  }
  return ids
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

// ── Core: ingest one chip ─────────────────────────────────────────────────────

async function ingestChip(
  row: ChipRow,
  type: ChipType,
  topicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const qid = extractQid(row.chip.value)
  if (!qid) return 'skipped'

  const label = row.chipLabel?.value?.trim()
  if (!label || /^Q\d+$/.test(label)) return 'skipped'

  // Skip generic manufacturer labels that are QIDs (data quality issue)
  const rawMfr = row.manufacturerLabel?.value?.trim() ?? null
  const manufacturer = rawMfr && /^Q\d+$/.test(rawMfr) ? null : rawMfr

  const released   = parseDate(row.released?.value)
  const cores      = numVal(row.cores)
  const threads    = numVal(row.threads)
  const tdp        = numVal(row.tdp)
  const clockAmt   = numVal(row.clockAmt)
  const clockUnit  = row.clockUnit?.value?.split('/').pop() ?? null
  const clockGhz   = clockToGhz(clockAmt, clockUnit)

  const claimText   = buildClaimText(label, type, manufacturer, released, cores, threads, tdp, clockGhz)
  const claimExtId  = `wikidata_chips_v1_${qid}`
  const sourceExtId = `wikidata_chips_source_${qid}`
  const wikidataUrl = `https://www.wikidata.org/wiki/${qid}`

  if (dryRun) {
    console.log(`  [DRY-RUN] ${type.toUpperCase()} | ${qid} | ${claimText.slice(0, 110)}`)
    return 'dry-run'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId: claimExtId } })
  if (existing) return 'skipped'

  try {
    const source = await prisma.source.upsert({
      where:  { externalId: sourceExtId },
      create: {
        name: label,
        url: wikidataUrl,
        publishedAt: released,
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
          claimEmergedAt: released,
          claimEmergedPrecision: released ? 'YEAR' : null,
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: claimExtId,
          verificationStatus: 'VERIFIED',
          metadata: {
            dataset: INGESTED_BY,
            qid,
            type,
            domain: 'technology',
            label,
            manufacturer,
            tdp,
            clockGhz,
            cores,
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
          newScore: 100,
          reason: 'wikidata-chip-spec',
          changedAt: released ?? new Date(),
        },
      })

      return { claimId: claim.id }
    }, { timeout: 30000 })

    await tagClaim(claimId, topicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${qid} (${label}) — ${msg}`)
    return 'failed'
  }
}

// ── SPARQL queries ────────────────────────────────────────────────────────────
// Q122967152 = CPU model, Q122760264 = graphics card model
// P176=manufacturer, P577=publication/release date, P1141=processor cores,
// P7443=processor threads (CPU only), P2229=thermal design power (W),
// P2149=clock frequency with psv: to get amount + unit QID

const CPU_QUERY = `SELECT DISTINCT ?chip ?chipLabel ?manufacturerLabel ?released ?cores ?threads ?tdp ?clockAmt ?clockUnit WHERE {
  ?chip wdt:P31 wd:Q122967152 .
  OPTIONAL { ?chip wdt:P176 ?manufacturer }
  OPTIONAL { ?chip wdt:P577 ?released }
  OPTIONAL { ?chip wdt:P1141 ?cores }
  OPTIONAL { ?chip wdt:P7443 ?threads }
  OPTIONAL { ?chip wdt:P2229 ?tdp }
  OPTIONAL { ?chip p:P2149 [ psv:P2149 [ wikibase:quantityAmount ?clockAmt ; wikibase:quantityUnit ?clockUnit ] ] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language 'en' }
}
LIMIT 2000`

const GPU_QUERY = `SELECT DISTINCT ?chip ?chipLabel ?manufacturerLabel ?released ?cores ?tdp ?clockAmt ?clockUnit WHERE {
  ?chip wdt:P31 wd:Q122760264 .
  OPTIONAL { ?chip wdt:P176 ?manufacturer }
  OPTIONAL { ?chip wdt:P577 ?released }
  OPTIONAL { ?chip wdt:P1141 ?cores }
  OPTIONAL { ?chip wdt:P2229 ?tdp }
  OPTIONAL { ?chip p:P2149 [ psv:P2149 [ wikibase:quantityAmount ?clockAmt ; wikibase:quantityUnit ?clockUnit ] ] }
  SERVICE wikibase:label { bd:serviceParam wikibase:language 'en' }
}
LIMIT 2000`

// ── Run one chip type ─────────────────────────────────────────────────────────

async function runType(
  type: ChipType,
  limit: number,
  dryRun: boolean,
  counts: Counts,
): Promise<void> {
  console.log(`\n--- Fetching ${type.toUpperCase()} data from Wikidata SPARQL...`)
  const rows = await fetchSparql(type === 'cpu' ? CPU_QUERY : GPU_QUERY)
  console.log(`  Got ${rows.length} rows`)

  const topicIds = dryRun ? [] : await ensureChipTopics(type)

  // Deduplicate by QID — chips with multi-value P2149 generate multiple rows
  const seen = new Set<string>()

  for (const row of rows) {
    if (limit > 0 && counts.ingested >= limit) break

    const qid = extractQid(row.chip.value)
    if (!qid || seen.has(qid)) continue
    seen.add(qid)

    const result = await ingestChip(row, type, topicIds, dryRun)

    if (result === 'ingested' || result === 'dry-run') {
      counts.ingested++
    } else if (result === 'skipped') {
      counts.skipped++
    } else {
      counts.errors++
    }

    const total = counts.ingested + counts.skipped + counts.errors
    if (total % 50 === 0) {
      console.log(`  Progress: ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
  }

  console.log(`  ${type.toUpperCase()} done: ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { type, limit, dryRun } = parseArgs()
  console.log(`\n=== Wikidata Chips Ingestion — type: ${type}, limit: ${limit || 'all'}, dry-run: ${dryRun} ===\n`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  if (type === 'cpu' || type === 'all') {
    await runType('cpu', limit, dryRun, counts)
  }
  if (type === 'gpu' || type === 'all') {
    await runType('gpu', limit, dryRun, counts)
  }

  console.log(`\n=== Summary (${type}) ===`)
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
