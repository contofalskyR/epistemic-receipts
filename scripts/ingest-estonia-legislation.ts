// Pipeline 63 — Estonia Acts (estonia_legislation_v1)
// Dataset: Riigi Teataja (Official Estonian State Gazette) — English translations
// Source: https://www.riigiteataja.ee/en/ (server-side paginated HTML, leht=0…N)
// Run: npx tsx scripts/ingest-estonia-legislation.ts --dry-run
//      npx tsx scripts/ingest-estonia-legislation.ts --sample 10
//      npx tsx scripts/ingest-estonia-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'estonia_legislation_v1'
const PIPELINE = 'Pipeline 63'
const BASE_URL = 'https://www.riigiteataja.ee/en/'
const PAGE_SIZE = 20
const REQUEST_DELAY_MS = 1000

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  code: string          // ELI code string, e.g. "520052026006"
  title: string
  issuer: string
  type: string
  inForceStr: string
  year: number
  pubDateStr: string    // YYYY-MM-DD derived from code
  publishedAt: Date
  externalId: string
  sourceExternalId: string
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGet(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

async function fetchPage(leht: number, retries = 3): Promise<string> {
  const url = `${BASE_URL}?leht=${leht}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, 30_000)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} leht=${leht} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status} for leht=${leht}`)
      return res.body
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error leht=${leht}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at leht=${leht}`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

// ELI code format: 5DDMMYYYYNNN (12 chars)
// e.g. "520052026006" → day=20, month=05, year=2026, seq=006
function parseDateFromCode(code: string): { year: number; pubDateStr: string; publishedAt: Date } | null {
  if (!/^\d+$/.test(code) || code.length < 12) return null
  // Try the 5+DDMMYYYY+NNN format
  const day = code.slice(1, 3)
  const month = code.slice(3, 5)
  const year = code.slice(5, 9)
  const pubDateStr = `${year}-${month}-${day}`
  const publishedAt = new Date(`${pubDateStr}T00:00:00Z`)
  if (isNaN(publishedAt.getTime())) return null
  const y = parseInt(year, 10)
  if (y < 1990 || y > 2100) return null
  return { year: y, pubDateStr, publishedAt }
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function parseTotalResults(html: string): number {
  const m = html.match(/Results:\s*([\d,]+)/)
  if (!m) return 0
  return parseInt(m[1].replace(/,/g, ''), 10)
}

function parsePageRows(html: string): CandidateRecord[] {
  const records: CandidateRecord[] = []

  // Find the tbody section of the data table
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/)
  if (!tbodyMatch) return records

  const tbody = tbodyMatch[1]

  // Match each <tr>...</tr> block
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/g
  let rowMatch: RegExpExecArray | null
  while ((rowMatch = rowRegex.exec(tbody)) !== null) {
    const row = rowMatch[1]

    // Extract the 4 <td> cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/g
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1])
    }
    if (cells.length < 4) continue

    // Cell 0: <a href="URL">Title</a>
    const linkMatch = cells[0].match(/href="([^"]+eli\/ee\/[^"]+act\/(\d+)[^"]+)"[^>]*>([^<]+)</)
    if (!linkMatch) continue

    const sourceUrl = linkMatch[1]
    const code = linkMatch[2]
    const title = linkMatch[3].trim()
    if (!title || !code) continue

    // Parse publication date from code
    const dateInfo = parseDateFromCode(code)
    if (!dateInfo) continue

    // Cell 1: issuer
    const issuer = stripHtml(cells[1])
    // Cell 2: type
    const type = stripHtml(cells[2])
    // Cell 3: in-force date range (may contain \n and dashes)
    const inForceStr = stripHtml(cells[3]).replace(/\s*-\s*/g, '–').trim()

    records.push({
      code,
      title,
      issuer,
      type,
      inForceStr,
      year: dateInfo.year,
      pubDateStr: dateInfo.pubDateStr,
      publishedAt: dateInfo.publishedAt,
      externalId: `ee_act_${code}`,
      sourceExternalId: `ee_act_src_${code}`,
      sourceUrl,
    })
  }

  return records
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Fetching first page to get total...')
  const firstHtml = await fetchPage(0)
  const total = parseTotalResults(firstHtml)
  console.log(`  Total English translations in Riigi Teataja: ${total}`)

  const candidates: CandidateRecord[] = []
  let malformed = 0

  const processPage = (html: string): boolean => {
    const rows = parsePageRows(html)
    for (const rec of rows) {
      candidates.push(rec)
      if (limit > 0 && candidates.length >= limit) return true
    }
    if (rows.length === 0) malformed++
    return false
  }

  if (processPage(firstHtml)) return candidates

  const totalPages = Math.ceil(total / PAGE_SIZE)
  for (let p = 1; p < totalPages; p++) {
    await sleep(REQUEST_DELAY_MS)
    const html = await fetchPage(p)
    if (verbose) process.stdout.write(`  Page ${p + 1}/${totalPages} (${candidates.length} so far)...\r`)
    if (processPage(html)) break
  }

  if (verbose) console.log()
  console.log(`    ${candidates.length} candidates (${malformed} empty pages)`)
  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }

  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
    else console.warn(`  Parent topic ${parentSlug} not found — creating ${slug} without parent`)
  }

  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}${parentTopicId ? ` (parent: ${parentSlug})` : ''}`)
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
        name: `Riigi Teataja — ${rec.title.slice(0, 100)}`,
        url: rec.sourceUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Estonia enacted ${rec.title} on ${rec.pubDateStr}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.publishedAt,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          code: rec.code,
          title: rec.title,
          issuer: rec.issuer,
          type: rec.type,
          year: rec.year,
          country: 'Estonia',
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
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
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Estonia Acts ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic(
      'riigikogu-estonia',
      'Riigikogu (Estonia)',
      'government',
      'gov-region-europe',
    )
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Estonia acts from riigiteataja.ee...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      code: r.code,
      title: r.title,
      issuer: r.issuer,
      type: r.type,
      year: r.year,
      pubDate: r.pubDateStr,
      externalId: r.externalId,
      claimText: `Estonia enacted ${r.title} on ${r.pubDateStr}.`,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byYear: Record<string, number> = {}
    for (const r of allCandidates) {
      byYear[String(r.year)] = (byYear[String(r.year)] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byYear },
      sample,
    }

    fs.writeFileSync('pipeline-63-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-63-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by year (top 10 most recent):')
      Object.entries(byYear).sort((a, b) => parseInt(b[0]) - parseInt(a[0])).slice(0, 10).forEach(([y, n]) =>
        console.log(`  ${y}: ${n}`)
      )
      console.log('\nSample (first 5):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.pubDateStr}] ${r.title.slice(0, 90)}${r.title.length > 90 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(0, sampleN) : allCandidates

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
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
