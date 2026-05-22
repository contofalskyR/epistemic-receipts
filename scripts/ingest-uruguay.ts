// Pipeline 82 — Uruguay Leyes (uruguay_legislation_v1)
// Dataset: IMPO (Centro de Información Oficial) — Leyes de Uruguay
// Source: https://www.impo.com.uy/bases/leyes/{number}-{year}
//
// Each law has a URL with its sequential law number and the year it was promulgated.
// Individual pages are freely accessible for modern laws; older ones may require a subscription.
// Page structure:
//   <h1>Ley N° {number}</h1>
//   <h2>{TITLE IN UPPERCASE}</h2>
//   <h5>Promulgación: DD/MM/YYYY</h5>
//   <h5>Publicación: DD/MM/YYYY</h5>
//
// Scope: Leyes only (not decrees). Law numbers are separate from decree numbers.
// Scan range: law ~16100 (1989) → 20381 (2024); scope filter = 1990+.
//
// Year estimator: piecewise linear interpolation from calibrated anchor points.
// For each law number, we try the estimated year first, then ±1 year.
//
// Run:
//   ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/ingest-uruguay.ts --dry-run
//   ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/ingest-uruguay.ts --sample 20
//   ALLOW_EDITS=true npx ts-node --project tsconfig.scripts.json scripts/ingest-uruguay.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'uruguay_legislation_v1'
const PIPELINE = 'Pipeline 82'
const BASE_URL = 'https://www.impo.com.uy'
const REQUEST_DELAY_MS = 700

// Calibrated anchor points: [lawNumber, year] pairs verified by probing IMPO.
// Piecewise linear interpolation between these gives ±1 year accuracy.
const YEAR_ANCHORS: Array<[number, number]> = [
  [16050, 1989],
  [16150, 1990],
  [16200, 1991],
  [16300, 1992],
  [16500, 1994],
  [16700, 1995],
  [17500, 2002],
  [17800, 2004],
  [18000, 2006],
  [18200, 2007],
  [18500, 2009],
  [19210, 2014],
  [20000, 2021],
  [20381, 2024],
]

const SCAN_START = 16100  // ~1989, scope filter will exclude pre-1990 results
const SCAN_END = 20400    // a few past the known 2024 maximum

function estimateYear(lawNum: number): number {
  if (lawNum <= YEAR_ANCHORS[0][0]) return YEAR_ANCHORS[0][1]
  for (let i = 1; i < YEAR_ANCHORS.length; i++) {
    const [n0, y0] = YEAR_ANCHORS[i - 1]
    const [n1, y1] = YEAR_ANCHORS[i]
    if (lawNum <= n1) {
      return Math.round(y0 + (y1 - y0) * (lawNum - n0) / (n1 - n0))
    }
  }
  const [n0, y0] = YEAR_ANCHORS[YEAR_ANCHORS.length - 2]
  const [n1, y1] = YEAR_ANCHORS[YEAR_ANCHORS.length - 1]
  return Math.round(y1 + (y1 - y0) * (lawNum - n1) / (n1 - n0))
}

