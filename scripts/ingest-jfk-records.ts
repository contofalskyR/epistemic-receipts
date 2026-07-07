// Pipeline 117 — JFK Assassination Records Collection (NARA)
// Dataset: National Archives Catalog API v2 — publicly accessible without a key.
//   NARA_API_KEY (x-api-key header) is optional: raises rate limits but is not required.
//   Request a read-only key by emailing Catalog_API@nara.gov.
// Scope: JFK Collection series (naId=2178409) — documents released under the President
//        John F. Kennedy Assassination Records Collection Act of 1992.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-jfk-records.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-jfk-records.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'jfk_records_v1'
// Correct endpoint per NARA Catalog API v2 swagger spec
const NARA_BASE = 'https://catalog.archives.gov/api/v2'
// JFK Collection parent series naId (President John F. Kennedy Assassination Records)
const JFK_ANCESTOR_NAID = '2178409'
const PAGE_SIZE = 50
let THROTTLE_MS = 300
const DRY_RUN_SAMPLE_COUNT = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface NaraProductionDate {
  logicalDate?: string
  year?: string | number
  month?: string | number
  day?: string | number
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface NaraItemDescription {
  title?: string
  scopeAndContentNote?: string
  generalNote?: string
  productionDateArray?: NaraProductionDate[]
  coverageDates?: string
  inclusiveDates?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface NaraRecord {
  naId?: string | number
  title?: string
  levelOfDescription?: string
  description?: {
    item?: NaraItemDescription
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface NaraHit {
  _id?: string | number
  _source?: NaraRecord
}

interface NaraSearchResponse {
  body?: {
    hits?: {
      total?: { value?: number } | number
      hits?: NaraHit[]
    }
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  naId: string
  externalId: string
  sourceUrl: string
  title: string
  date: Date | null
  datePrecision: string | null
  rawDate: string | null
  description: string | null
  claimText: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--limit N] [--verbose]')
    process.exit(1)
  }

  const mode = args.includes('--full') ? 'full' : 'dry-run'

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const li = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
    apiKey: process.env.NARA_API_KEY ?? null,
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function naraFetch(url: string, apiKey: string | null, retries = 3): Promise<NaraSearchResponse> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
    }
    if (apiKey) headers['x-api-key'] = apiKey
    const res = await fetch(url, { headers })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`NARA API ${res.status} at ${url}`)
    const body = await res.text()
    if (body.trim().startsWith('<')) {
      throw new Error(`NARA API returned HTML (not JSON) at ${url} — API key may be invalid or missing`)
    }
    return JSON.parse(body) as NaraSearchResponse
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Field extraction helpers ──────────────────────────────────────────────────

function extractTotal(resp: NaraSearchResponse): number {
  const total = resp.body?.hits?.total
  if (typeof total === 'number') return total
  if (typeof total === 'object' && total !== null) return total.value ?? 0
  return 0
}

function extractHits(resp: NaraSearchResponse): NaraHit[] {
  return resp.body?.hits?.hits ?? []
}

function extractNaId(hit: NaraHit): string | null {
  const src = hit._source
  if (!src) return null
  const raw = src.naId ?? hit._id
  if (!raw) return null
  return String(raw).trim() || null
}

function extractTitle(hit: NaraHit): string | null {
  const src = hit._source
  if (!src) return null
  const topLevel = src.title
  if (topLevel && typeof topLevel === 'string' && topLevel.trim()) return topLevel.trim()
  const itemTitle = src.description?.item?.title
  if (itemTitle && typeof itemTitle === 'string' && itemTitle.trim()) return itemTitle.trim()
  return null
}

function extractDescription(hit: NaraHit): string | null {
  const item = hit._source?.description?.item
  if (!item) return null
  const note = item.scopeAndContentNote ?? item.generalNote
  if (!note || typeof note !== 'string') return null
  return note.trim().slice(0, 2000) || null
}

function parseDate(raw: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }

  const fullMatch = raw.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (fullMatch) {
    const d = new Date(`${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
  }

  const monthMatch = raw.match(/^(\d{4})-(\d{2})/)
  if (monthMatch) {
    const d = new Date(`${monthMatch[1]}-${monthMatch[2]}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
  }

  const yearMatch = raw.match(/(\d{4})/)
  if (yearMatch) {
    const d = new Date(`${yearMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

function extractRawDate(hit: NaraHit): string | null {
  const item = hit._source?.description?.item
  if (!item) return null

  if (Array.isArray(item.productionDateArray) && item.productionDateArray.length > 0) {
    const first = item.productionDateArray[0]
    if (first.logicalDate) return String(first.logicalDate)
    if (first.year) return String(first.year)
  }

  for (const field of ['coverageDates', 'inclusiveDates']) {
    if (item[field] && typeof item[field] === 'string') return item[field]
  }

  return null
}

// ── Build candidate from API hit ──────────────────────────────────────────────

function buildCandidate(hit: NaraHit): CandidateRecord | null {
  const naId = extractNaId(hit)
  if (!naId) return null

  const title = extractTitle(hit)
  if (!title) return null

  const externalId = `jfk_${naId}`
  const sourceUrl = `https://catalog.archives.gov/id/${naId}`
  const rawDate = extractRawDate(hit)
  const { date, precision } = parseDate(rawDate)
  const description = extractDescription(hit)

  return {
    naId,
    externalId,
    sourceUrl,
    title,
    date,
    datePrecision: precision,
    rawDate,
    description,
    claimText: title,
  }
}

// ── Fetch pages ───────────────────────────────────────────────────────────────

function buildPageUrl(page: number): string {
  const params = new URLSearchParams({
    // Use ancestorNaId (v3) param equivalent via v2 search
    q: 'kennedy assassination',
    ancestorNaId: JFK_ANCESTOR_NAID,
    levelOfDescription: 'item',
    limit: String(PAGE_SIZE),
    page: String(page),
  })
  return `${NARA_BASE}/records/search?${params}`
}

async function fetchAllRecords(
  apiKey: string | null,
  maxRecords = 0,
): Promise<{ candidates: CandidateRecord[]; skippedMalformed: number; totalApi: number; rawFirstResp: NaraSearchResponse }> {
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  let totalApi = 0
  let rawFirstResp: NaraSearchResponse = {}
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const url = buildPageUrl(page)
    console.log(`  Fetching page ${page}/${totalPages} — ${url}`)

    const data = await naraFetch(url, apiKey)

    if (page === 1) {
      rawFirstResp = data
      totalApi = extractTotal(data)
      totalPages = totalApi > 0 ? Math.ceil(totalApi / PAGE_SIZE) : 1
      console.log(`  Total records from API: ${totalApi} | Total pages: ${totalPages}`)
    }

    const hits = extractHits(data)
    if (hits.length === 0) break

    for (const hit of hits) {
      const c = buildCandidate(hit)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (maxRecords > 0 && candidates.length >= maxRecords) break
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break
    page++
  }

  return { candidates, skippedMalformed, totalApi, rawFirstResp }
}

// ── Mock data for dry-run without API key ────────────────────────────────────
// Structural mock only — demonstrates expected response format.
// Run with NARA_API_KEY set to get real samples from the live catalog.

function buildMockCandidates(): CandidateRecord[] {
  const mocks = [
    { naId: 'MOCK-CIA-001', title: '[MOCK] CIA Report on Lee Harvey Oswald, 1963-11-22', rawDate: '1963-11-22', desc: 'Central Intelligence Agency report regarding Lee Harvey Oswald.' },
    { naId: 'MOCK-FBI-001', title: '[MOCK] FBI Teletype: Dallas Field Office, November 1963', rawDate: '1963-11', desc: 'FBI communication from Dallas field office following the assassination.' },
    { naId: 'MOCK-WC-001', title: '[MOCK] Warren Commission Exhibit CE-1', rawDate: '1964', desc: null },
    { naId: 'MOCK-NSA-001', title: '[MOCK] NSA Signal Intelligence Report, 1963', rawDate: '1963', desc: null },
    { naId: 'MOCK-DIA-001', title: '[MOCK] Defense Intelligence Agency File on Oswald', rawDate: '1964', desc: null },
    { naId: 'MOCK-SS-001', title: '[MOCK] Secret Service Protection Detail Report, November 1963', rawDate: '1963-11', desc: null },
    { naId: 'MOCK-WH-001', title: '[MOCK] White House Communication Regarding Dallas Trip', rawDate: '1963-11-21', desc: null },
    { naId: 'MOCK-FBI-002', title: '[MOCK] FBI Interview: Jack Ruby, December 1963', rawDate: '1963-12', desc: null },
    { naId: 'MOCK-CIA-002', title: '[MOCK] CIA Station Mexico City Cable RE: Oswald Visit', rawDate: '1963-10', desc: 'Relates to Oswald visit to Soviet and Cuban embassies in Mexico City.' },
    { naId: 'MOCK-DOJ-001', title: '[MOCK] Department of Justice Internal Memorandum on Investigation', rawDate: '1964-01', desc: null },
    { naId: 'MOCK-WC-002', title: '[MOCK] Warren Commission Staff Memorandum on Trajectory Analysis', rawDate: '1964', desc: null },
    { naId: 'MOCK-ARRB-001', title: '[MOCK] Assassination Records Review Board Staff Report', rawDate: '1996', desc: null },
    { naId: 'MOCK-CIA-003', title: '[MOCK] CIA Counterintelligence Staff Review 1975', rawDate: '1975', desc: null },
    { naId: 'MOCK-FBI-003', title: '[MOCK] FBI SOLO Reports Regarding Lee Harvey Oswald', rawDate: '1963', desc: null },
    { naId: 'MOCK-HSCA-001', title: '[MOCK] House Select Committee on Assassinations — Final Report Appendix', rawDate: '1979', desc: null },
    { naId: 'MOCK-CIA-004', title: '[MOCK] CIA Inspector General Report on Plots Against Castro', rawDate: '1967', desc: null },
    { naId: 'MOCK-STATE-001', title: '[MOCK] Department of State Passport File: Lee Harvey Oswald', rawDate: '1959', desc: null },
    { naId: 'MOCK-ONI-001', title: '[MOCK] Office of Naval Intelligence File on Oswald', rawDate: '1963', desc: null },
    { naId: 'MOCK-SS-002', title: '[MOCK] Secret Service After-Action Report: Dallas, 22 November 1963', rawDate: '1963-11', desc: null },
    { naId: 'MOCK-ARRB-002', title: '[MOCK] ARRB Interview: Former CIA Officer, 1996', rawDate: '1996', desc: null },
  ]

  return mocks.map(m => {
    const { date, precision } = parseDate(m.rawDate)
    return {
      naId: m.naId,
      externalId: `jfk_${m.naId}`,
      sourceUrl: `https://catalog.archives.gov/id/${m.naId}`,
      title: m.title,
      date,
      datePrecision: precision,
      rawDate: m.rawDate,
      description: m.desc,
      claimText: m.title,
    }
  })
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existingSource = await tx.source.findFirst({
    where: { url: rec.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  const existingClaim = await tx.claim.findUnique({
    where: { externalId: rec.externalId },
    select: { id: true },
  })
  if (existingClaim) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: rec.title.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `jfk_source_${rec.naId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.date ?? null,
      claimEmergedPrecision: rec.datePrecision ?? null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        naId: rec.naId,
        rawDate: rec.rawDate,
        description: rec.description,
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
      reason: 'JFK Assassination Records Collection — declassified government records, NARA, HARD_FACT',
      changedAt: rec.date ?? new Date(),
    },
  })

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose, apiKey } = parseArgs()

  if (apiKey) {
    THROTTLE_MS = 300
  } else {
    THROTTLE_MS = 1000
    console.warn('WARNING: NARA_API_KEY not set — running unauthenticated at 1000ms throttle. Rate limits will be slower.')
  }

  console.log(`\n── Pipeline 117: JFK Assassination Records Collection (NARA) ───────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | API key: ${apiKey ? 'set' : 'NOT SET (unauthenticated, 1000ms throttle)'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    let candidates: CandidateRecord[]
    let totalApi: number
    let skippedMalformed: number
     
    let rawFirstRespKeys: string[]
    let mockMode = false

    if (apiKey) {
      console.log('\nStep 1: Probing NARA API and sampling records (no DB writes)...')
      const result = await fetchAllRecords(apiKey, DRY_RUN_SAMPLE_COUNT)
      candidates = result.candidates
      totalApi = result.totalApi
      skippedMalformed = result.skippedMalformed
      rawFirstRespKeys = Object.keys(result.rawFirstResp)
    } else {
      console.log('\nStep 1: NARA_API_KEY not set — running mock dry-run to validate script structure.')
      console.log('  To get real samples: email Catalog_API@nara.gov for a read-only key, then set NARA_API_KEY.')
      candidates = buildMockCandidates()
      totalApi = 160000 // approx JFK collection size
      skippedMalformed = 0
      rawFirstRespKeys = ['body']
      mockMode = true
    }

    console.log(`\n  API total reported: ${mockMode ? `~${totalApi} (estimated)` : totalApi}`)
    console.log(`  Candidates fetched: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
    if (mockMode) console.log('  *** MOCK MODE — naIds are structural placeholders, not real catalog records ***')

    const sampleRecords = candidates.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const r of sampleRecords) {
      console.log(`  [${r.naId}] ${r.rawDate ?? 'no-date'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
      console.log(`    ${r.sourceUrl}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      apiBase: NARA_BASE,
      ancestorNaId: JFK_ANCESTOR_NAID,
      mockMode,
      mockModeNote: mockMode
        ? 'NARA_API_KEY not set. Re-run after setting the key to get real catalog samples before --full.'
        : null,
      totalFromApi: totalApi,
      candidatesFetched: candidates.length,
      skippedMalformed,
      rawFirstRespKeys,
      sample: sampleRecords.map(r => ({
        naId: r.naId,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        rawDate: r.rawDate,
        datePrecision: r.datePrecision,
        description: r.description?.slice(0, 200) ?? null,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-117-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-117-dry-run-sample.json')
    console.log('\nDry-run complete.')
    if (mockMode) {
      console.log('\nNEXT STEPS:')
      console.log('  1. Email Catalog_API@nara.gov to request a read-only NARA API key')
      console.log('  2. Add NARA_API_KEY=<key> to .env.local')
      console.log('  3. Re-run --dry-run to validate with real catalog records')
      console.log('  4. Run --full with ALLOW_EDITS=true when ready')
    } else {
      console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    }
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'jfk-assassination-records',
    'JFK Assassination Records',
    'history',
  )

  console.log('\nStep 2: Fetching records from NARA API...')
  const maxFetch = limit > 0 ? limit : 0
  const { candidates, skippedMalformed, totalApi } = await fetchAllRecords(apiKey, maxFetch)

  console.log(`\nTotal from API: ${totalApi}`)
  console.log(`Candidates: ${candidates.length} (malformed: ${skippedMalformed})`)

  console.log(`\nStep 3: Ingesting ${candidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, [rootTopicId]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 500 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.naId} — ${rec.title.slice(0, 60)}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${rec.externalId} — ${msg}`)
      counts.errors++
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB count (${dbClaims}) != ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
