// Pipeline 64 — Pakistan Acts (pakistan_legislation_v1)
// Dataset: Pakistan Code — consolidated federal legislation (pakistancode.gov.pk)
// Source: HTML listing from the Pakistan Code, Attorney General's office
// NOTE: The Pakistan Code server (175.107.60.206) is geo-restricted and may only
//       be accessible from Pakistan IP space. Run from a Pakistani network or VPN if needed.
// Run: npx tsx scripts/ingest-pakistan-legislation.ts --dry-run
//      npx tsx scripts/ingest-pakistan-legislation.ts --sample 10
//      npx tsx scripts/ingest-pakistan-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'

const prisma = new PrismaClient()

const INGESTED_BY = 'pakistan_legislation_v1'
const PIPELINE = 'Pipeline 64'
const BASE_URL = 'https://www.pakistancode.gov.pk'
const LISTING_URL = `${BASE_URL}/`
const REQUEST_DELAY_MS = 1000

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  title: string
  actNumber: string
  year: number
  actDetailUrl: string
  externalId: string
  sourceExternalId: string
  publishedAt: Date
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

function httpGetRaw(
  url: string,
  timeoutMs: number,
  useTls: boolean,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const mod = useTls ? https : http
    const req = (mod as typeof https).get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: useTls ? 443 : 80,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'close',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const loc = res.headers.location
          const nextUrl = loc.startsWith('http') ? loc : `${useTls ? 'https' : 'http'}://${parsed.hostname}${loc}`
          res.resume()
          httpGetRaw(nextUrl, timeoutMs, nextUrl.startsWith('https')).then(resolve).catch(reject)
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

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return httpGetRaw(url, timeoutMs, true)
}

async function fetchHtml(url: string, retries = 2): Promise<string | null> {
  let delay = 3000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, 20_000)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status === 200) return res.body
      console.warn(`  HTTP ${res.status} for ${url}`)
      return null
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (attempt >= retries) {
        console.error(`  Connection failed: ${msg}`)
        return null
      }
      console.warn(`  Error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  return null
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim()
}

function slugifyActNo(actNo: string): string {
  return actNo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function extractYear(text: string): number {
  const m = text.match(/\b(19\d{2}|20\d{2})\b/)
  return m ? parseInt(m[1], 10) : new Date().getFullYear()
}

// Parse acts from a typical HTML listing table with columns: Act, Title, Year/Status
// The Pakistan Code uses a <table> with <tr><td> rows.
function parseActsFromHtml(html: string, pageBaseUrl: string): CandidateRecord[] {
  const records: CandidateRecord[] = []

  // Look for table rows containing act entries
  // Typical structure: <tr><td>Act No</td><td><a href="...">Title</a></td><td>Year</td></tr>
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const row = rowMatch[1]

    // Skip header rows
    if (/<th/i.test(row)) continue

    // Extract cells
    const cellRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi
    const cells: string[] = []
    let cellMatch: RegExpExecArray | null
    while ((cellMatch = cellRegex.exec(row)) !== null) {
      cells.push(cellMatch[1])
    }
    if (cells.length < 2) continue

    // Try to find the title cell (one with an anchor link)
    let title = ''
    let actDetailUrl = pageBaseUrl
    let actNumber = ''

    for (const cell of cells) {
      const aMatch = cell.match(/<a\s+href="([^"]+)"[^>]*>([^<]+)<\/a>/i)
      if (aMatch) {
        const href = aMatch[1]
        title = aMatch[2].trim()
        actDetailUrl = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`
        break
      }
    }

    if (!title) {
      // Try plain text title from any cell
      const plainTitle = stripHtml(cells[0] ?? '')
      if (plainTitle && plainTitle.length > 5 && /act|ord|code/i.test(plainTitle)) {
        title = plainTitle
      }
    }

    if (!title || title.length < 3) continue

    // Act number: look for a cell that looks like "Act No N" or just "N" or "YYYY/N"
    for (const cell of cells) {
      const plain = stripHtml(cell)
      const numMatch = plain.match(/^(\d+)$|^(act\s*\d+)/i)
      if (numMatch) { actNumber = plain; break }
    }

    if (!actNumber) {
      // Try to extract from title or URL
      const urlActMatch = actDetailUrl.match(/\/(\d+)(?:\/|$)/)
      if (urlActMatch) actNumber = urlActMatch[1]
      else {
        const titleNumMatch = title.match(/\b(\d{4})\b/)
        actNumber = titleNumMatch ? titleNumMatch[1] : title.slice(0, 20).replace(/\s+/g, '-').toLowerCase()
      }
    }

    const year = extractYear(title)
    const publishedAt = new Date(`${year}-01-01T00:00:00Z`)
    const slug = slugifyActNo(actNumber)
    const yearSlug = String(year)

    records.push({
      title,
      actNumber,
      year,
      actDetailUrl,
      externalId: `pk_act_${yearSlug}_${slug}`,
      sourceExternalId: `pk_act_src_${yearSlug}_${slug}`,
      publishedAt,
    })
  }

  return records
}

