// Pipeline 115 — UK National Archives (Discovery API)
// Dataset: Catalogue Level-6 (Piece) records from the five high-value Whitehall departments
//   CAB  — Cabinet Papers
//   FCO  — Foreign & Commonwealth Office
//   PREM — Prime Minister's Office
//   HO   — Home Office
//   DEFE — Ministry of Defence
// API: https://discovery.nationalarchives.gov.uk/API/search/records
// Auth: none (fully open, no key required)
// Run: npx tsx scripts/ingest-uk-national-archives.ts --dry-run
//      npx tsx scripts/ingest-uk-national-archives.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'uk_national_archives_v1'
const API_BASE = 'https://discovery.nationalarchives.gov.uk/API/search/records'
const PAGE_SIZE = 50              // server caps actual return at ~15 regardless; we ask anyway
const THROTTLE_MS = 400
const DRY_RUN_SAMPLE = 50
const DEFAULT_TARGET = 5000
const HARD_CALL_CAP = 1200        // safety net on per-series loop iterations

// ── Curated priority series across the five departments ──────────────────────
// These are the historically-cited Cabinet/Foreign Office/PM/Home Office/Defence
// series whose individual pieces case studies routinely reference. Chosen so the
// 5,000-record target is reachable without sweeping every catalogue corner.
const PRIORITY_SERIES = [
  // Cabinet Papers
  'CAB 23',   // Cabinet Conclusions, 1916–1939
  'CAB 24',   // Cabinet Memoranda, 1915–1939
  'CAB 65',   // War Cabinet Conclusions, 1939–1945
  'CAB 66',   // War Cabinet Memoranda, 1939–1945
  'CAB 128',  // Cabinet Conclusions, 1945–present
  'CAB 129',  // Cabinet Memoranda, 1945–present
  'CAB 130',  // Ad-hoc Cabinet Committees
  'CAB 134',  // Cabinet Committees, post-1945
  'CAB 195',  // Cabinet Secretary's Notebooks
  // Prime Minister's Office
  'PREM 1',   // PM Files 1916–1940
  'PREM 4',   // PM Confidential Papers, 1934–1946
  'PREM 8',   // PM Files 1945–1951 (Attlee)
  'PREM 11',  // PM Files 1951–1964 (Churchill, Eden, Macmillan, Douglas-Home)
  'PREM 13',  // PM Files 1964–1970 (Wilson)
  'PREM 15',  // PM Files 1970–1974 (Heath)
  'PREM 16',  // PM Files 1974–1979 (Wilson, Callaghan)
  'PREM 19',  // PM Files 1979–1997 (Thatcher, Major)
  // Foreign & Commonwealth Office
  'FCO 7',    // American Department, 1967–
  'FCO 8',    // Arabian Department
  'FCO 9',    // Central & Southern African Department
  'FCO 12',   // Confidential Print, 20th century
  'FCO 17',   // Far Eastern Department
  'FCO 21',   // Hong Kong & Indian Ocean Department
  'FCO 28',   // Soviet & Eastern European Department
  'FCO 30',   // EEC/EU Department
  'FCO 33',   // Western European Department
  'FCO 41',   // Western & Southern African Department
  'FCO 73',   // Private Office papers
  // Home Office
  'HO 45',    // Registered Papers, 19th–20th century
  'HO 144',   // Registered Papers, Supplementary
  'HO 287',   // Police Department, post-1945
  'HO 325',   // Race Relations Files
  'HO 344',   // Immigration & Nationality
  // Defence (Ministry of Defence)
  'DEFE 4',   // Chiefs of Staff Committee minutes
  'DEFE 5',   // Chiefs of Staff Committee memoranda
  'DEFE 6',   // Joint Planning Staff reports
  'DEFE 7',   // Registered Files
  'DEFE 11',  // Chiefs of Staff Committee registered files
  'DEFE 13',  // Private Office files
  'DEFE 25',  // Chief of the Defence Staff
  'DEFE 31',  // Defence Operational Planning Staff
]

// ── Discovery API record shape ───────────────────────────────────────────────

