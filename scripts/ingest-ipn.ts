// Pipeline 119 — IPN (Polish Institute of National Remembrance) Archival Inventory
// Dataset: inwentarz.ipn.gov.pl — Communist-era SB/UB security service files, ~2.98M records
// Scope: All archival items in the IPN inventory (fonds, series, files)
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-ipn.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-ipn.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'ipn_v1'
const IPN_SEARCH = 'https://inwentarz.ipn.gov.pl/en/search'
const PAGE_SIZE = 10
const THROTTLE_MS = 1200
const DRY_RUN_SAMPLE_COUNT = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface IpnRawRecord {
  nodeId: string
  headerTitle: string
  ipnSignature: string | null
  description: string | null
  dateRange: string | null
}

interface CandidateRecord {
  nodeId: string
  externalId: string
  sourceUrl: string
  title: string
  description: string | null
  ipnSignature: string | null
  dateRange: string | null
  date: Date | null
  datePrecision: string | null
  claimText: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

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

// Cookie jar — pagination requires session cookies from the first response
const cookieJar = new Map<string, string>()

function absorbCookies(headers: Headers): void {
  const setCookies = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie') ?? ''].filter(Boolean)
  for (const raw of setCookies) {
    const [nameValue] = raw.split(';')
    const eq = nameValue.indexOf('=')
    if (eq > 0) cookieJar.set(nameValue.slice(0, eq).trim(), nameValue.slice(eq + 1).trim())
  }
}

function cookieHeader(): string {
  return [...cookieJar.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

async function ipnFetch(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const cookie = cookieHeader()
    const res = await fetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
        ...(cookie ? { 'Cookie': cookie } : {}),
      },
    })
    absorbCookies(res.headers)
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`IPN HTTP ${res.status} at ${url}`)
    return res.text()
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── HTML parsing ──────────────────────────────────────────────────────────────

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function extractLastPage(html: string): number {
  // Pagination links: href="?page=N" — take the maximum page index
  const matches = [...html.matchAll(/[?&]page=(\d+)/g)]
  if (matches.length === 0) return 0
  return Math.max(...matches.map(m => parseInt(m[1], 10)))
}

