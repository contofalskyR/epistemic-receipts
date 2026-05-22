// Pipeline 85 — UAE Federal Legislation (uae_legislation_v1)
// Dataset: UAE Federal Legislation Portal (uaelegislation.gov.ae)
// Scope: Federal Laws and Federal Decree-Laws in English
//
// Access: uaelegislation.gov.ae returns 403 directly (Cloudflare-protected).
// Strategy: enumerate individual law page IDs via Wayback CDX API, then fetch
//           each law page from Wayback Machine and parse title + year.
//
// CDX pattern: uaelegislation.gov.ae/en/legislations/{numeric-id}
// Title: from <title> tag — format "UAE Legislations | {Law Title}"
// Year:  from body pattern "No. X of YYYY" or "Decree-Law No. X of YYYY"
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-uae.ts --dry-run
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-uae.ts --sample 10
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-uae.ts --full [--verbose]
// ALLOW_EDITS=true env var required for sample/full DB writes.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as https from 'https'
import * as http from 'http'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'uae_legislation_v1'
const PIPELINE = 'Pipeline 85'
const CDX_API_BASE = 'http://web.archive.org/cdx/search/cdx'
const WAYBACK_BASE = 'https://web.archive.org/web'
const REQUEST_DELAY_MS = 1200
const BATCH_SIZE = 50

interface LawId {
  id: string
  timestamp: string
  originalUrl: string
}

interface LawRecord extends LawId {
  title: string
  year: number | null
}