interface DiscoveryRecord {
  id: string                  // Discovery node ID, e.g. "C4217418" — primary key for URL
  reference: string           // catalogue reference, e.g. "CAB 23/45"
  title: string
  description?: string
  coveringDates?: string      // free-text, e.g. "1937 July 14-Oct. 20"
  startDate?: string          // "DD/MM/YYYY" or empty
  endDate?: string
  numStartDate?: number       // YYYYMMDD or 0
  numEndDate?: number
  catalogueLevel?: number     // 6 = Piece (the level we filter to)
  heldBy?: string[]
  closureStatus?: string
  closureCode?: string
}

interface CandidateRecord {
  externalId: string
  discoveryId: string
  reference: string
  series: string
  department: string
  title: string
  description: string | null
  coveringDates: string | null
  startDate: Date | null
  startDatePrecision: 'DAY' | 'YEAR' | null
  startDateStr: string | null
  heldBy: string[]
  closureStatus: string | null
  sourceUrl: string
  claimText: string
}

function deptForSeries(series: string): string {
  const prefix = series.split(' ')[0]
  switch (prefix) {
    case 'CAB':  return 'Cabinet Office'
    case 'PREM': return "Prime Minister's Office"
    case 'FCO':  return 'Foreign & Commonwealth Office'
    case 'HO':   return 'Home Office'
    case 'DEFE': return 'Ministry of Defence'
    default:     return prefix
  }
}

// Discovery exposes startDate as "DD/MM/YYYY"; numStartDate as YYYYMMDD.
// Some records have only a year (e.g. "01/01/1972") — keep as Date but downgrade
// precision to YEAR so the UI doesn't claim a falsely-specific timestamp.
function parseStartDate(r: DiscoveryRecord): { date: Date | null; precision: 'DAY' | 'YEAR' | null; iso: string | null } {
  if (r.numStartDate && r.numStartDate > 18000000) {
    const s = String(r.numStartDate)                  // YYYYMMDD
    const y = s.slice(0, 4), m = s.slice(4, 6), d = s.slice(6, 8)
    const iso = `${y}-${m}-${d}`
    const dt = new Date(iso + 'T00:00:00Z')
    if (!isNaN(dt.getTime())) {
      // numStartDate often defaults to MMDD = 0101 when only a year is known.
      const precision = (m === '01' && d === '01') ? 'YEAR' : 'DAY'
      return { date: dt, precision, iso }
    }
  }
  if (r.startDate && /^\d{2}\/\d{2}\/\d{4}$/.test(r.startDate)) {
    const [d, m, y] = r.startDate.split('/')
    const iso = `${y}-${m}-${d}`
    const dt = new Date(iso + 'T00:00:00Z')
    if (!isNaN(dt.getTime())) return { date: dt, precision: 'DAY', iso }
  }
  return { date: null, precision: null, iso: null }
}

function buildCandidate(r: DiscoveryRecord, series: string): CandidateRecord | null {
  if (!r.id || !r.reference || !r.title) return null
  const title = r.title.trim()
  if (!title) return null

  const { date, precision, iso } = parseStartDate(r)
  const description = r.description?.trim() || null
  const coveringDates = r.coveringDates?.trim() || null
  const heldBy = Array.isArray(r.heldBy) ? r.heldBy.filter(Boolean) : []

  const sourceUrl = `https://discovery.nationalarchives.gov.uk/details/r/${encodeURIComponent(r.id)}`
  const externalId = `uk_nta_${r.id}`

  return {
    externalId,
    discoveryId: r.id,
    reference: r.reference.trim(),
    series,
    department: deptForSeries(series),
    title: title.slice(0, 500),
    description: description ? description.slice(0, 4000) : null,
    coveringDates,
    startDate: date,
    startDatePrecision: precision,
    startDateStr: iso,
    heldBy,
    closureStatus: r.closureStatus?.trim() || null,
    sourceUrl,
    claimText: title.slice(0, 500),
  }
}

