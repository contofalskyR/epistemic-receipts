// Pipeline 77 — Malta Acts (malta_legislation_v1)
// Dataset: Legislation Malta — Laws of Malta (legislation.mt)
// Source: https://legislation.mt/legislation (ELI-compliant portal, English + Maltese)
// Run: npx tsx scripts/ingest-malta-legislation.ts --dry-run
//      npx tsx scripts/ingest-malta-legislation.ts --sample 10
//      npx tsx scripts/ingest-malta-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'malta_legislation_v1'
const PIPELINE = 'Pipeline 77'
const BASE_URL = 'https://legislation.mt'
const LEGISLATION_PAGE = 'https://legislation.mt/Legislation'
const API_URL = 'https://legislation.mt/Legislations/LegislationPartial'
const CULTURE_URL = 'https://legislation.mt/Multilingual/SetCulture'
const REQUEST_DELAY_MS = 1000

// ── Types ──────────────────────────────────────────────────────────────────────

interface MaltaApiRow {
  ID: string
  ChapterText: string   // e.g. "Kap. 9" or "Cap. 9"
  ChapterTitle: string  // act title (language depends on session culture)
  URL: string           // e.g. "eli/cap/9/mlt" or "eli/cap/9/eng"
  HasChildren: boolean
}

interface MaltaApiResponse {
  draw: number
  recordsTotal: number
  recordsFiltered: number
  data: MaltaApiRow[]
}

