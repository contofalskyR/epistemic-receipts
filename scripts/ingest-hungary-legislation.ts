// Pipeline 108 — Hungary Legislation (Full Corpus)
// Dataset: Nemzeti Jogszabálytár (National Legal Repository) — njt.jog.gov.hu
//          All Hungarian legislation (acts, decrees, resolutions, etc.) ~71,954 records.
// Source:  https://njt.jog.gov.hu/search/-:-:-:-/{page}/50 — blank-search lists all laws
// Approach: Paginated HTML scrape of AngularJS SSR output (~1,440 pages at 50/page)
//           -:-:-:-  = empty search token = list everything
// Topic:   hu-legislation (domain=government)
// Run:     set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-hungary-legislation.ts --dry-run
//          ... --sample N
//          ... --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'hungary_legislation_v1'
const PIPELINE = 'Pipeline 108'
const BASE_URL = 'https://njt.jog.gov.hu'
// -:-:-:- = empty search token — lists all legislation in the NJT corpus
const SEARCH_BASE = `${BASE_URL}/search/-:-:-:-`
const PAGE_SIZE = 50
const PAGE_DELAY_MS = 500

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  title: string
  description: string
  year: number
  actNumber: string
  urlId: string
  status: 'in_force' | 'not_in_force' | 'future' | 'unknown'
  dateText: string
  enactedDate: Date
  enactedPrecision: 'DAY' | 'YEAR'
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  claimText: string
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--verbose]')
        process.exit(1) as never
      })()
  const sai = args.indexOf('--sample')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '5', 10) || 5) : 5,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchPage(page: number, retries = 3): Promise<string> {
  const url = `${SEARCH_BASE}/${page}/${PAGE_SIZE}`
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; epistemic-receipts-pipeline/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'hu,en',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
      return res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      console.warn(`  Network error: ${err instanceof Error ? err.message : err} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

// Extract total page count from pagination markup: <span id="page-count">/ N</span>
function parseTotalPages(html: string): number {
  const m = html.match(/id="page-count">\s*\/\s*(\d+)/)
  return m ? parseInt(m[1], 10) : 0
}

// Extract total record count from AngularJS init call: initResult('N', ...)
function parseTotalRecords(html: string): number {
  const m = html.match(/initResult\('(\d+)'/)
  return m ? parseInt(m[1], 10) : 0
}

// Parse Hungarian date format: "YYYY. MM. DD." → Date
// Falls back to year-level precision when no day/month available
function parseHungarianDate(dateText: string, urlYear: number): { date: Date; precision: 'DAY' | 'YEAR' } {
  // resultDate span contains e.g. "2025. 01. 01. – " or "2012. 01. 01. – 2013. 03. 31."
  // Extract the START date (first occurrence of YYYY. MM. DD.)
  const m = dateText.match(/(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\./)
  if (m) {
    const [, yyyy, mm, dd] = m
    const d = new Date(`${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}T00:00:00Z`)
    if (!isNaN(d.getTime())) return { date: d, precision: 'DAY' }
  }
  return { date: new Date(`${urlYear}-01-01T00:00:00Z`), precision: 'YEAR' }
}

function parseStatusFromBlock(block: string): 'in_force' | 'not_in_force' | 'future' | 'unknown' {
  // Status icon appears near the top of each resultItemWrapper block
  const iconSection = block.slice(0, 600)
  if (iconSection.includes('color-positive-1000')) return 'in_force'
  if (iconSection.includes('color-CD2A3E')) return 'not_in_force'
  if (iconSection.includes('color-informative-1000')) return 'future'
  return 'unknown'
}

function parsePage(html: string): CandidateRecord[] {
  const records: CandidateRecord[] = []

  // Each result block starts with <div class="resultItemWrapper">
  const blocks = html.split('<div class="resultItemWrapper">')

  for (const block of blocks.slice(1)) {
    // URL ID from href="jogszabaly/{urlId}" — the first (canonical, non-versioned) href
    const urlMatch = block.match(/href="jogszabaly\/([^".]+)"/)
    if (!urlMatch) continue
    const urlId = urlMatch[1]

    // Year and act number from URL ID (e.g. "2024-69-02-00" → year=2024, actNumber=69)
    const urlParts = urlId.match(/^(\d{4})-(\d+)-/)
    if (!urlParts) continue
    const year = parseInt(urlParts[1], 10)
    const actNumber = urlParts[2]

    // Title from the bold result link — can be class "now", "past", or "future"
    const titleMatch = block.match(/class="(?:now|past|future) text-medium font-bold[^"]*"[^>]*>([^<]+)</)
    if (!titleMatch) continue
    const title = titleMatch[1].trim()
    if (!title) continue

    // Date range from resultDate span
    const dateMatch = block.match(/class="resultDate text-xsmall"[^>]*>\s*([^<]+?)\s*<\/span>/)
    const dateText = dateMatch ? dateMatch[1].trim() : ''

    // Short description from <p class="text-small"> (gazette date or subtitle)
    const descMatch = block.match(/<p\s+class="text-small">([^<]+)<\/p>/)
    const rawDescription = descMatch ? descMatch[1].trim() : ''
    // Strip parenthesised-date-only entries like "(2024. december 17.)" that are just gazette dates
    const description = rawDescription.replace(/^\([^)]+\)\s*$/, '').trim()

    const { date: enactedDate, precision: enactedPrecision } = parseHungarianDate(dateText, year)
    const status = parseStatusFromBlock(block)

    const sourceUrl = `${BASE_URL}/jogszabaly/${urlId}`
    const externalId = `hungary_legislation_${urlId}`
    const sourceExternalId = `hungary_legislation_src_${urlId}`
    const sourceName = `Hungary: ${title}`
    const claimText = description ? `${title} ${description}` : title

    records.push({
      title,
      description,
      year,
      actNumber,
      urlId,
      status,
      dateText,
      enactedDate,
      enactedPrecision,
      sourceUrl,
      externalId,
      sourceExternalId,
      sourceName,
      claimText,
    })
  }

  return records
}

// ── Fetch all records ──────────────────────────────────────────────────────────

async function fetchAllRecords(verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Fetching page 1 to determine page count...')
  const firstHtml = await fetchPage(1)
  const totalPages = parseTotalPages(firstHtml)
  const totalRecords = parseTotalRecords(firstHtml)
  if (totalPages === 0) throw new Error('Could not detect page count — site layout may have changed')
  console.log(`  Total records: ${totalRecords} across ${totalPages} pages (${PAGE_SIZE}/page)`)

  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()

  const addRecords = (recs: CandidateRecord[]) => {
    for (const rec of recs) {
      if (!seenIds.has(rec.externalId)) {
        seenIds.add(rec.externalId)
        all.push(rec)
      }
    }
  }

  addRecords(parsePage(firstHtml))

  for (let page = 2; page <= totalPages; page++) {
    await sleep(PAGE_DELAY_MS)
    if (verbose) {
      console.log(`  Fetching page ${page}/${totalPages}...`)
    } else {
      process.stdout.write(`  Fetching page ${page}/${totalPages}...\r`)
    }
    const html = await fetchPage(page)
    addRecords(parsePage(html))
  }

  process.stdout.write('\n')
  return all
}

// ── Fetch only first N records (for dry-run / sample) ─────────────────────────

async function fetchFirstNRecords(n: number): Promise<{ records: CandidateRecord[]; totalRecords: number; totalPages: number }> {
  console.log('  Fetching page 1...')
  const firstHtml = await fetchPage(1)
  const totalPages = parseTotalPages(firstHtml)
  const totalRecords = parseTotalRecords(firstHtml)
  console.log(`  Total records: ${totalRecords} across ${totalPages} pages`)

  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()

  const addRecords = (recs: CandidateRecord[]) => {
    for (const rec of recs) {
      if (!seenIds.has(rec.externalId)) {
        seenIds.add(rec.externalId)
        all.push(rec)
      }
    }
  }

  addRecords(parsePage(firstHtml))

  let page = 2
  while (all.length < n && page <= totalPages) {
    await sleep(PAGE_DELAY_MS)
    const html = await fetchPage(page)
    addRecords(parsePage(html))
    page++
  }

  return { records: all, totalRecords, totalPages }
}

// ── Topic management ───────────────────────────────────────────────────────────

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

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: rec.enactedPrecision,
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          year: rec.year,
          actNumber: rec.actNumber,
          urlId: rec.urlId,
          status: rec.status,
          dateText: rec.dateText,
          sourceUrl: rec.sourceUrl,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
      },
    })

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Hungary Legislation (Full Corpus) ──────────────────────`)
  console.log(`Mode: ${mode}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('hu-legislation', 'Hungarian Legislation', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 2: Fetching first page to sample full Hungarian corpus from njt.jog.gov.hu...')
    const { records: candidates, totalRecords, totalPages } = await fetchFirstNRecords(15)
    console.log(`Fetched ${candidates.length} candidates (of ${totalRecords} total across ${totalPages} pages)`)

    const byStatus = candidates.reduce((acc, r) => {
      acc[r.status] = (acc[r.status] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)
    console.log(`  Status breakdown (sample): ${JSON.stringify(byStatus)}`)

    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      year: r.year,
      actNumber: r.actNumber,
      urlId: r.urlId,
      status: r.status,
      dateText: r.dateText,
      enactedDate: r.enactedDate.toISOString().slice(0, 10),
      enactedPrecision: r.enactedPrecision,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: totalRecords,
      totalPages,
      statusBreakdown: byStatus,
      sample,
    }

    fs.writeFileSync('pipeline-108-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-108-dry-run-sample.json')

    console.log('\nSample titles:')
    candidates.slice(0, 10).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.year}/${r.actNumber}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
    )

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  let candidates: CandidateRecord[]
  let totalRecords = 0

  if (mode === 'sample') {
    console.log(`\nStep 2: Fetching first ${sampleN} records from njt.jog.gov.hu...`)
    const result = await fetchFirstNRecords(sampleN)
    candidates = result.records.slice(0, sampleN)
    totalRecords = result.totalRecords
    console.log(`Fetched ${candidates.length} records (of ${totalRecords} total)`)
  } else {
    console.log('\nStep 2: Fetching ALL Hungarian legislation from njt.jog.gov.hu...')
    candidates = await fetchAllRecords(verbose)
    totalRecords = candidates.length
    console.log(`Total candidates: ${candidates.length}`)
  }

  const byStatus = candidates.reduce((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
  console.log(`  Status: ${JSON.stringify(byStatus)}`)

  const rows = candidates

  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
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

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