// ── Prisma transaction client type ───────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--full') ? 'full' : 'dry-run'

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const li = args.indexOf('--limit')
  const explicitLimit = li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0
  return {
    mode: mode as 'dry-run' | 'full',
    limit: explicitLimit,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting ────────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP fetch ───────────────────────────────────────────────────────────────

function httpsGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (+research)', 'Accept': 'application/json' } }, res => {
      let body = ''
      res.on('data', (chunk: Buffer) => { body += chunk.toString('utf8') })
      res.on('end', () => resolve({ status: res.statusCode ?? 0, body }))
    })
    req.on('error', reject)
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const { status, body } = await httpsGet(url)
    if ([429, 500, 502, 503, 504].includes(status) && attempt < retries) {
      console.warn(`  HTTP ${status} — retrying in ${delay}ms`)
      await sleep(delay); delay *= 2; continue
    }
    if (status < 200 || status >= 300) throw new Error(`Discovery HTTP ${status} at ${url}`)
    try {
      return JSON.parse(body) as T
    } catch {
      throw new Error(`Discovery returned non-JSON body (status ${status}) at ${url}`)
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Discovery query builder ──────────────────────────────────────────────────
// Empirically: sps.batchSize is silently capped at ~15 by the server. Cursor
// pagination via sps.batchStartMark works only when an explicit sortByOption is
// set; TITLE_ASCENDING yields a stable, monotonically-advancing hex cursor.

function buildSearchUrl(series: string, cursor: string): string {
  const qs = new URLSearchParams()
  qs.set('sps.references', series)              // partial-string match on reference; e.g. "CAB 23" → CAB 23/*
  qs.set('sps.heldByCode', 'TNA')               // restrict to The National Archives, Kew (drops NRA/other holders)
  qs.set('sps.catalogueLevels', 'Level6')        // Piece-level records (individual files/documents)
  qs.set('sps.sortByOption', 'TITLE_ASCENDING') // required for working batchStartMark cursor
  qs.set('sps.batchStartMark', cursor)
  qs.set('sps.batchSize', String(PAGE_SIZE))
  return `${API_BASE}?${qs.toString()}`
}

interface DiscoveryResponse {
  records: DiscoveryRecord[]
  count: number
  nextBatchMark: string
}

async function fetchSeriesPage(series: string, cursor: string): Promise<DiscoveryResponse> {
  const url = buildSearchUrl(series, cursor)
  return fetchJson<DiscoveryResponse>(url)
}

// Paginate one series until exhausted or per-series cap reached.
async function* iterateSeries(series: string, perSeriesCap: number, verbose: boolean): AsyncGenerator<CandidateRecord> {
  let cursor = '*'
  let calls = 0
  let yielded = 0
  let total = -1
  const seenCursors = new Set<string>()

  while (yielded < perSeriesCap && calls < HARD_CALL_CAP) {
    calls++
    const resp = await fetchSeriesPage(series, cursor)
    if (total === -1) total = resp.count
    if (verbose) console.log(`    [${series}] call ${calls}: ${resp.records.length} records (cursor=${cursor.slice(0, 24)})`)

    if (!resp.records || resp.records.length === 0) break

    for (const raw of resp.records) {
      const cand = buildCandidate(raw, series)
      if (cand) {
        yielded++
        yield cand
        if (yielded >= perSeriesCap) break
      }
    }

    const next = resp.nextBatchMark?.trim() ?? ''
    // Stop on: empty cursor, repeated cursor (server stuck), or exhausted result set.
    if (!next || seenCursors.has(next)) break
    seenCursors.add(next)
    cursor = next
  }

  if (verbose) console.log(`    [${series}] done — ${yielded} records yielded, ${calls} API calls, count(total)=${total}`)
}

// ── Topic management ─────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}${parentTopicId ? ` (parent: ${parentSlug})` : ''}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureUkTopic(): Promise<string> {
  // Brief: parent under 'Government Documents' if it exists, else top-level.
  const parent = await prisma.topic.findUnique({ where: { slug: 'government-documents' } })
  return ensureTopic(
    'uk-national-archives',
    'UK National Archives',
    'government',
    parent ? 'government-documents' : undefined,
  )
}