interface CandidateRecord {
  chapterNo: string
  title: string
  status: 'In Force' | 'Repealed' | 'Unknown'
  year: number
  publishedAt: Date
  pubDateStr: string
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

// ── HTTP via curl (avoids Node.js slow-start timeout on legislation.mt) ────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

const COOKIE_JAR = '/tmp/malta-legislation-cookies.txt'

function curlGet(url: string): string {
  return execSync(
    `curl -s -m 30 -L -A "Mozilla/5.0 (compatible; EpistemicReceipts/1.0)" ` +
    `-b "${COOKIE_JAR}" -c "${COOKIE_JAR}" ` +
    `-H "Accept-Language: en-GB,en;q=0.9" ` +
    `"${url}"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
}

function curlPost(url: string, data: string, referer: string): string {
  // Write data to temp file to avoid shell quoting issues
  const tmpData = '/tmp/malta-post-data.txt'
  fs.writeFileSync(tmpData, data, 'utf-8')
  return execSync(
    `curl -s -m 30 -A "Mozilla/5.0 (compatible; EpistemicReceipts/1.0)" ` +
    `-b "${COOKIE_JAR}" -c "${COOKIE_JAR}" ` +
    `-H "Content-Type: application/x-www-form-urlencoded" ` +
    `-H "X-Requested-With: XMLHttpRequest" ` +
    `-H "Referer: ${referer}" ` +
    `--data "@${tmpData}" ` +
    `"${url}"`,
    { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }
  )
}

function extractCsrfToken(html: string): string {
  const m = html.match(/__RequestVerificationToken[^>]*value="([^"]+)"/)
  if (!m) throw new Error('CSRF token not found in page HTML')
  return m[1]
}

// ── Malta API ──────────────────────────────────────────────────────────────────

function initSession(): string {
  // Fresh cookie jar
  if (fs.existsSync(COOKIE_JAR)) fs.unlinkSync(COOKIE_JAR)
  const html = curlGet(LEGISLATION_PAGE)
  if (!html.includes('__RequestVerificationToken')) {
    throw new Error('Legislation page did not contain CSRF token')
  }
  return extractCsrfToken(html)
}

function fetchPageFromApi(start: number, length: number, draw: number, csrfToken: string): MaltaApiResponse {
  const params = new URLSearchParams({
    '__RequestVerificationToken': csrfToken,
    draw: String(draw),
    start: String(start),
    length: String(length),
    'search[value]': '',
    'search[ChapterString]': '',
    'search[TitleString]': '',
    'search[ColumnString]': 'Kapitolu',
    'order[0][column]': '1',
    'order[0][dir]': 'asc',
  })

  const raw = curlPost(API_URL, params.toString(), LEGISLATION_PAGE)
  if (!raw.trimStart().startsWith('{')) {
    throw new Error(`API returned non-JSON (first 100 chars): ${raw.slice(0, 100)}`)
  }
  return JSON.parse(raw) as MaltaApiResponse
}

async function fetchAllFromApi(csrfToken: string): Promise<MaltaApiRow[]> {
  // First request to get total count
  const first = fetchPageFromApi(0, 50, 1, csrfToken)
  const total = first.recordsFiltered
  console.log(`  API total: ${total}`)

  const rows: MaltaApiRow[] = [...first.data]

  // Fetch remaining pages
  let draw = 2
  for (let start = 50; start < total; start += 50) {
    await sleep(REQUEST_DELAY_MS)
    const page = fetchPageFromApi(start, 50, draw++, csrfToken)
    rows.push(...page.data)
    process.stdout.write(`  ${rows.length}/${total} fetched...\r`)
  }
  if (rows.length > 50) console.log()

  return rows
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n))).replace(/\s+/g, ' ').trim()
}

function extractYear(title: string): number {
  const m = title.match(/\b(19[0-9]{2}|20[0-9]{2})\b/)
  if (m) return parseInt(m[1], 10)
  return 2000
}

function parseApiRows(rows: MaltaApiRow[]): CandidateRecord[] {
  const records: CandidateRecord[] = []
  const seen = new Set<string>()

  for (const row of rows) {
    // Extract chapter number from ChapterText: "Cap. 9", "Kap. 9", "Cap. 9A"
    const capMatch = row.ChapterText.match(/(?:Cap|Kap)\.\s*(\S+)/i)
    if (!capMatch && row.ChapterText !== 'Kostituzzjoni' && row.ChapterText !== 'RLS') {
      // Skip non-cap entries we can't identify
      continue
    }

    const rawCap = capMatch ? capMatch[1] : row.ChapterText
    const chapterNo = rawCap.replace(/\(R\)$/, '').trim()  // strip (R) repealed marker
    const externalId = `mt_cap_${chapterNo.toLowerCase().replace(/[^a-z0-9]/g, '_')}`

    if (seen.has(externalId)) continue
    seen.add(externalId)

    // Clean title — may have HTML tags
    const title = stripHtml(row.ChapterTitle).replace(/<BR>\s*<I>.*$/i, '').trim()
    if (!title || title.length < 3) continue

    // Status from (R) suffix or title hints
    const isRepealed = /\(R\)/i.test(row.ChapterText) || /imħassar|imħassra|repealed/i.test(row.ChapterTitle)
    const status: CandidateRecord['status'] = isRepealed ? 'Repealed' : 'In Force'

    // Build English ELI URL (swap /mlt to /eng)
    const engUrl = row.URL.replace(/\/mlt$/, '/eng').replace(/^eli\//, '')
    const sourceUrl = `${BASE_URL}/eli/${engUrl.startsWith('cap/') ? engUrl : row.URL.replace(/^eli\//, '')}`

    const year = extractYear(title)
    const publishedAt = new Date(`${year}-01-01T00:00:00Z`)
    const pubDateStr = `${year}-01-01`

    records.push({
      chapterNo, title, status, year, publishedAt, pubDateStr,
      externalId,
      sourceExternalId: `${externalId}_src`,
      sourceUrl,
    })
  }

  return records
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, _verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Initialising session (setting culture to en-GB)...')
  const csrfToken = await initSession()
  console.log('  Session ready. Fetching legislation list from API...')

  const apiRows = await fetchAllFromApi(600, csrfToken)
  console.log(`  Raw API rows: ${apiRows.length}`)

  let candidates = parseApiRows(apiRows)
  if (limit > 0) candidates = candidates.slice(0, limit)

  console.log(`    ${candidates.length} candidates parsed`)
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
        name: `Laws of Malta — ${rec.title.slice(0, 100)}`,
        url: rec.sourceUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const statusNote = rec.status === 'Repealed' ? ' (repealed)' : rec.status === 'Subsidiary' ? ' (subsidiary legislation)' : ''
    const claimText = `Malta enacted Chapter ${rec.chapterNo} of the Laws of Malta: ${rec.title}${statusNote}.`

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
          chapterNo: rec.chapterNo,
          title: rec.title,
          status: rec.status,
          year: rec.year,
          country: 'Malta',
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

  console.log(`\n── ${PIPELINE}: Malta Acts ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('parliament-malta', 'Parliament of Malta', 'government', 'gov-region-europe')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Malta acts from legislation.mt...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  if (allCandidates.length === 0) {
    console.error('\nERROR: No candidates parsed — check HTML structure of legislation.mt and update parsing logic.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const byStatus: Record<string, number> = {}
    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const sample = allCandidates.slice(0, 15).map(r => ({
      chapterNo: r.chapterNo,
      title: r.title,
      status: r.status,
      year: r.year,
      externalId: r.externalId,
      claimText: `Malta enacted Chapter ${r.chapterNo} of the Laws of Malta: ${r.title}.`,
      sourceUrl: r.sourceUrl,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byStatus, byDecade },
      sample,
    }

    fs.writeFileSync('pipeline-77-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-77-dry-run-sample.json')

    console.log('\nDistribution by status:')
    Object.entries(byStatus).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${s}: ${n}`))
    console.log('\nDistribution by decade:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0])).forEach(([d, n]) => console.log(`  ${d}: ${n}`))
    console.log('\nSample (first 5):')
    allCandidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [Cap. ${r.chapterNo}] ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''} (${r.status})`)
    )
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
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
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

  if (mode === 'sample') console.log('\nAwaiting explicit go-ahead before full run.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
