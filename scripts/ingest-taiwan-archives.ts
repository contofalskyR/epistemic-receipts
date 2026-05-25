// Pipeline 121 — Taiwan ROC National Archives (國家檔案資訊網)
// Dataset: aa.archives.gov.tw — no auth required for public records.
// Scope: Declassified & public ROC government records, colonial-era documents, 1743–present.
// API: server-rendered HTML at /ELK/SimpSearch?q=&PageNow=N&DisplayNumber=20
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-taiwan-archives.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-taiwan-archives.ts --full [--limit N]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'taiwan_archives_v1'
const BASE_URL = 'https://aa.archives.gov.tw'
const SEARCH_URL = `${BASE_URL}/ELK/SimpSearch`
const PAGE_SIZE = 20
const THROTTLE_MS = 600
const DRY_RUN_SAMPLE_COUNT = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface TaiwanRecord {
  numericId: string
  aesId: string
  externalId: string
  sourceUrl: string
  title: string
  organization: string | null
  archiveNumber: string | null
  startDateRaw: string | null
  endDateRaw: string | null
  summary: string | null
  subjects: string[]
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

async function fetchPage(pageNum: number, retries = 3): Promise<string> {
  const url = `${SEARCH_URL}?q=&PageNow=${pageNum}&DisplayNumber=${PAGE_SIZE}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
          'Referer': BASE_URL + '/',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Taiwan Archives HTTP ${res.status} at ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt < retries) {
        console.warn(`  Fetch error attempt ${attempt + 1}: ${err instanceof Error ? err.message : String(err)}`)
        await sleep(delay)
        delay *= 2
      } else {
        throw err
      }
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── ROC date conversion ───────────────────────────────────────────────────────

// Minguo calendar: ROC year 1 = 1912 CE, so ROC N = N + 1911
function parseRocDate(raw: string | null): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }
  const m = raw.match(/民國(\d+)年(\d+)月(\d+)日/)
  if (m) {
    const year = parseInt(m[1], 10) + 1911
    const month = parseInt(m[2], 10)
    const day = parseInt(m[3], 10)
    if (year < 1912 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
      return { date: null, precision: null }
    }
    const d = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
  }
  // Year-month only
  const my = raw.match(/民國(\d+)年(\d+)月/)
  if (my) {
    const year = parseInt(my[1], 10) + 1911
    const month = parseInt(my[2], 10)
    const d = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
  }
  // Year only
  const ym = raw.match(/民國(\d+)年/)
  if (ym) {
    const year = parseInt(ym[1], 10) + 1911
    const d = new Date(`${year}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }
  return { date: null, precision: null }
}

