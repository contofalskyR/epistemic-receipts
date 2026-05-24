// Pipeline 127 — Library of Congress Collections
// Dataset: loc.gov JSON API — no auth required
// Scope: Dynamically discovered LoC collections
// Cap: 5000 records for initial full run, 1000 per collection
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-loc-collections.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-loc-collections.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'loc_collections_v1'
const LOC_BASE = 'https://www.loc.gov'
const PAGE_SIZE = 25
const THROTTLE_MS = 600
const RETRY_BASE_DELAY_MS = 5000
const MAX_RETRIES = 4
const BETWEEN_COLLECTIONS_SLEEP_MS = 30000
const DRY_RUN_SAMPLE_COUNT = 20
const FULL_RUN_CAP = 5000
const PER_COLLECTION_CAP = 1000

interface LocCollection {
  slug: string
  name: string
  subTopicSlug: string
  subTopicName: string
}

// SubTopic mappings for well-known collections; fallback to loc-general for others
const KNOWN_SUBTOPICS: Record<string, { slug: string; name: string }> = {
  'civil-war-glass-negatives': { slug: 'loc-photographs', name: 'LoC Photographs' },
  'national-child-labor-committee-collection': { slug: 'loc-photographs', name: 'LoC Photographs' },
  'world-war-i-posters': { slug: 'loc-wwi', name: 'World War I — LoC' },
  'world-war-ii-posters': { slug: 'loc-wwii', name: 'World War II — LoC' },
  'panoramic-maps': { slug: 'loc-maps', name: 'LoC Maps' },
  'george-washington-papers': { slug: 'loc-manuscripts', name: 'LoC Manuscripts' },
  'thomas-jefferson-papers': { slug: 'loc-manuscripts', name: 'LoC Manuscripts' },
  'abraham-lincoln-papers': { slug: 'loc-manuscripts', name: 'LoC Manuscripts' },
  'federal-theatre-project-collection': { slug: 'loc-performing-arts', name: 'LoC Performing Arts' },
  'ansel-adams-manzanar': { slug: 'loc-photographs', name: 'LoC Photographs' },
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface LocResult {
  id?: string
  url?: string
  title?: unknown
  date?: string | null
  description?: unknown
  subject?: string[] | null
  contributor?: string[] | null
  type?: string[] | null
  original_format?: string[] | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface LocPagination {
  current?: number
  next?: string | null
  of?: number
  results?: number
  total?: number
  perpage?: number
}

interface LocApiResponse {
  results?: LocResult[]
  pagination?: LocPagination
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  itemId: string
  externalId: string
  sourceUrl: string
  title: string
  claimText: string
  rawDate: string | null
  date: Date | null
  datePrecision: string | null
  description: string | null
  itemType: string | null
  collectionName: string
  collectionSlug: string
  subTopicSlug: string
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

async function locFetch(url: string, retries = MAX_RETRIES): Promise<LocApiResponse> {
  let delay = RETRY_BASE_DELAY_MS
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay / 1000}s (attempt ${attempt + 1}/${retries})`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (res.status === 404) {
      console.warn(`  404 — not found: ${url}`)
      return {}
    }
    if (!res.ok) throw new Error(`LoC API ${res.status} at ${url}`)
    return res.json() as Promise<LocApiResponse>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseLocDate(raw: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }
  const str = String(raw).trim()

  const fullMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (fullMatch) {
    const d = new Date(`${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
  }

  // Year range YYYY-YYYY — use start year
  const rangeMatch = str.match(/^(\d{4})-\d{4}/)
  if (rangeMatch) {
    const d = new Date(`${rangeMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  const yearMatch = str.match(/^(\d{4})/)
  if (yearMatch) {
    const d = new Date(`${yearMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

// ── Build candidate from API result ──────────────────────────────────────────

function extractItemId(url: string): string | null {
  const match = url.match(/\/item\/([^\/\?#]+)\/?(?:[?#].*)?$/)
  return match ? match[1] : null
}

function coerceTitle(raw: unknown): string {
  if (Array.isArray(raw)) return String(raw[0] ?? '').trim()
  if (typeof raw === 'string') return raw.trim()
  return ''
}

function coerceDescription(raw: unknown): string | null {
  if (!raw) return null
  if (Array.isArray(raw)) {
    const joined = raw.filter(Boolean).join(' ')
    return joined.slice(0, 500) || null
  }
  if (typeof raw === 'string') return raw.slice(0, 500) || null
  return null
}

function resolveUrl(raw: string): string {
  return raw.startsWith('http') ? raw : `${LOC_BASE}${raw}`
}

function buildCandidate(result: LocResult, collection: LocCollection): CandidateRecord | null {
  const rawUrl = result.url ?? result.id ?? ''
  if (!rawUrl || !rawUrl.includes('/item/')) return null

  const itemId = extractItemId(rawUrl)
  if (!itemId) return null

  const title = coerceTitle(result.title)
  if (!title || title.length < 4) return null

  const externalId = `loc_${itemId}`
  const sourceUrl = resolveUrl(rawUrl).replace(/\/{2,}$/, '/')

  const rawDate = result.date ? String(result.date).trim() : null
  const { date, precision } = parseLocDate(rawDate)

  const description = coerceDescription(result.description)
  const itemType = (result.type ?? [])[0] ?? (result.original_format ?? [])[0] ?? null
  const claimText = title.length > 200 ? title.slice(0, 200) : title

  return {
    itemId,
    externalId,
    sourceUrl,
    title,
    claimText,
    rawDate,
    date,
    datePrecision: precision,
    description,
    itemType,
    collectionName: collection.name,
    collectionSlug: collection.slug,
    subTopicSlug: collection.subTopicSlug,
  }
}

// ── Fallback collections (used when the index API is rate-limited) ────────────

const FALLBACK_COLLECTIONS: LocCollection[] = [
  { slug: 'panoramic-maps', name: 'Panoramic Maps', subTopicSlug: 'loc-maps', subTopicName: 'LoC Maps' },
  { slug: 'george-washington-papers', name: 'George Washington Papers', subTopicSlug: 'loc-manuscripts', subTopicName: 'LoC Manuscripts' },
  { slug: 'world-war-i-posters', name: 'World War I Posters', subTopicSlug: 'loc-wwi', subTopicName: 'World War I — LoC' },
  { slug: 'civil-war-glass-negatives', name: 'Civil War Glass Negatives', subTopicSlug: 'loc-photographs', subTopicName: 'LoC Photographs' },
  { slug: 'thomas-jefferson-papers', name: 'Thomas Jefferson Papers', subTopicSlug: 'loc-manuscripts', subTopicName: 'LoC Manuscripts' },
]

// ── Discover collections dynamically from LoC index ──────────────────────────

async function discoverCollections(): Promise<LocCollection[]> {
  // Use default page size (no c= param) to reduce rate-limit exposure
  const url = `${LOC_BASE}/collections/?fo=json`
  console.log(`  Fetching collections index: ${url}`)

  let page: LocApiResponse
  try {
    page = await locFetch(url)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn(`  Discovery failed (${msg}) — falling back to ${FALLBACK_COLLECTIONS.length} known collections`)
    return FALLBACK_COLLECTIONS
  }

  const collections: LocCollection[] = []

  for (const result of page.results ?? []) {
    const rawUrl = result.url ?? result.id ?? ''
    const slugMatch = rawUrl.match(/\/collections\/([^\/\?#]+)\/?/)
    if (!slugMatch) continue
    const slug = slugMatch[1]
    if (!slug) continue

    const name = coerceTitle(result.title) || slug
    const subTopic = KNOWN_SUBTOPICS[slug] ?? { slug: 'loc-general', name: 'LoC General' }

    collections.push({
      slug,
      name,
      subTopicSlug: subTopic.slug,
      subTopicName: subTopic.name,
    })
  }

  if (collections.length === 0) {
    console.warn(`  Discovery returned 0 collections — falling back to ${FALLBACK_COLLECTIONS.length} known collections`)
    return FALLBACK_COLLECTIONS
  }

  console.log(`  Discovered ${collections.length} collections`)
  return collections
}

// ── Fetch collection items ────────────────────────────────────────────────────

async function fetchCollectionItems(
  collection: LocCollection,
  maxItems: number,
): Promise<{ candidates: CandidateRecord[]; skippedMalformed: number; collectionTotal: number }> {
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  let collectionTotal = 0
  let nextUrl: string | null =
    `${LOC_BASE}/collections/${collection.slug}/?fo=json&c=${PAGE_SIZE}&sp=1`
  let pageNum = 0

  while (nextUrl) {
    pageNum++
    console.log(`    Page ${pageNum}: ${nextUrl}`)

    const page = await locFetch(nextUrl)
    const results = page.results ?? []
    if (page.pagination?.total) collectionTotal = page.pagination.total

    for (const result of results) {
      const c = buildCandidate(result, collection)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (candidates.length >= maxItems) break
    }

    if (candidates.length >= maxItems) break

    const rawNext = page.pagination?.next ?? null
    nextUrl = rawNext
      ? (rawNext.startsWith('http') ? rawNext : `${LOC_BASE}${rawNext}`)
      : null
  }

  return { candidates, skippedMalformed, collectionTotal }
}

// ── Fetch across all target collections ───────────────────────────────────────

async function fetchAllCandidates(
  collections: LocCollection[],
  maxTotal: number,
): Promise<{
  candidates: CandidateRecord[]
  skippedMalformed: number
}> {
  const allCandidates: CandidateRecord[] = []
  let totalSkipped = 0

  for (let i = 0; i < collections.length; i++) {
    const collection = collections[i]
    if (allCandidates.length >= maxTotal) break

    if (i > 0) {
      console.log(`  Sleeping ${BETWEEN_COLLECTIONS_SLEEP_MS / 1000}s between collections...`)
      await sleep(BETWEEN_COLLECTIONS_SLEEP_MS)
    }

    const remaining = maxTotal - allCandidates.length
    const perCollectionLimit = Math.min(PER_COLLECTION_CAP, remaining)

    console.log(`\n  Collection: ${collection.name} (cap: ${perCollectionLimit})`)

    try {
      const { candidates, skippedMalformed, collectionTotal } = await fetchCollectionItems(
        collection,
        perCollectionLimit,
      )
      console.log(`    Fetched: ${candidates.length} / ${collectionTotal} total in collection`)
      allCandidates.push(...candidates)
      totalSkipped += skippedMalformed
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`    ERROR fetching ${collection.slug}: ${msg}`)
    }
  }

  return { candidates: allCandidates, skippedMalformed: totalSkipped }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentId?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({
    data: { slug, name, domain, parentTopicId: parentId ?? null },
  })
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
  const existingClaim = await tx.claim.findUnique({
    where: { externalId: rec.externalId },
    select: { id: true },
  })
  if (existingClaim) return 'skipped'

  const existingSource = await tx.source.findFirst({
    where: { url: rec.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: rec.claimText.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `loc_source_${rec.itemId}`,
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
        itemId: rec.itemId,
        rawDate: rec.rawDate,
        itemType: rec.itemType,
        collectionName: rec.collectionName,
        collectionSlug: rec.collectionSlug,
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
      reason: 'Library of Congress Collections — primary source archive, HARD_FACT',
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
  const { mode, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 127: Library of Congress Collections ──────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'default'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Discovering collections from LoC index...')
    const collections = await discoverCollections()

    console.log('\nStep 2: Probing API and sampling records (no DB writes)...')
    const { candidates, skippedMalformed } = await fetchAllCandidates(collections, DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  Candidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)

    const sample = candidates.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.collectionSlug}] ${r.rawDate ?? 'no-date'} | ${r.itemType ?? 'unknown'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
      console.log(`    ${r.sourceUrl}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      ingestedBy: INGESTED_BY,
      collectionsDiscovered: collections.length,
      candidatesFetched: candidates.length,
      skippedMalformed,
      sample: sample.map(r => ({
        itemId: r.itemId,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        rawDate: r.rawDate,
        datePrecision: r.datePrecision,
        itemType: r.itemType,
        collectionName: r.collectionName,
        collectionSlug: r.collectionSlug,
        description: r.description,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-127-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-127-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Discovering collections from LoC index...')
  const collections = await discoverCollections()

  console.log('\nStep 2: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'loc-collections',
    'Library of Congress Collections',
    'archives',
  )

  const subTopicIds = new Map<string, string>()
  for (const col of collections) {
    if (!subTopicIds.has(col.subTopicSlug)) {
      const subId = await ensureTopic(col.subTopicSlug, col.subTopicName, 'archives', rootTopicId)
      subTopicIds.set(col.subTopicSlug, subId)
    }
  }

  console.log('\nStep 3: Fetching items from LoC API...')
  const maxFetch = limit > 0 ? limit : FULL_RUN_CAP
  const { candidates, skippedMalformed } = await fetchAllCandidates(collections, maxFetch)

  console.log(`\nTotal candidates: ${candidates.length} (malformed skipped: ${skippedMalformed})`)

  console.log(`\nStep 4: Ingesting ${candidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    const subTopicId = subTopicIds.get(rec.subTopicSlug)
    const topicIds = [rootTopicId, ...(subTopicId ? [subTopicId] : [])]

    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.claimText.slice(0, 60)}`)
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
