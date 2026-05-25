// Pipeline 116 — Miller Center Presidential Speeches
// Dataset: millercenter.org Drupal JSON API — no auth required.
// Scope: Full U.S. presidential speech archive (~1,000 speeches).
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-miller-center.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-miller-center.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'miller_center_v1'
const MILLER_API_BASE = 'https://millercenter.org/jsonapi/node/presidential_speech'
const MILLER_SPEECH_BASE = 'https://millercenter.org/the-presidency/presidential-speeches/'
const PAGE_SIZE = 50
const THROTTLE_MS = 400
const DRY_RUN_SAMPLE_COUNT = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface JsonApiItem {
  type: string
  id: string
  attributes: {
    drupal_internal__nid?: number
    title?: string
    field_speech_date?: string | null
    field_transcript?: { value?: string } | null
    field_introduction?: { value?: string } | null
    path?: { alias?: string } | null
    status?: boolean
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
  relationships?: {
    field_president?: {
      data?: { type: string; id: string } | null
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
}

interface JsonApiIncluded {
  type: string
  id: string
  attributes: {
    name?: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any
  }
}

interface JsonApiPage {
  data?: JsonApiItem[]
  included?: JsonApiIncluded[]
  links?: {
    next?: { href?: string } | null
  }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  nid: string
  slug: string
  externalId: string
  sourceUrl: string
  title: string
  president: string | null
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

async function millerFetch(url: string, retries = 3): Promise<JsonApiPage> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'application/vnd.api+json',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`Miller Center API ${res.status} at ${url}`)
    return res.json() as Promise<JsonApiPage>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(raw: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }

  const fullMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (fullMatch) {
    const d = new Date(`${fullMatch[1]}-${fullMatch[2]}-${fullMatch[3]}T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
  }

  const monthMatch = raw.match(/^(\d{4})-(\d{2})/)
  if (monthMatch) {
    const d = new Date(`${monthMatch[1]}-${monthMatch[2]}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
  }

  const yearMatch = raw.match(/^(\d{4})/)
  if (yearMatch) {
    const d = new Date(`${yearMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim()
}

// ── Build candidate from API record ──────────────────────────────────────────

function extractSlug(item: JsonApiItem): string {
  const alias = item.attributes.path?.alias
  if (alias) {
    const parts = alias.replace(/\/$/, '').split('/')
    const last = parts[parts.length - 1]
    if (last) return last
  }
  return String(item.attributes.drupal_internal__nid ?? item.id)
}

function buildCandidate(
  item: JsonApiItem,
  presidentMap: Map<string, string>,
): CandidateRecord | null {
  const title = item.attributes.title?.trim()
  if (!title) return null

  const slug = extractSlug(item)
  const nid = String(item.attributes.drupal_internal__nid ?? item.id)
  const externalId = `miller_center_${slug}`
  const sourceUrl = `${MILLER_SPEECH_BASE}${slug}`

  const rawDate = item.attributes.field_speech_date ? String(item.attributes.field_speech_date).trim() : null
  const { date, precision } = parseDate(rawDate)

  const presidentUuid = item.relationships?.field_president?.data?.id ?? null
  const president = presidentUuid ? (presidentMap.get(presidentUuid) ?? null) : null

  const transcriptHtml =
    item.attributes.field_transcript?.value ??
    item.attributes.field_introduction?.value ??
    null

  const description = transcriptHtml
    ? stripHtml(transcriptHtml).slice(0, 500)
    : null

  const claimText = president ? `${president}: ${title}` : title

  return {
    nid,
    slug,
    externalId,
    sourceUrl,
    title,
    president,
    date,
    datePrecision: precision,
    rawDate,
    description,
    claimText,
  }
}

// ── Fetch all speeches ────────────────────────────────────────────────────────

function firstPageUrl(): string {
  return `${MILLER_API_BASE}?page%5Blimit%5D=${PAGE_SIZE}&include=field_president`
}

async function fetchAllSpeeches(maxRecords = 0): Promise<{
  candidates: CandidateRecord[]
  skippedMalformed: number
  totalFetched: number
  rawKeys: string[]
}> {
  const candidates: CandidateRecord[] = []
  const presidentMap = new Map<string, string>()
  let skippedMalformed = 0
  let totalFetched = 0
  let rawKeys: string[] = []
  let nextUrl: string | null = firstPageUrl()
  let pageNum = 0

  while (nextUrl) {
    pageNum++
    console.log(`  Fetching page ${pageNum} — ${nextUrl}`)

    const page = await millerFetch(nextUrl)
    const items = page.data ?? []

    if (pageNum === 1 && items.length > 0) {
      rawKeys = Object.keys(items[0].attributes)
    }

    // Collect president names from included
    for (const inc of page.included ?? []) {
      if (inc.type === 'taxonomy_term--presidents' && inc.attributes.name) {
        presidentMap.set(inc.id, inc.attributes.name.trim())
      }
    }

    totalFetched += items.length

    for (const item of items) {
      const c = buildCandidate(item, presidentMap)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (maxRecords > 0 && candidates.length >= maxRecords) break
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break

    nextUrl = page.links?.next?.href ?? null
  }

  console.log(`  Total items fetched from API: ${totalFetched}`)
  return { candidates, skippedMalformed, totalFetched, rawKeys }
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
      name: rec.claimText.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `miller_center_source_${rec.slug}`,
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
        nid: rec.nid,
        slug: rec.slug,
        president: rec.president,
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
      reason: 'Miller Center Presidential Speeches — primary source archive, HARD_FACT',
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

  console.log(`\n── Pipeline 116: Miller Center Presidential Speeches ──────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing API and sampling records (no DB writes)...')

    const { candidates, skippedMalformed, totalFetched, rawKeys } = await fetchAllSpeeches(DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  API items fetched: ${totalFetched}`)
    console.log(`  Candidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
    console.log(`  Raw attribute keys: ${rawKeys.join(', ')}`)

    const sample = candidates.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.nid}] ${r.rawDate ?? 'no-date'} | ${r.president ?? 'unknown'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      apiBase: MILLER_API_BASE,
      totalFetched,
      candidatesFetched: candidates.length,
      skippedMalformed,
      rawApiKeys: rawKeys,
      sample: sample.map(r => ({
        nid: r.nid,
        slug: r.slug,
        claimText: r.claimText,
        externalId: r.externalId,
        sourceUrl: r.sourceUrl,
        rawDate: r.rawDate,
        datePrecision: r.datePrecision,
        president: r.president,
        description: r.description,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-116-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-116-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'miller-center-presidential-speeches',
    'Miller Center Presidential Speeches',
    'archives',
  )

  console.log('\nStep 2: Fetching speeches from Miller Center API...')
  const maxFetch = limit > 0 ? limit : 0
  const { candidates, skippedMalformed, totalFetched } = await fetchAllSpeeches(maxFetch)

  console.log(`\nTotal from API: ${totalFetched}`)
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

      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.slug} — ${rec.claimText.slice(0, 60)}`)
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