interface CandidateRecord {
  lawNumber: number
  year: number
  title: string
  promulgationDate: Date
  promulgationDatePrecision: 'DAY' | 'YEAR'
  rawDate: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--start-from N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')
  const sfi = args.indexOf('--start-from')
  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '20', 10) || 20) : 20,
    startFrom: sfi !== -1 ? (parseInt(args[sfi + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(url: string, timeoutMs = 25000): Promise<{ body: string; status: number }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'es-UY,es;q=0.9',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          httpsGet(new URL(res.headers.location, url).toString(), timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          resolve({ body: Buffer.concat(chunks).toString('latin1'), status: res.statusCode ?? 0 })
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out: ${url}`)) })
    req.on('error', reject)
    req.end()
  })
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

// Parse a law page HTML. Returns null if not a valid law page.
function parseLawPage(html: string, lawNum: number, year: number, url: string): CandidateRecord | null {
  // Must have law title heading
  const titleMatch = html.match(/<h1[^>]*>.*?Ley\s*<strong>\s*N[°º]\s*([\d]+)<\/strong>.*?<\/h1>/i)
  if (!titleMatch) return null

  const parsedNum = parseInt(titleMatch[1]!, 10)
  if (parsedNum !== lawNum) return null  // sanity check

  // Extract subject title from h2
  const h2Match = html.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
  if (!h2Match) return null
  const rawTitle = decodeEntities(stripHtml(h2Match[1]!))
  if (!rawTitle || rawTitle.length < 3) return null

  // Extract Promulgación date from h5
  const promMatch = html.match(/Promulgaci[óo]n:\s*(\d{2})\/(\d{2})\/(\d{4})/i)
  if (!promMatch) return null
  const [, dd, mm, yyyy] = promMatch
  const promDate = new Date(`${yyyy}-${mm!.padStart(2, '0')}-${dd!.padStart(2, '0')}T00:00:00Z`)
  if (isNaN(promDate.getTime())) return null

  const actualYear = parseInt(yyyy!, 10)
  if (actualYear !== year) return null  // year mismatch — wrong URL variant

  const externalId = `uy_ley_${lawNum}`
  return {
    lawNumber: lawNum,
    year: actualYear,
    title: rawTitle,
    promulgationDate: promDate,
    promulgationDatePrecision: 'DAY',
    rawDate: `${dd!.padStart(2, '0')}/${mm!.padStart(2, '0')}/${yyyy}`,
    sourceUrl: url,
    externalId,
    sourceExternalId: `src_${externalId}`,
  }
}

// Try to fetch a law page, trying estimated year then ±1.
// Returns null if the law is not accessible or not a ley.
async function fetchLaw(lawNum: number): Promise<CandidateRecord | null> {
  const estYear = estimateYear(lawNum)
  const yearsToTry = [estYear, estYear - 1, estYear + 1]

  for (const year of yearsToTry) {
    if (year < 1985 || year > 2026) continue
    const url = `${BASE_URL}/bases/leyes/${lawNum}-${year}`
    try {
      const { body, status } = await httpsGet(url)
      if (status !== 200) continue
      // Skip if it's an access restriction page
      if (body.includes('Acceso no v') || body.includes('loginUsuario')) continue
      const rec = parseLawPage(body, lawNum, year, url)
      if (rec) return rec
    } catch {
      // timeout or network error — skip this year
    }
  }
  return null
}

async function fetchAllCandidates(
  limit: number,
  verbose: boolean,
  yearFrom = 1990
): Promise<CandidateRecord[]> {
  const results: CandidateRecord[] = []
  let tried = 0, found = 0, skipped = 0

  for (let num = SCAN_START; num <= SCAN_END; num++) {
    tried++
    const rec = await fetchLaw(num)
    if (rec) {
      if (rec.year >= yearFrom) {
        results.push(rec)
        found++
        if (verbose) console.log(`  [found] Ley ${rec.lawNumber} (${rec.year}) — ${rec.title.slice(0, 60)}`)
      } else {
        skipped++
        if (verbose) console.log(`  [pre-scope] Ley ${rec.lawNumber} (${rec.year}) — skipped (before ${yearFrom})`)
      }
    } else {
      skipped++
      if (verbose) console.log(`  [skip] ${num} — not a ley or inaccessible`)
    }

    if (tried % 100 === 0) {
      process.stdout.write(`  Scanned ${tried}/${SCAN_END - SCAN_START + 1} | Found: ${found} | Skipped: ${skipped}\r`)
    }
    if (limit > 0 && found >= limit) break
    await sleep(REQUEST_DELAY_MS)
  }
  console.log(`\n  Scan complete: tried=${tried}, found=${found}, skipped=${skipped}`)
  return results
}

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    if (parentSlug && !existing.parentTopicId) {
      const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
      if (parent) await prisma.topic.update({ where: { id: existing.id }, data: { parentTopicId: parent.id } })
    }
    topicCache.set(slug, existing.id)
    return existing.id
  }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
    else console.warn(`  Parent topic ${parentSlug} not found`)
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}${parentTopicId ? ` (parent: ${parentSlug})` : ''}`)
  topicCache.set(slug, created.id)
  return created.id
}

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
        name: `Ley Uruguay N° ${rec.lawNumber} (${rec.year})`,
        url: rec.sourceUrl,
        publishedAt: rec.promulgationDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Uruguay promulgó la Ley N° ${rec.lawNumber}: ${rec.title}`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: rec.promulgationDate,
        claimEmergedPrecision: rec.promulgationDatePrecision,
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          lawNumber: rec.lawNumber,
          year: rec.year,
          title: rec.title,
          rawDate: rec.rawDate,
          country: 'Uruguay',
          source: 'impo.com.uy',
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

async function main() {
  const { mode, limit, sampleN, verbose, startFrom } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: Uruguay Leyes (IMPO) ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}${limit ? ` limit=${limit}` : ''}${startFrom ? ` start-from=${startFrom}` : ''}`)
  console.log(`Source: impo.com.uy — /bases/leyes/{num}-{year} (sequential scan ${SCAN_START}→${SCAN_END})`)
  console.log(`Scope: Leyes promulgated 1990–present`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('\nALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  if (mode === 'dry-run') {
    console.log('\nDry-run: sampling 30 law numbers to validate parsing...')
    const dryRun: CandidateRecord[] = []
    const sampleNums = [16150, 16200, 16300, 16500, 16700, 17200, 17500, 17800, 18000, 18200, 18500, 19000, 19210, 19500, 20000, 20200, 20381]
    for (const num of sampleNums) {
      const rec = await fetchLaw(num)
      if (rec) {
        dryRun.push(rec)
        console.log(`  Ley ${rec.lawNumber} (${rec.year}) — ${rec.title.slice(0, 70)}`)
      } else {
        console.log(`  ${num} — no law found`)
      }
      await sleep(REQUEST_DELAY_MS)
    }
    console.log(`\nDry-run sample: ${dryRun.length}/${sampleNums.length} accessible leyes`)
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      dryRunNote: 'Sample of specific law numbers to validate parsing — not a count of all laws',
      sampleSize: dryRun.length,
      estimatedTotalRange: SCAN_END - SCAN_START + 1,
      sample: dryRun.slice(0, 15).map(r => ({
        externalId: r.externalId,
        lawNumber: r.lawNumber,
        year: r.year,
        title: r.title,
        promulgationDate: r.promulgationDate.toISOString().slice(0, 10),
        sourceUrl: r.sourceUrl,
        claimText: `Uruguay promulgó la Ley N° ${r.lawNumber}: ${r.title}`,
      })),
    }
    fs.writeFileSync('pipeline-82-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-82-dry-run-sample.json')
    console.log('Dry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Load existing externalIds so we can skip already-committed records without fetching them
  console.log('\nStep 1: Loading resume state from DB...')
  const existingRaw = await prisma.claim.findMany({
    where: { ingestedBy: INGESTED_BY },
    select: { externalId: true },
  })
  const existingSet = new Set(existingRaw.map(c => c.externalId))
  console.log(`  ${existingSet.size} records already in DB (will skip without fetching)`)

  console.log('\nStep 2: Ensuring topic...')
  const topicId = await ensureTopic('uy-parliament', 'Leyes del Uruguay', 'government', 'gov-region-americas')

  const scanFrom = startFrom > 0 ? startFrom : SCAN_START
  const total = SCAN_END - scanFrom + 1
  console.log(`\nStep 3: Scanning + writing IMPO leyes ${scanFrom}→${SCAN_END} (interleaved, batches of 50)...`)

  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()
  let pending: CandidateRecord[] = []
  let tried = 0, found = 0

  async function flushPending() {
    if (pending.length === 0) return
    const batch = pending.splice(0)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — Ley ${row.lawNumber} (${row.year})`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch flush failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
  }

  for (let num = scanFrom; num <= SCAN_END; num++) {
    tried++

    if (existingSet.has(`uy_ley_${num}`)) {
      counts.skipped++
      continue
    }

    const rec = await fetchLaw(num)
    if (rec && rec.year >= 1990) {
      found++
      pending.push(rec)
      if (pending.length >= 50) await flushPending()
    }

    if (tried % 100 === 0) {
      console.log(`  Scanned ${tried}/${total} | Found: ${found} | Committed: ${counts.ingested} | Last#: ${num}`)
    }

    if (mode === 'sample' && found >= sampleN) break
    if (limit > 0 && found >= limit) break
    await sleep(REQUEST_DELAY_MS)
  }

  await flushPending()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nScan complete in ${elapsed}s`)
  console.log(`  Tried: ${tried} | Found: ${found} | Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nPost-ingestion DB verification...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (mode === 'sample') console.log('\nSample complete. Review then run --full.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
