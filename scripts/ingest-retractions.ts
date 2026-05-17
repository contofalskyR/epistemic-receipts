// Pipeline 13 — Retracted Papers (CrossRef)
// Dataset: CrossRef API (api.crossref.org) — publisher-reported retractions.
// Note: The dedicated Retraction Watch API (api.retractionwatch.com) is not publicly accessible.
// CrossRef is a primary authoritative source: DOI registry, publisher-submitted retraction metadata.
// Volume: ~26,500 records. No auth required (polite pool: include email in requests).
// Run: npx tsx scripts/ingest-retractions.ts --dry-run
//      npx tsx scripts/ingest-retractions.ts --sample 10
//      npx tsx scripts/ingest-retractions.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'crossref_retractions_v1'
const CROSSREF_BASE = 'https://api.crossref.org'
const POLITE_EMAIL = 'robert.contofalsky@gmail.com'
const PAGE_SIZE = 200

// ── Types ─────────────────────────────────────────────────────────────────────

interface CrossRefDate { 'date-parts': number[][] }

interface CrossRefUpdate {
  DOI: string
  type: string
  label: string
  source: string
  updated: { 'date-parts': number[][]; 'date-time': string; timestamp: number }
}

interface CrossRefWork {
  DOI: string
  title?: string[]
  author?: { given?: string; family?: string; sequence?: string }[]
  published?: CrossRefDate
  publisher?: string
  'container-title'?: string[]
  'update-to'?: CrossRefUpdate[]
}

interface CrossRefResponse {
  status: string
  message: {
    'total-results': number
    items: CrossRefWork[]
    'items-per-page': number
    'next-cursor'?: string
    query: { 'start-index': number }
  }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  doi: string
  externalId: string
  title: string
  firstAuthor: string | null
  journal: string | null
  publisher: string | null
  retractionDate: Date
  retractionDatePrecision: 'DAY' | 'MONTH' | 'YEAR'
  claimText: string
  sourceUrl: string
  updateType: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]'); process.exit(1) as never })()

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 500

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function crossrefFetch(url: string, retries = 3): Promise<CrossRefResponse> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': `EpistemicReceipts/1.0 (mailto:${POLITE_EMAIL})`,
      },
    })
    if ([429, 503, 504].includes(res.status) && attempt < retries) {
      const retryAfter = res.headers.get('Retry-After')
      const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay
      console.warn(`  HTTP ${res.status} — retrying in ${waitMs}ms`)
      await sleep(waitMs)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`CrossRef API ${res.status} at ${url}`)
    return res.json() as Promise<CrossRefResponse>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch all retracted works (paginated) ─────────────────────────────────────

async function fetchAllRetractions(): Promise<CrossRefWork[]> {
  const all: CrossRefWork[] = []
  const fields = 'DOI,title,author,published,publisher,container-title,update-to'
  // CrossRef hard-limits offset to 10,000 — must use cursor-based pagination
  let cursor = '*'

  for (;;) {
    const url = `${CROSSREF_BASE}/works?filter=has-update:true,update-type:retraction&rows=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}&select=${fields}&mailto=${POLITE_EMAIL}`
    const data = await crossrefFetch(url)
    const page = data.message.items ?? []
    all.push(...page)
    const total = data.message['total-results']
    console.log(`  Fetched ${all.length}/${total} retraction records...`)
    if (page.length < PAGE_SIZE) break
    const next = data.message['next-cursor']
    if (!next) break
    cursor = next
  }

  return all
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const RETRACTION_PREFIXES = ['RETRACTED: ', 'RETRACTED:', 'WITHDRAWN: ', 'WITHDRAWN:', 'CORRECTION: ', 'CORRECTION:']

function cleanTitle(raw: string): string {
  let t = raw.trim()
  for (const prefix of RETRACTION_PREFIXES) {
    if (t.startsWith(prefix)) {
      t = t.slice(prefix.length).trim()
      break
    }
  }
  return t
}

function parseRetractionDate(update: CrossRefUpdate): { date: Date; precision: 'DAY' | 'MONTH' | 'YEAR' } | null {
  if (update.updated?.['date-time']) {
    const d = new Date(update.updated['date-time'])
    if (!isNaN(d.getTime())) {
      const parts = update.updated['date-parts']
      const precision = parts?.[0]?.length === 3 ? 'DAY' : parts?.[0]?.length === 2 ? 'MONTH' : 'YEAR'
      return { date: d, precision }
    }
  }
  const parts = update.updated?.['date-parts']?.[0]
  if (!parts || parts.length === 0) return null
  const [year, month, day] = parts
  if (!year) return null
  const d = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1))
  return {
    date: d,
    precision: day ? 'DAY' : month ? 'MONTH' : 'YEAR',
  }
}

function formatAuthor(authors: CrossRefWork['author']): string | null {
  if (!authors || authors.length === 0) return null
  const first = authors.find(a => a.sequence === 'first') ?? authors[0]
  if (!first) return null
  const name = [first.given, first.family].filter(Boolean).join(' ')
  return name || null
}