type Counts = { ingested: number; skipped: number; errors: number }
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function anyGet(urlStr: string, timeoutMs = 30000): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(urlStr)
    const lib = parsed.protocol === 'https:' ? https : http
    const port = parsed.protocol === 'https:' ? 443 : (parsed.port ? parseInt(parsed.port) : 80)
    const req = (lib as typeof https).request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; legal research)',
          'Accept': 'text/html,application/json,*/*',
          'Accept-Language': 'en',
        },
        timeout: timeoutMs,
        rejectUnauthorized: false,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          anyGet(new URL(res.headers.location as string, urlStr).toString(), timeoutMs).then(resolve, reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', c => chunks.push(c))
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode} for ${urlStr}`))
            return
          }
          resolve(Buffer.concat(chunks).toString('utf8'))
        })
        res.on('error', reject)
      }
    )
    req.on('timeout', () => { req.destroy(); reject(new Error(`Timed out: ${urlStr}`)) })
    req.on('error', reject)
    req.end()
  })
}

async function getCdxLawIds(): Promise<LawId[]> {
  const url = `${CDX_API_BASE}?url=uaelegislation.gov.ae/en/legislations/*&output=json&fl=original,timestamp&collapse=urlkey&filter=statuscode:200&limit=2000`
  let body: string
  try {
    body = await anyGet(url)
  } catch (err) {
    console.error(`CDX error: ${(err as Error).message}`)
    return []
  }

  let data: string[][]
  try {
    data = JSON.parse(body) as string[][]
  } catch {
    console.error('CDX parse error')
    return []
  }

  const idRegex = /^https?:\/\/uaelegislation\.gov\.ae\/en\/legislations\/(\d+)$/
  const seen = new Map<string, LawId>()

  for (const row of data.slice(1)) {
    const [originalUrl, timestamp] = row
    if (!originalUrl || !timestamp) continue
    const m = idRegex.exec(originalUrl)
    if (!m) continue
    const id = m[1]!
    // Keep most recent timestamp
    if (!seen.has(id) || timestamp > seen.get(id)!.timestamp) {
      seen.set(id, { id, timestamp, originalUrl })
    }
  }

  return [...seen.values()]
}

function extractTitle(html: string): string {
  const m = html.match(/<title>([^<]+)<\/title>/i)
  if (!m) return ''
  const raw = m[1]!.trim()
  // Format: "United Arab Emirates Legislations | {Law Title}"
  const sep = raw.indexOf(' | ')
  return sep >= 0 ? raw.slice(sep + 3).trim() : raw
}

function extractYear(html: string): number | null {
  // Look for "No. X of YYYY" pattern (Law No. X of YYYY, Decree-Law No. X of YYYY)
  const bodyStart = html.indexOf('<body')
  const body = bodyStart >= 0 ? html.slice(bodyStart) : html
  const cleaned = body.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const m = cleaned.match(/\bNo\.?\s*\(?\d+\)?\s+(?:of|for)\s+((?:19|20)\d\d)\b/)
  if (m) {
    const year = parseInt(m[1]!)
    return year >= 1900 && year <= 2025 ? year : null
  }
  return null
}

async function fetchLawData(law: LawId): Promise<{ title: string; year: number | null }> {
  const waybackUrl = `${WAYBACK_BASE}/${law.timestamp}/${law.originalUrl}`
  let body: string
  try {
    body = await anyGet(waybackUrl)
  } catch {
    return { title: '', year: null }
  }
  return { title: extractTitle(body), year: extractYear(body) }
}

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function writeRow(tx: TxClient, rec: LawRecord, topicId: string): Promise<'ingested' | 'skipped' | 'failed'> {
  const externalId = `uae_leg_${rec.id}`
  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const claimEmergedAt = rec.year ? new Date(`${rec.year}-01-01T00:00:00Z`) : null
    const waybackUrl = `${WAYBACK_BASE}/${rec.timestamp}/${rec.originalUrl}`
    const sourceExternalId = `src_${externalId}`

    const source = await tx.source.upsert({
      where: { externalId: sourceExternalId },
      update: {},
      create: {
        externalId: sourceExternalId,
        name: `UAE Legislation — ${rec.title.slice(0, 120)}`,
        url: waybackUrl,
        publishedAt: claimEmergedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: `The United Arab Emirates enacted the ${rec.title}.`,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId,
        metadata: {
          dataset: INGESTED_BY,
          lawPageId: rec.id,
          waybackTimestamp: rec.timestamp,
          country: 'United Arab Emirates',
          source: 'uaelegislation.gov.ae',
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
    console.error(`  Error writing uae_leg_${rec.id}: ${err}`)
    return 'failed'
  }
}

async function main() {
  const { mode, sampleN, verbose } = parseArgs()
  const allowEdits = process.env.ALLOW_EDITS === 'true'

  console.log(`\n── ${PIPELINE}: UAE Federal Legislation ──`)
  console.log(`Mode: ${mode}${mode === 'sample' ? ` (n=${sampleN})` : ''}`)
  console.log(`Source: uaelegislation.gov.ae via Wayback Machine CDX enumeration\n`)

  if (mode !== 'dry-run' && !allowEdits) {
    console.error('ALLOW_EDITS=true is required for sample/full modes.')
    process.exit(2)
  }

  // Phase 1: CDX enumeration
  console.log('Step 1: Enumerating law IDs via Wayback CDX API...')
  const lawIds = await getCdxLawIds()
  console.log(`Found ${lawIds.length} unique law page IDs`)

  if (lawIds.length === 0) {
    console.error('ERROR: 0 law IDs found — CDX API may be unavailable.')
    process.exit(1)
  }

  // For dry-run: sample a few to verify page fetching
  if (mode === 'dry-run') {
    console.log('\nStep 2 (dry-run): Fetching sample pages from Wayback...')
    const sampleIds = lawIds.slice(0, 10)
    const sampleRecords: LawRecord[] = []

    for (const law of sampleIds) {
      process.stdout.write(`  id=${law.id}... `)
      const { title, year } = await fetchLawData(law)
      sampleRecords.push({ ...law, title, year })
      console.log(title ? `"${title}"${year ? ` (${year})` : ''}` : 'NO TITLE')
      await sleep(REQUEST_DELAY_MS)
    }

    const withTitle = sampleRecords.filter(r => r.title).length
    const withYear = sampleRecords.filter(r => r.year !== null).length

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalEnumerated: lawIds.length,
      sampleFetched: sampleRecords.length,
      coverage: { withTitle, withYear },
      sample: sampleRecords.map(r => ({
        id: r.id,
        title: r.title,
        year: r.year,
        waybackUrl: `${WAYBACK_BASE}/${r.timestamp}/${r.originalUrl}`,
        claimText: r.title ? `The United Arab Emirates enacted the ${r.title}.` : '(no title)',
        externalId: `uae_leg_${r.id}`,
      })),
    }

    fs.writeFileSync('pipeline-85-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\nWritten: pipeline-85-dry-run-sample.json')
    console.log(`\nCoverage (sample): title=${withTitle}/${sampleRecords.length}, year=${withYear}/${sampleRecords.length}`)
    console.log('\nDry-run complete. No DB writes performed.')
    await prisma.$disconnect()
    return
  }

  // Phase 2: Fetch page data
  console.log('\nStep 2: Fetching law data from Wayback Machine...')
  const targetIds = mode === 'sample' ? lawIds.slice(0, sampleN) : lawIds
  const records: LawRecord[] = []
  let fetched = 0
  let noTitle = 0

  for (const law of targetIds) {
    const { title, year } = await fetchLawData(law)
    fetched++
    if (!title) { noTitle++; continue }
    records.push({ ...law, title, year })
    if (verbose) console.log(`  id=${law.id} → "${title}"${year ? ` (${year})` : ''}`)
    else if (fetched % 20 === 0) process.stdout.write(`  ${fetched}/${targetIds.length} fetched (${records.length} with titles)\r`)
    await sleep(REQUEST_DELAY_MS)
  }
  console.log(`\nFetched: ${fetched} | With title: ${records.length} | No title: ${noTitle}`)

  // Phase 3: DB writes
  console.log('\nStep 3: Ensuring topic...')
  const topicId = await ensureTopic('ae-legislation', 'UAE Federal Legislation', 'government', 'gov-region-middle-east')

  console.log(`\nStep 4: Writing ${records.length} records (batches of ${BATCH_SIZE}, txn timeout 30s)...`)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    try {
      await prisma.$transaction(async (tx) => {
        for (const rec of batch) {
          const result = await writeRow(tx, rec, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] uae_leg_${rec.id} — ${rec.title.slice(0, 80)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      console.error(`  Batch ${i}–${i + batch.length} failed: ${(err as Error).message}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} processed\r`)
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

  if (mode === 'sample') console.log('\nSample complete. Review then run --full.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