// ── Write one record ─────────────────────────────────────────────────────────

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<'ingested' | 'skipped'> {
  // Dedup primarily on externalId (Discovery ID is stable); url is also unique
  // per record but we check it as well to be safe.
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId } })
  if (existing) return 'skipped'
  const existingSource = await tx.source.findFirst({ where: { url: rec.sourceUrl } })
  if (existingSource) return 'skipped'

  const sourceName = `TNA Discovery — ${rec.reference}`
  const source = await tx.source.create({
    data: {
      name: sourceName.slice(0, 300),
      url: rec.sourceUrl,
      publishedAt: rec.startDate ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `uk_nta_source_${rec.discoveryId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      claimEmergedAt: rec.startDate ?? null,
      claimEmergedPrecision: rec.startDatePrecision ?? null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        discoveryId: rec.discoveryId,
        reference: rec.reference,
        series: rec.series,
        department: rec.department,
        description: rec.description,
        coveringDates: rec.coveringDates,
        startDate: rec.startDateStr,
        heldBy: rec.heldBy,
        closureStatus: rec.closureStatus,
        originalArchive: 'The National Archives, Kew (TNA)',
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'PROCEDURAL',
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
      reason: 'TNA Discovery catalogue record — UK National Archives Piece-level entry, PROVISIONAL pending content review',
      changedAt: rec.startDate ?? new Date(),
    },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()
  const target = mode === 'full' ? (limit > 0 ? limit : DEFAULT_TARGET) : DRY_RUN_SAMPLE

  console.log(`\n── Pipeline 115: UK National Archives Discovery (${INGESTED_BY}) ──`)
  console.log(`Mode: ${mode} | Target: ${target} records | Series: ${PRIORITY_SERIES.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log(`\nFetching up to ${target} sample records (no DB writes)...`)
    const samples: CandidateRecord[] = []
    const perSeriesCap = Math.max(2, Math.ceil(target / Math.min(PRIORITY_SERIES.length, 10)))
    let seriesCount = 0
    const seriesStats: Array<{ series: string; yielded: number }> = []

    for (const series of PRIORITY_SERIES) {
      if (samples.length >= target) break
      seriesCount++
      const before = samples.length
      for await (const rec of iterateSeries(series, perSeriesCap, verbose)) {
        samples.push(rec)
        if (samples.length >= target) break
      }
      seriesStats.push({ series, yielded: samples.length - before })
      if (verbose) console.log(`  Cumulative: ${samples.length}/${target}`)
    }

    const sample = samples.slice(0, DRY_RUN_SAMPLE).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      reference: r.reference,
      series: r.series,
      department: r.department,
      coveringDates: r.coveringDates,
      startDate: r.startDateStr,
      startDatePrecision: r.startDatePrecision,
      heldBy: r.heldBy,
      closureStatus: r.closureStatus,
      description: r.description?.slice(0, 200) ?? null,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'PROVISIONAL',
      humanReviewed: false,
      autoApproved: true,
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: INGESTED_BY,
      mode: 'dry-run',
      apiUrl: API_BASE,
      apiAuth: 'none (open public API)',
      seriesQueried: seriesCount,
      seriesPlanned: PRIORITY_SERIES.length,
      sampleRecords: sample.length,
      candidatesScanned: samples.length,
      seriesStats,
      sample,
    }
    fs.writeFileSync('pipeline-115-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log(`\n  Scanned ${samples.length} candidate records across ${seriesCount} series`)
    console.log(`  Sample (${sample.length} records) written to pipeline-115-dry-run-sample.json`)
    console.log(`\nDry-run complete.`)
    console.log(`\nSTOP — awaiting explicit go-ahead from Robert before full run.`)
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const topicId = await ensureUkTopic()
  console.log(`  uk-national-archives topic ID: ${topicId}`)

  console.log('\nStep 2: Fetching + ingesting from TNA Discovery...')
  const startTime = Date.now()
  let ingested = 0, skipped = 0, errors = 0

  const perSeriesCap = Math.ceil(target / PRIORITY_SERIES.length) * 4 // soft per-series limit; rebalanced if a series is short

  outer: for (const series of PRIORITY_SERIES) {
    if (ingested + skipped >= target) break
    console.log(`\n  → Series ${series} (${deptForSeries(series)})`)
    let seriesIngested = 0
    for await (const rec of iterateSeries(series, perSeriesCap, verbose)) {
      if (ingested + skipped >= target) break outer
      try {
        const result = await prisma.$transaction(
          (tx) => writeRow(tx, rec, topicId),
          { timeout: 30000 },
        )
        if (result === 'ingested') { ingested++; seriesIngested++ }
        else skipped++
        if (verbose || ingested % 100 === 0) {
          console.log(`    [${result}] ${rec.reference} — ${rec.title.slice(0, 60)}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`    Failed: ${rec.externalId} — ${msg}`)
        errors++
      }
    }
    console.log(`    Series ${series}: ingested ${seriesIngested}`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${ingested} | Skipped: ${skipped} | Errors: ${errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims  = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges   = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (dbClaims !== ingested) {
    console.error(`  WARNING: DB claim count (${dbClaims}) ≠ ingested counter (${ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