function buildCandidate(work: CrossRefWork): CandidateRecord | null {
  const rawTitle = work.title?.[0]
  if (!rawTitle || !work.DOI) return null

  // Take the retraction update (skip corrections/withdrawals differently if needed)
  const retractionUpdate = work['update-to']?.find(u => u.type === 'retraction' || u.type === 'withdrawal')
    ?? work['update-to']?.[0]
  if (!retractionUpdate) return null

  const parsed = parseRetractionDate(retractionUpdate)
  if (!parsed) return null

  const title = cleanTitle(rawTitle)
  if (!title) return null

  const firstAuthor = formatAuthor(work.author)
  const journal = work['container-title']?.[0] ?? null
  const publisher = work.publisher ?? null
  const updateType = retractionUpdate.label ?? 'Retraction'
  const doi = work.DOI.toLowerCase()

  // Build natural claim text
  const authorPart = firstAuthor ? ` by ${firstAuthor}` : ''
  const journalPart = journal ? ` in ${journal}` : ''
  const dateStr = parsed.date.toISOString().split('T')[0]
  const pastTense = updateType.toLowerCase() === 'retraction' ? 'retracted'
    : updateType.toLowerCase() === 'withdrawal' ? 'withdrawn'
    : `${updateType.toLowerCase()}ed`
  const claimText = `The paper "${title}"${authorPart}${journalPart} was ${pastTense} on ${dateStr}.`

  return {
    doi,
    externalId: `crossref_retraction_${doi.replace(/[^a-z0-9]/g, '_')}`,
    title,
    firstAuthor,
    journal,
    publisher,
    retractionDate: parsed.date,
    retractionDatePrecision: parsed.precision,
    claimText,
    sourceUrl: `https://doi.org/${doi}`,
    updateType,
  }
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

async function ensureTopics(): Promise<{ root: string }> {
  const root = await ensureTopic('retracted-papers', 'Retracted Papers', 'science')
  return { root }
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const sourceName = rec.journal
    ? `${rec.updateType}: "${rec.title.slice(0, 80)}" — ${rec.journal}`
    : `${rec.updateType}: "${rec.title.slice(0, 80)}"`

  const source = await tx.source.create({
    data: {
      name: sourceName,
      url: rec.sourceUrl,
      publishedAt: rec.retractionDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `crossref_retraction_source_${rec.doi.replace(/[^a-z0-9]/g, '_')}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.retractionDate,
      claimEmergedPrecision: rec.retractionDatePrecision,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        doi: rec.doi,
        title: rec.title,
        firstAuthor: rec.firstAuthor,
        journal: rec.journal,
        publisher: rec.publisher,
        updateType: rec.updateType,
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
      reason: 'CrossRef publisher-reported retraction — institutional record as HARD_FACT',
      changedAt: rec.retractionDate,
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
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 13: Retracted Papers (CrossRef) ──────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)
  console.log(`Source: CrossRef polite pool (publisher-reported retractions)`)

  // Step 1: Topics
  let topics = { root: '' }
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring retraction topics...')
    topics = await ensureTopics()
    console.log(`  Root topic (retracted-papers): ${topics.root}`)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch all retracted works from CrossRef
  console.log('\nStep 2: Fetching retracted papers from CrossRef API...')
  const works = await fetchAllRetractions()
  console.log(`  Retrieved ${works.length} raw records`)

  // Step 3: Build candidates
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  const updateTypeBreakdown: Record<string, number> = {}

  for (const work of works) {
    const rec = buildCandidate(work)
    if (!rec) { skippedMalformed++; continue }
    candidates.push(rec)
    updateTypeBreakdown[rec.updateType] = (updateTypeBreakdown[rec.updateType] ?? 0) + 1
  }

  console.log(`\nCandidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
  console.log('Update type breakdown:')
  for (const [type, n] of Object.entries(updateTypeBreakdown).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${type}: ${n}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      doi: r.doi,
      journal: r.journal,
      retractionDate: r.retractionDate.toISOString(),
      updateType: r.updateType,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
    }))

    const output = {
      runDate: new Date().toISOString(),
      totalCandidates: candidates.length,
      skippedMalformed,
      updateTypeBreakdown,
      sample,
    }

    fs.writeFileSync('pipeline-13-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-13-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = candidates.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, errors = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const result = await writeRow(tx, row, [topics.root])
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.doi} — ${row.title.slice(0, 60)}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, errors: ${errors}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  const rows = limit > 0 ? candidates.slice(0, limit) : candidates
  console.log(`\nFull ingestion: ${rows.length} rows (per-row transactions)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const row of rows) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, row, [topics.root]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 500 === 0) {
        console.log(`  Progress: ${counts.ingested}/${rows.length} — ${row.doi}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${row.externalId} — ${msg}`)
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
    console.error(`  WARNING: DB claim count (${dbClaims}) does not match ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
