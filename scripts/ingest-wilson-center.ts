// Pipeline 110 — Wilson Center Digital Archive
// Dataset: digitalarchive.wilsoncenter.org/api/v1 — no auth required.
// Scope: Translated Soviet, Eastern European, Chinese, Cuban, Vietnamese declassified documents.
// Key collections: Cold War International History Project (CWIHP), NPIHP, NEHP, etc.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-wilson-center.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-wilson-center.ts --full [--collection <name>] [--country <name>]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'wilson_center_v1'
const WILSON_BASE = 'https://digitalarchive.wilsoncenter.org/api/v1'
const PAGE_SIZE = 50
const THROTTLE_MS = 400
const DRY_RUN_SAMPLE_COUNT = 50

// ── Types ─────────────────────────────────────────────────────────────────────

// Defensive: API may return strings or nested objects for collection/countries/subjects
interface WilsonNamedEntity {
  id?: number | string
  name?: string
  title?: string
}

interface WilsonRecord {
  id?: number | string
  title?: string
  date?: string | null
  date_range?: string | null
  description?: string | null
  // 'source' = the originating archive (not Wilson Center itself)
  source?: string | WilsonNamedEntity | null
  source_archive?: string | null
  repository?: string | null
  collection?: string | WilsonNamedEntity | null
  subjects?: Array<string | WilsonNamedEntity> | null
  countries?: Array<string | WilsonNamedEntity> | null
  coverage?: Array<string | WilsonNamedEntity> | null
  original_language?: string | WilsonNamedEntity | null
  language?: string | WilsonNamedEntity | null
  classification?: string | null
  original_classification?: string | null
  translation_status?: string | null
  slug?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface WilsonPage {
  total?: number
  count?: number
  total_count?: number
  page?: number
  limit?: number
  pages?: number
  total_pages?: number
  per_page?: number
  records?: WilsonRecord[]
  results?: WilsonRecord[]
  data?: WilsonRecord[]
  items?: WilsonRecord[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  wilsonId: string
  externalId: string
  sourceUrl: string
  title: string
  date: Date | null
  datePrecision: string | null
  rawDate: string | null
  description: string | null
  collection: string | null
  originalArchive: string | null
  originalLanguage: string | null
  originalClassification: string | null
  translationStatus: string | null
  countries: string[]
  subjects: string[]
  claimText: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--collection <name>] [--country <name>] [--limit N] [--verbose]')
    process.exit(1)
  }

  const mode = args.includes('--full') ? 'full' : 'dry-run'

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const ci = args.indexOf('--collection')
  const coi = args.indexOf('--country')
  const li = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'full',
    collection: ci !== -1 ? (args[ci + 1] ?? null) : null,
    country: coi !== -1 ? (args[coi + 1] ?? null) : null,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
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

async function wilsonFetch(url: string, retries = 3): Promise<WilsonPage> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`Wilson Center API ${res.status} at ${url}`)
    return res.json() as Promise<WilsonPage>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Field extraction helpers ──────────────────────────────────────────────────

function extractName(val: string | WilsonNamedEntity | null | undefined): string | null {
  if (!val) return null
  if (typeof val === 'string') return val.trim() || null
  return val.name?.trim() || val.title?.trim() || null
}

function extractNames(arr: Array<string | WilsonNamedEntity> | null | undefined): string[] {
  if (!arr || !Array.isArray(arr)) return []
  return arr.map(x => extractName(x)).filter((x): x is string => x !== null)
}

function extractRecords(page: WilsonPage): WilsonRecord[] {
  return page.records ?? page.results ?? page.data ?? page.items ?? []
}

function extractTotal(page: WilsonPage): number {
  return page.total ?? page.total_count ?? page.count ?? 0
}

function extractTotalPages(page: WilsonPage, perPage: number): number {
  if (page.total_pages ?? page.pages) return page.total_pages ?? page.pages ?? 1
  const total = extractTotal(page)
  return total > 0 ? Math.ceil(total / perPage) : 1
}

function parseDate(raw: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }

  // Try YYYY-MM-DD
  const fullMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (fullMatch) {
    const d = new Date(`${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
  }

  // Try YYYY-MM
  const monthMatch = raw.match(/^(\d{4})-(\d{2})/)
  if (monthMatch) {
    const d = new Date(`${monthMatch[1]}-${monthMatch[2]}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
  }

  // Try YYYY
  const yearMatch = raw.match(/^(\d{4})/)
  if (yearMatch) {
    const d = new Date(`${yearMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

// ── Build candidate from API record ──────────────────────────────────────────

function buildCandidate(rec: WilsonRecord): CandidateRecord | null {
  const rawId = rec.id
  if (!rawId) return null
  const wilsonId = String(rawId)

  const title = rec.title?.trim()
  if (!title) return null

  const sourceUrl = `https://digitalarchive.wilsoncenter.org/document/${wilsonId}`
  const externalId = `wilson_center_${wilsonId}`

  const rawDate = rec.date ?? rec.date_range ?? null
  const { date, precision } = parseDate(rawDate)

  // original archive: field may be 'source', 'source_archive', or 'repository'
  const originalArchive =
    extractName(rec.source as string | WilsonNamedEntity | null) ??
    (rec.source_archive ? String(rec.source_archive).trim() : null) ??
    (rec.repository ? String(rec.repository).trim() : null)

  const collection = extractName(rec.collection as string | WilsonNamedEntity | null)

  const originalLanguage =
    extractName(rec.original_language as string | WilsonNamedEntity | null) ??
    extractName(rec.language as string | WilsonNamedEntity | null)

  const originalClassification =
    (rec.classification ? String(rec.classification).trim() : null) ??
    (rec.original_classification ? String(rec.original_classification).trim() : null)

  const translationStatus = rec.translation_status ? String(rec.translation_status).trim() : null

  const countries = extractNames(
    (rec.countries ?? rec.coverage) as Array<string | WilsonNamedEntity> | null
  )

  const subjects = extractNames(rec.subjects as Array<string | WilsonNamedEntity> | null)

  const description = rec.description ? String(rec.description).trim().slice(0, 2000) : null

  // Build claim text
  const parts: string[] = []
  if (collection) parts.push(collection)
  if (originalArchive) parts.push(`originally from ${originalArchive}`)
  if (rawDate) parts.push(`dated ${rawDate}`)
  const suffix = parts.length > 0 ? ` — ${parts.join(', ')}` : ''
  const claimText = `"${title}"${suffix}`

  return {
    wilsonId,
    externalId,
    sourceUrl,
    title,
    date,
    datePrecision: precision,
    rawDate,
    description,
    collection,
    originalArchive,
    originalLanguage,
    originalClassification,
    translationStatus,
    countries,
    subjects,
    claimText,
  }
}

// ── Fetch pages ───────────────────────────────────────────────────────────────

function buildPageUrl(page: number, collection: string | null, country: string | null): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_SIZE),
    sort: 'date',
  })
  if (collection) params.set('collection', collection)
  if (country) params.set('country', country)
  return `${WILSON_BASE}/records?${params}`
}

