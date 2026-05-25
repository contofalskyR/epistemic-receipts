// Pipeline 126 — Europeana WWI Collection
// Dataset: Europeana API v2, theme=ww1 (~278k digitized items from European archives).
// Scope: Capped at 10,000 records for initial run.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-europeana-wwi.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-europeana-wwi.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'europeana_wwi_v1'
const API_BASE = 'https://api.europeana.eu/record/v2/search.json'
const ITEM_BASE = 'https://www.europeana.eu/item'
const PAGE_SIZE = 100
const THROTTLE_MS = 300
const DRY_RUN_SAMPLE_COUNT = 20
const FULL_RUN_CAP = 10000

// ── Types ─────────────────────────────────────────────────────────────────────

interface EuropeanaItem {
  id: string
  title?: string[]
  type?: string
  year?: string[]
  country?: string[]
  dataProvider?: string[]
  dcCreator?: string[]
  dcDescriptionLangAware?: Record<string, string[]>
  dcDescription?: string[]
  guid?: string
}

interface EuropeanaPage {
  success: boolean
  error?: string
  totalResults?: number
  itemsCount?: number
  nextCursor?: string
  items?: EuropeanaItem[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  externalId: string
  sourceUrl: string
  title: string
  claimText: string
  date: Date | null
  datePrecision: string | null
  rawYear: string | null
  type: string | null
  dataProvider: string | null
  creator: string | null
  description: string | null
  europeanaId: string
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

function apiKey(): string {
  return process.env.EUROPEANA_API_KEY ?? 'apidemo'
}

async function europeanaFetch(url: string, retries = 3): Promise<EuropeanaPage> {
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
    if (!res.ok) throw new Error(`Europeana API ${res.status} at ${url}`)
    return res.json() as Promise<EuropeanaPage>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Build candidate from API record ──────────────────────────────────────────

function bestTitle(item: EuropeanaItem): string | null {
  const titles = item.title ?? []
  if (titles.length === 0) return null
  // Prefer shorter English-looking title (ASCII-only) to avoid non-latin as primary
  const ascii = titles.find(t => /^[\x20-\x7E]+$/.test(t))
  return (ascii ?? titles[0]).trim() || null
}

function bestDescription(item: EuropeanaItem): string | null {
  const aware = item.dcDescriptionLangAware ?? {}
  const enDesc = aware['en']?.[0] ?? null
  const anyDesc = enDesc ?? item.dcDescription?.[0] ?? null
  return anyDesc ? anyDesc.slice(0, 500).replace(/\s+/g, ' ').trim() : null
}

function parseYear(raw: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }
  const m = raw.match(/^(\d{4})/)
  if (!m) return { date: null, precision: null }
  const d = new Date(`${m[1]}-01-01T00:00:00Z`)
  return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
}

function buildCandidate(item: EuropeanaItem): CandidateRecord | null {
  const title = bestTitle(item)
  if (!title) return null

  // id is like "/08614/cat10378" — strip leading slash for URL
  const europeanaId = item.id
  const idPath = europeanaId.startsWith('/') ? europeanaId.slice(1) : europeanaId
  const sourceUrl = `${ITEM_BASE}/${idPath}`
  const externalId = `europeana_wwi_${idPath.replace(/\//g, '_')}`

  const rawYear = item.year?.[0] ?? null
  const { date, precision } = parseYear(rawYear)

  const dataProvider = item.dataProvider?.[0]?.trim() ?? null
  const creator = item.dcCreator?.find(c => c !== 'Unknown' && c.startsWith('http') === false)?.trim() ?? null
  const description = bestDescription(item)

  const claimText = creator ? `${creator}: ${title}` : title

  return {
    externalId,
    sourceUrl,
    title,
    claimText,
    date,
    datePrecision: precision,
    rawYear,
    type: item.type ?? null,
    dataProvider,
    creator,
    description,
    europeanaId,
  }
}

// ── Fetch records ─────────────────────────────────────────────────────────────

function firstPageUrl(): string {
  const key = apiKey()
  return `${API_BASE}?wskey=${key}&query=*&theme=ww1&rows=${PAGE_SIZE}&cursor=*&profile=minimal`
}

function nextPageUrl(cursor: string): string {
  const key = apiKey()
  return `${API_BASE}?wskey=${key}&query=*&theme=ww1&rows=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}&profile=minimal`
}

async function fetchRecords(maxRecords: number): Promise<{
  candidates: CandidateRecord[]
  skippedMalformed: number
  totalFetched: number
  totalResults: number
}> {
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  let totalFetched = 0
  let totalResults = 0
  let nextUrl: string | null = firstPageUrl()
  let pageNum = 0

  while (nextUrl) {
    pageNum++
    console.log(`  Fetching page ${pageNum} — cursor position ~${totalFetched}`)

    const page = await europeanaFetch(nextUrl)

    if (!page.success) {
      throw new Error(`Europeana API error: ${page.error ?? 'unknown'}`)
    }

    if (pageNum === 1) totalResults = page.totalResults ?? 0

    const items = page.items ?? []
    totalFetched += items.length

    for (const item of items) {
      const c = buildCandidate(item)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (maxRecords > 0 && candidates.length >= maxRecords) break
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break
    if (!page.nextCursor || items.length === 0) break

    nextUrl = nextPageUrl(page.nextCursor)
  }

  return { candidates, skippedMalformed, totalFetched, totalResults }
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
      name: rec.title.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `${rec.externalId}_source`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText.slice(0, 500),
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
        europeanaId: rec.europeanaId,
        type: rec.type,
        dataProvider: rec.dataProvider,
        creator: rec.creator,
        rawYear: rec.rawYear,
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
      newScore: 85,
      reason: 'Europeana WWI Collection — digitized archival item, HARD_FACT',
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
  const key = apiKey()

  console.log(`\n── Pipeline 126: Europeana WWI Collection ──────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'default'} | API key: ${key === 'apidemo' ? 'apidemo (demo)' : 'env EUROPEANA_API_KEY'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing Europeana API and sampling records (no DB writes)...')

    const { candidates, skippedMalformed, totalFetched, totalResults } = await fetchRecords(DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  Total available in theme: ${totalResults.toLocaleString()}`)
    console.log(`  API items fetched: ${totalFetched}`)
    console.log(`  Candidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)

    const sample = candidates.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.europeanaId}] year=${r.rawYear ?? 'n/a'} type=${r.type ?? 'n/a'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
      if (r.dataProvider) console.log(`    provider: ${r.dataProvider}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      apiBase: API_BASE,
      theme: 'ww1',
      totalAvailable: totalResults,
      totalFetched,
      candidatesFetched: candidates.length,
      skippedMalformed,
      fullRunCap: FULL_RUN_CAP,
      sample: sample.map(r => ({
        europeanaId: r.europeanaId,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        rawYear: r.rawYear,
        datePrecision: r.datePrecision,
        type: r.type,
        dataProvider: r.dataProvider,
        creator: r.creator,
        description: r.description,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-126-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-126-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'wwi-documents',
    'WWI Documents',
    'archives',
  )

  const maxFetch = limit > 0 ? limit : FULL_RUN_CAP
  console.log(`\nStep 2: Fetching up to ${maxFetch.toLocaleString()} records from Europeana...`)
  const { candidates, skippedMalformed, totalFetched, totalResults } = await fetchRecords(maxFetch)

  console.log(`\n  Total available in theme: ${totalResults.toLocaleString()}`)
  console.log(`  Fetched from API: ${totalFetched}`)
  console.log(`  Candidates: ${candidates.length} (malformed: ${skippedMalformed})`)

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

      if (verbose || counts.ingested % 200 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.europeanaId}`)
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