// ── HTML parsing ──────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#xFF0C;/g, '，')
    .replace(/&#x3001;/g, '、')
    .replace(/&#x3002;/g, '。')
    .replace(/&#xFF1B;/g, '；')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#[Xx]([0-9A-Fa-f]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
}

function extractTotalCount(html: string): number {
  const m = html.match(/總共為<span[^>]*>(\d+)<\/span>筆/)
  return m ? parseInt(m[1], 10) : 0
}

function extractRecords(html: string): TaiwanRecord[] {
  const records: TaiwanRecord[] = []

  // Each record has a button with OpenDetailedUrl('AES_ID')
  const aesMatches = [...html.matchAll(/OpenDetailedUrl\('([A-Za-z0-9+/=]+)'\)/g)]
  const seen = new Set<string>()

  for (const match of aesMatches) {
    const aesId = match[1]
    if (seen.has(aesId)) continue
    seen.add(aesId)

    let numericId: string
    try {
      numericId = Buffer.from(aesId, 'base64').toString('utf-8')
    } catch {
      continue
    }
    if (!numericId.match(/^\d{10}$/)) continue

    // Get block of HTML starting at this button occurrence
    const startIdx = match.index ?? 0
    const block = html.slice(startIdx, startIdx + 10000)
    const text = decodeHtmlEntities(stripTags(block))

    // Title: from aria-label attribute (most reliable)
    const titleM = block.match(/aria-label="\[另開視窗\]\s+([^"]{5,400}?)\s+詳細資訊"/)
    const title = titleM ? decodeHtmlEntities(titleM[1].trim()) : ''
    if (!title) continue

    // Organization (全宗名): text between 全宗名 and next structural word
    const orgM = text.match(/全宗名\s+(.{3,80}?)\s+(?:全宗描述|全宗號|檔號|案件|案卷|$)/)
    const organization = orgM ? orgM[1].trim() : null

    // Archive number (檔號): standard Taiwan archives path format
    const archM = text.match(/檔號\s+([A-Z][A-Z0-9]{5,20}\/[^\s]{3,120})/)
    const archiveNumber = archM ? archM[1].trim() : null

    // Date range (起訖日期)
    const dateM = text.match(/起訖日期\s+(民國\d+年\d+月\d+日)(?:\s*~\s*(民國\d+年\d+月\d+日))?/)
    const startDateRaw = dateM ? dateM[1] : null
    const endDateRaw = dateM ? (dateM[2] ?? null) : null

    // Summary (內容摘要): text between 內容摘要 and next section
    const summaryM = text.match(/內容摘要\s+(.{10,2000}?)\s+(?:展開|主題|附註|檔案起訖|$)/)
    const summary = summaryM ? summaryM[1].trim().slice(0, 2000) : null

    // Subjects (主題): comma/space delimited list
    const subjectM = text.match(/主題\s+(.{3,500}?)(?:\s+附註|\s*$)/)
    const subjects = subjectM
      ? subjectM[1].split(/\s+/).filter(s => s.length > 0 && s.length < 50).slice(0, 10)
      : []

    const { date, precision } = parseRocDate(startDateRaw)

    const externalId = `taiwan_archives_${numericId}`
    const sourceUrl = `${BASE_URL}/ELK/SearchDetailed?SystemID=${encodeURIComponent(aesId)}`

    // Build claim text
    const parts: string[] = []
    if (organization) parts.push(organization)
    if (archiveNumber) parts.push(`檔號 ${archiveNumber}`)
    if (startDateRaw) parts.push(`起訖 ${startDateRaw}${endDateRaw ? ` ~ ${endDateRaw}` : ''}`)
    const suffix = parts.length > 0 ? ` — ${parts.join('，')}` : ''
    const claimText = `「${title}」${suffix}`

    records.push({
      numericId,
      aesId,
      externalId,
      sourceUrl,
      title,
      organization,
      archiveNumber,
      startDateRaw,
      endDateRaw,
      summary,
      subjects,
      date,
      datePrecision: precision,
      claimText,
    })
  }

  return records
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
  rec: TaiwanRecord,
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
      externalId: `taiwan_archives_source_${rec.numericId}`,
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
        numericId: rec.numericId,
        organization: rec.organization,
        archiveNumber: rec.archiveNumber,
        startDateRaw: rec.startDateRaw,
        endDateRaw: rec.endDateRaw,
        summary: rec.summary,
        subjects: rec.subjects,
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
      reason: 'Taiwan ROC National Archives — public declassified government record, HARD_FACT',
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

  console.log(`\n── Pipeline 121: Taiwan ROC National Archives ────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | DisplayNumber: ${PAGE_SIZE}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Fetching sample records (no DB writes)...')

    const html = await fetchPage(1)
    const totalCount = extractTotalCount(html)
    const records = extractRecords(html)

    console.log(`\n  Total records in archive (API): ${totalCount.toLocaleString()}`)
    console.log(`  Candidates on page 1: ${records.length}`)

    const sample = records.slice(0, DRY_RUN_SAMPLE_COUNT)

    console.log('\nSample records:')
    for (const r of sample.slice(0, 10)) {
      console.log(`  [${r.numericId}] ${r.startDateRaw ?? 'no-date'} | ${r.organization ?? 'no-org'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      apiBase: SEARCH_URL,
      totalFromApi: totalCount,
      candidatesFetched: records.length,
      sample: sample.map(r => ({
        numericId: r.numericId,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        title: r.title,
        organization: r.organization,
        archiveNumber: r.archiveNumber,
        startDateRaw: r.startDateRaw,
        endDateRaw: r.endDateRaw,
        summary: r.summary ? r.summary.slice(0, 200) : null,
        subjects: r.subjects.slice(0, 5),
        date: r.date?.toISOString() ?? null,
        datePrecision: r.datePrecision,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-121-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-121-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'taiwan-roc-archives',
    'Taiwan ROC National Archives',
    'archives',
  )

  console.log('\nStep 2: Fetching and ingesting records...')

  const maxRecords = limit > 0 ? limit : 10000  // API caps results at 10k per empty-keyword query
  const maxPages = Math.ceil(maxRecords / PAGE_SIZE)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  let totalFetched = 0

  for (let page = 1; page <= maxPages; page++) {
    if (totalFetched >= maxRecords) break

    console.log(`  Page ${page}/${maxPages} — fetched ${totalFetched}, ingested ${counts.ingested}`)

    let html: string
    try {
      html = await fetchPage(page)
    } catch (err) {
      console.error(`  Failed to fetch page ${page}: ${err instanceof Error ? err.message : String(err)}`)
      counts.errors++
      continue
    }

    if (page === 1) {
      const total = extractTotalCount(html)
      console.log(`  Total records in archive: ${total.toLocaleString()}`)
    }

    const records = extractRecords(html)
    if (records.length === 0) {
      console.log('  No records on this page — stopping.')
      break
    }

    for (const rec of records) {
      if (totalFetched >= maxRecords) break
      totalFetched++

      try {
        const result = await prisma.$transaction(
          async (tx) => writeRow(tx, rec, [rootTopicId]),
          { timeout: 30000 },
        )
        if (result === 'ingested') counts.ingested++
        else if (result === 'skipped') counts.skipped++
        else counts.errors++

        if (verbose || counts.ingested % 200 === 0) {
          console.log(`  Progress: ${counts.ingested} ingested — ${rec.numericId} — ${rec.title.slice(0, 60)}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: ${rec.externalId} — ${msg}`)
        counts.errors++
      }
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