async function fetchAllRecords(
  collection: string | null,
  country: string | null,
  maxRecords = 0,
): Promise<{ candidates: CandidateRecord[]; skippedMalformed: number; totalApi: number; rawFirstPage: WilsonPage }> {
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  let totalApi = 0
  let totalPages = 1
  let rawFirstPage: WilsonPage = {}

  for (let page = 1; page <= totalPages; page++) {
    const url = buildPageUrl(page, collection, country)
    console.log(`  Fetching page ${page}/${totalPages === 1 && page === 1 ? '?' : totalPages} — ${url}`)

    const data = await wilsonFetch(url)

    if (page === 1) {
      rawFirstPage = data
      totalApi = extractTotal(data)
      totalPages = extractTotalPages(data, PAGE_SIZE)
      console.log(`  Total records from API: ${totalApi} | Total pages: ${totalPages}`)
    }

    const recs = extractRecords(data)
    if (recs.length === 0) break

    for (const rec of recs) {
      const c = buildCandidate(rec)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (maxRecords > 0 && candidates.length >= maxRecords) break
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break
  }

  return { candidates, skippedMalformed, totalApi, rawFirstPage }
}

// ── Topic management ──────────────────────────────────────────────────────────

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
  // Dedup on Source.url
  const existingSource = await tx.source.findFirst({
    where: { url: rec.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  // Also dedup on Claim.externalId
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
      externalId: `wilson_center_source_${rec.wilsonId}`,
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
        wilsonId: rec.wilsonId,
        collection: rec.collection,
        originalArchive: rec.originalArchive,
        originalLanguage: rec.originalLanguage,
        originalClassification: rec.originalClassification,
        translationStatus: rec.translationStatus,
        countries: rec.countries,
        subjects: rec.subjects,
        rawDate: rec.rawDate,
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
      reason: 'Wilson Center Digital Archive — translated/declassified primary source, HARD_FACT',
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
  const { mode, collection, country, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 110: Wilson Center Digital Archive ────────────────────────`)
  console.log(`Mode: ${mode} | Collection: ${collection ?? 'all'} | Country: ${country ?? 'all'} | Limit: ${limit || 'all'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing API and sampling records (no DB writes)...')

    const maxFetch = DRY_RUN_SAMPLE_COUNT
    const { candidates, skippedMalformed, totalApi, rawFirstPage } = await fetchAllRecords(
      collection,
      country,
      maxFetch,
    )

    console.log(`\n  API total reported: ${totalApi}`)
    console.log(`  Candidates fetched: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
    console.log('\n  Raw first-page top-level keys:', Object.keys(rawFirstPage).join(', '))

    const sampleRecords = candidates.slice(0, 15)
    console.log('\nSample records:')
    for (const r of sampleRecords) {
      console.log(`  [${r.wilsonId}] ${r.rawDate ?? 'no-date'} | ${r.collection ?? 'no-collection'} | ${r.countries.join(', ') || 'no-countries'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      apiBase: WILSON_BASE,
      filters: { collection, country },
      totalFromApi: totalApi,
      candidatesFetched: candidates.length,
      skippedMalformed,
      rawFirstPageKeys: Object.keys(rawFirstPage),
      sample: sampleRecords.map(r => ({
        wilsonId: r.wilsonId,
        claimText: r.claimText,
        externalId: r.externalId,
        sourceUrl: r.sourceUrl,
        rawDate: r.rawDate,
        datePrecision: r.datePrecision,
        collection: r.collection,
        originalArchive: r.originalArchive,
        originalLanguage: r.originalLanguage,
        originalClassification: r.originalClassification,
        translationStatus: r.translationStatus,
        countries: r.countries,
        subjects: r.subjects.slice(0, 5),
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-110-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-110-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'wilson-center-digital-archive',
    'Wilson Center Digital Archive',
    'archives',
  )

  console.log('\nStep 2: Fetching records from Wilson Center API...')
  const maxFetch = limit > 0 ? limit : 0
  const { candidates, skippedMalformed, totalApi } = await fetchAllRecords(collection, country, maxFetch)

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
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.wilsonId} — ${rec.title.slice(0, 60)}`)
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