// Also try to extract from unstructured link lists (some Pakistani sites use <ul><li><a>)
function parseActsFromLinks(html: string): CandidateRecord[] {
  const records: CandidateRecord[] = []
  // Find links that look like legislation (title + /acts/ URL pattern)
  const linkRegex = /<a\s+href="([^"]*(?:act|law|ord|code|legislation)[^"]*)"[^>]*>([^<]{10,200})<\/a>/gi
  let m: RegExpExecArray | null
  const seen = new Set<string>()

  while ((m = linkRegex.exec(html)) !== null) {
    const href = m[1]
    const text = m[2].trim()
    if (!text || seen.has(text.toLowerCase())) continue
    seen.add(text.toLowerCase())

    // Filter out nav/menu items
    if (/home|about|contact|search|login|help|menu|nav/i.test(text)) continue
    if (text.length < 8) continue

    const url = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`
    const year = extractYear(text)
    const actNoMatch = href.match(/\/(\d+)(?:\/|$)/) ?? text.match(/\b(\d{4,6})\b/)
    const actNumber = actNoMatch ? actNoMatch[1] : text.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '-')

    const slug = slugifyActNo(actNumber)
    const yearSlug = String(year)

    records.push({
      title: text,
      actNumber,
      year,
      actDetailUrl: url,
      externalId: `pk_act_${yearSlug}_${slug}`,
      sourceExternalId: `pk_act_src_${yearSlug}_${slug}`,
      publishedAt: new Date(`${year}-01-01T00:00:00Z`),
    })
  }

  return records
}

// Deduplicate by externalId
function dedup(records: CandidateRecord[]): CandidateRecord[] {
  const seen = new Set<string>()
  return records.filter(r => {
    if (seen.has(r.externalId)) return false
    seen.add(r.externalId)
    return true
  })
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []

  console.log(`  Fetching Pakistan Code listing: ${LISTING_URL}`)
  const mainHtml = await fetchHtml(LISTING_URL)

  if (!mainHtml) {
    console.error(
      '\n  ERROR: Could not reach www.pakistancode.gov.pk.\n' +
      '  The server at 175.107.60.206 appears geo-restricted (100% packet loss from outside Pakistan).\n' +
      '  Re-run this script from a Pakistani IP address or VPN endpoint.\n'
    )
    return []
  }

  console.log(`  Received ${mainHtml.length} bytes from main page`)

  // Try table-based parsing first
  let parsed = parseActsFromHtml(mainHtml, LISTING_URL)
  if (parsed.length < 5) {
    // Fall back to link extraction
    parsed = parseActsFromLinks(mainHtml)
  }

  console.log(`  Extracted ${parsed.length} acts from main page`)

  // Look for pagination links or "Acts" sub-listing URLs
  const paginationLinks: string[] = []
  const pageRegex = /href="([^"]*(?:page=\d+|acts\/\d+|&p=\d+)[^"]*)"/gi
  let pm: RegExpExecArray | null
  while ((pm = pageRegex.exec(mainHtml)) !== null) {
    const href = pm[1]
    const url = href.startsWith('http') ? href : `${BASE_URL}/${href.replace(/^\//, '')}`
    if (!paginationLinks.includes(url)) paginationLinks.push(url)
  }

  for (const rec of parsed) {
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) break
  }

  // Fetch additional pages if pagination found
  if (paginationLinks.length > 0 && (limit === 0 || candidates.length < limit)) {
    console.log(`  Found ${paginationLinks.length} additional listing pages`)
    for (const pageUrl of paginationLinks) {
      if (limit > 0 && candidates.length >= limit) break
      await sleep(REQUEST_DELAY_MS)
      if (verbose) console.log(`  Fetching: ${pageUrl}`)
      const pageHtml = await fetchHtml(pageUrl)
      if (!pageHtml) continue
      const more = parseActsFromHtml(pageHtml, pageUrl)
      for (const rec of more) {
        candidates.push(rec)
        if (limit > 0 && candidates.length >= limit) break
      }
    }
  }

  const deduped = dedup(candidates)
  console.log(`  ${deduped.length} candidates after dedup (from ${candidates.length} raw)`)
  return deduped
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
        name: `Pakistan Code — ${rec.title.slice(0, 100)}`,
        url: rec.actDetailUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Pakistan enacted ${rec.title} (${rec.actNumber}, ${rec.year}).`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.publishedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          title: rec.title,
          actNumber: rec.actNumber,
          year: rec.year,
          country: 'Pakistan',
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

  console.log(`\n── ${PIPELINE}: Pakistan Acts ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic(
      'parliament-of-pakistan',
      'Parliament of Pakistan (Majlis-e-Shoora)',
      'government',
      'gov-region-asia-pacific',
    )
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Pakistan acts from pakistancode.gov.pk...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  if (allCandidates.length === 0) {
    console.log('\nNo candidates found — the site may be unreachable from this network.')
    console.log('Re-run from a Pakistan-accessible IP address.')
    if (mode === 'dry-run') {
      const output = {
        runDate: new Date().toISOString(),
        pipeline: PIPELINE,
        ingestedBy: INGESTED_BY,
        totalCandidates: 0,
        error: 'Site unreachable — geo-restricted (Pakistan IP required)',
        note: 'www.pakistancode.gov.pk (175.107.60.206) has 100% packet loss from outside Pakistan.',
      }
      fs.writeFileSync('pipeline-64-dry-run-sample.json', JSON.stringify(output, null, 2))
      console.log('  Written: pipeline-64-dry-run-sample.json (empty/error stub)')
    }
    return
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      actNumber: r.actNumber,
      title: r.title,
      year: r.year,
      externalId: r.externalId,
      claimText: `Pakistan enacted ${r.title} (${r.actNumber}, ${r.year}).`,
      sourceUrl: r.actDetailUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      const decade = Math.floor(r.year / 10) * 10 + 's'
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byDecade },
      sample,
    }

    fs.writeFileSync('pipeline-64-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-64-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nSample (first 5):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year}] ${r.actNumber}: ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''}`)
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