function extractRecordsFromHtml(html: string): IpnRawRecord[] {
  const records: IpnRawRecord[] = []

  // Split HTML on record boundaries — each record has data-record-id="N"
  // Split with capturing group so odd indices are nodeIds, even indices are chunks
  const chunks = html.split(/class="views-row"\s+data-record-id="(\d+)"/)

  for (let i = 1; i < chunks.length; i += 2) {
    const nodeId = chunks[i]
    const chunk = chunks[i + 1] ?? ''

    // Collection/Fond name shown in the result header
    const headerMatch = chunk.match(/inv-item-content-header__title">([^<]+)</)
    const headerTitle = headerMatch?.[1]?.trim()
    if (!headerTitle) continue

    // Archival description (the "Title" field in the detail row)
    const descMatch = chunk.match(/class="collapse-text collapse" id="id\d+">\s*([^<]+)</)
    const description = descMatch?.[1]?.trim() ?? null

    // IPN archival reference number
    const sigBlock = chunk.match(/IPN signature<\/div>[\s\S]*?<div[^>]*col-12 col-md-9[^>]*>([\s\S]*?)<\/div>/)
    const ipnSignature = sigBlock
      ? stripTags(sigBlock[1]).replace(/\bsee description\b/i, '').trim() || null
      : null

    // Date range (e.g. "1969 - 1988")
    const dateBlock = chunk.match(/Date range<\/div>[\s\S]*?<div[^>]*col-12 col-md-9[^>]*>([\s\S]*?)<\/div>/)
    const dateRange = dateBlock ? stripTags(dateBlock[1]).trim() || null : null

    records.push({ nodeId, headerTitle, ipnSignature, description, dateRange })
  }

  return records
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(raw: string | null): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }

  // "1969 - 1988" or "1969-1988" → use the opening year
  const rangeMatch = raw.match(/(\d{4})\s*[-–]\s*\d{4}/)
  if (rangeMatch) {
    const d = new Date(`${rangeMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  // Single year
  const yearMatch = raw.match(/(\d{4})/)
  if (yearMatch) {
    const d = new Date(`${yearMatch[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

// ── Build candidate ───────────────────────────────────────────────────────────

function buildCandidate(rec: IpnRawRecord): CandidateRecord | null {
  const externalId = `ipn_${rec.nodeId}`
  const sourceUrl = `https://inwentarz.ipn.gov.pl/en/node/${rec.nodeId}`
  const { date, precision } = parseDate(rec.dateRange)

  const parts: string[] = []
  if (rec.ipnSignature) parts.push(rec.ipnSignature)
  if (rec.dateRange) parts.push(rec.dateRange)
  const suffix = parts.length > 0 ? ` — ${parts.join(' | ')}` : ''
  const claimText = `${rec.headerTitle}${suffix}`

  return {
    nodeId: rec.nodeId,
    externalId,
    sourceUrl,
    title: rec.headerTitle,
    description: rec.description?.slice(0, 500) ?? null,
    ipnSignature: rec.ipnSignature,
    dateRange: rec.dateRange,
    date,
    datePrecision: precision,
    claimText,
  }
}

// ── Fetch pages ───────────────────────────────────────────────────────────────

async function fetchAllRecords(maxRecords = 0): Promise<{
  candidates: CandidateRecord[]
  skippedMalformed: number
  totalPages: number
  pagesVisited: number
}> {
  const candidates: CandidateRecord[] = []
  const seenNodeIds = new Set<string>()
  let skippedMalformed = 0
  let totalPages = 1
  let page = 0

  while (page < totalPages) {
    const url = `${IPN_SEARCH}?fraza=&page=${page}`
    console.log(`  Fetching page ${page + 1}/${totalPages === 1 && page === 0 ? '?' : totalPages} — ${url}`)

    const html = await ipnFetch(url)

    if (page === 0) {
      const lastPageIdx = extractLastPage(html)
      totalPages = lastPageIdx + 1
      console.log(`  Total pages: ${totalPages} (~${(totalPages * PAGE_SIZE).toLocaleString()} records)`)
    }

    const recs = extractRecordsFromHtml(html)
    if (recs.length === 0) {
      console.warn(`  No records on page ${page + 1}, stopping`)
      break
    }

    for (const rec of recs) {
      if (seenNodeIds.has(rec.nodeId)) continue
      seenNodeIds.add(rec.nodeId)
      const c = buildCandidate(rec)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (maxRecords > 0 && candidates.length >= maxRecords) break
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break
    page++
  }

  return { candidates, skippedMalformed, totalPages, pagesVisited: page }
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
      externalId: `ipn_source_${rec.nodeId}`,
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
        nodeId: rec.nodeId,
        ipnSignature: rec.ipnSignature,
        dateRange: rec.dateRange,
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
      reason: 'IPN archival inventory — communist-era SB/UB security service files, HARD_FACT',
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

  console.log(`\n── Pipeline 119: IPN — Polish Institute of National Remembrance ─────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all (WARNING: ~2.98M records, use --limit)'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing IPN inventory and sampling records (no DB writes)...')

    const { candidates, skippedMalformed, totalPages } = await fetchAllRecords(DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  Total pages (approx): ${totalPages.toLocaleString()}`)
    console.log(`  Total records (approx): ~${(totalPages * PAGE_SIZE).toLocaleString()}`)
    console.log(`  Candidates fetched: ${candidates.length} (skipped malformed: ${skippedMalformed})`)

    const sample = candidates.slice(0, 20)
    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.nodeId}] ${r.dateRange ?? 'no-date'} | ${r.ipnSignature ?? 'no-sig'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      source: 'https://inwentarz.ipn.gov.pl',
      totalPagesApprox: totalPages,
      totalRecordsApprox: totalPages * PAGE_SIZE,
      candidatesFetched: candidates.length,
      skippedMalformed,
      sample: sample.map(r => ({
        nodeId: r.nodeId,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        title: r.title,
        description: r.description,
        ipnSignature: r.ipnSignature,
        dateRange: r.dateRange,
        datePrecision: r.datePrecision,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-119-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-119-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'ipn-poland',
    'IPN — Polish Institute of National Remembrance',
    'archives',
  )

  console.log('\nStep 2: Fetching records from IPN inventory...')
  const maxFetch = limit > 0 ? limit : 0
  const { candidates, skippedMalformed, totalPages } = await fetchAllRecords(maxFetch)

  console.log(`\nTotal pages: ${totalPages.toLocaleString()} (~${(totalPages * PAGE_SIZE).toLocaleString()} total records)`)
  console.log(`Candidates: ${candidates.length.toLocaleString()} (malformed: ${skippedMalformed})`)

  console.log(`\nStep 3: Ingesting ${candidates.length.toLocaleString()} records...`)
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
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.nodeId} — ${rec.title.slice(0, 60)}`)
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
