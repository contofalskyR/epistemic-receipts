// Pipeline 60 — ECHR Judgments (echr_judgments_v1)
// Dataset: European Court of Human Rights HUDOC database. Free, no API key required.
// Scope: Grand Chamber and Chamber judgments (English language), 1959–present.
//        hudoc.echr.coe.int — landmark rulings, high citation value.
// Run: npx tsx scripts/ingest-echr.ts --dry-run
//      npx tsx scripts/ingest-echr.ts --sample 10
//      npx tsx scripts/ingest-echr.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'echr_judgments_v1'
const PIPELINE = 'Pipeline 60'
const API_BASE = 'https://hudoc.echr.coe.int/app/query/results'
const PAGE_SIZE = 500
const PAGE_DELAY_MS = 1000

// HUDOC query: Grand Chamber + Chamber judgments in English
const HUDOC_QUERY = [
  'contentsitename:ECHR',
  'AND',
  '(documentcollectionid2:"GRANDCHAMBER" OR documentcollectionid2:"CHAMBER")',
  'AND',
  'languageisocode:ENG',
].join(' ')

// ── Types ──────────────────────────────────────────────────────────────────────

interface HudocResult {
  columns: {
    itemid: string
    docname: string
    kpdate: string  // ISO date string
    originatingbody?: string
  }
}

interface HudocResponse {
  resultcount: number
  results: HudocResult[] | { Result: HudocResult[] }
}

interface CandidateRecord {
  itemId: string
  docName: string
  judgmentDate: Date
  judgmentDateStr: string
  externalId: string
  sourceExternalId: string
  sourceUrl: string
  sourceName: string
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
          'Accept': 'application/json',
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

async function fetchPage(start: number, retries = 4): Promise<HudocResponse> {
  const params = new URLSearchParams({
    query: HUDOC_QUERY,
    select: 'itemid,docname,kpdate',
    sort: 'kpdate Ascending',
    start: String(start),
    length: String(PAGE_SIZE),
  })
  const url = `${API_BASE}?${params.toString()}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, 45_000)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} start=${start} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status} for start=${start}`)
      return JSON.parse(res.body) as HudocResponse
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error start=${start}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at start=${start}`)
}

// ── Parse results ──────────────────────────────────────────────────────────────

function getResults(resp: HudocResponse): HudocResult[] {
  const r = resp.results
  if (Array.isArray(r)) return r
  if (r && typeof r === 'object' && 'Result' in r) return (r as { Result: HudocResult[] }).Result
  return []
}

function toCandidate(item: HudocResult): CandidateRecord | null {
  const { itemid, docname, kpdate } = item.columns

  if (!itemid || !docname) return null

  const dateStr = kpdate?.slice(0, 10) ?? ''
  if (!dateStr || dateStr === '0001-01-01') return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null

  const judgmentDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(judgmentDate.getTime())) return null

  const sourceUrl = `https://hudoc.echr.coe.int/eng?i=${encodeURIComponent(itemid)}`

  return {
    itemId: itemid,
    docName: docname.trim(),
    judgmentDate,
    judgmentDateStr: dateStr,
    externalId: `echr_${itemid}`,
    sourceExternalId: `echr_src_${itemid}`,
    sourceUrl,
    sourceName: `ECHR — ${docname.trim().slice(0, 100)}`,
  }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Fetching first page to get total...')
  const first = await fetchPage(0)
  const total = first.resultcount
  console.log(`  Total ECHR EN judgments (Grand+Chamber): ${total}`)

  const candidates: CandidateRecord[] = []
  let malformed = 0

  const processPage = (resp: HudocResponse): boolean => {
    const results = getResults(resp)
    for (const item of results) {
      const rec = toCandidate(item)
      if (!rec) { malformed++; continue }
      candidates.push(rec)
      if (limit > 0 && candidates.length >= limit) return true
    }
    return false
  }

  if (processPage(first)) return candidates

  const pages = Math.ceil(total / PAGE_SIZE)
  for (let p = 1; p < pages; p++) {
    await sleep(PAGE_DELAY_MS)
    const page = await fetchPage(p * PAGE_SIZE)
    if (verbose) process.stdout.write(`  Page ${p + 1}/${pages} (${candidates.length} so far)...\r`)
    if (processPage(page)) break
  }

  if (verbose) console.log()
  console.log(`    ${candidates.length} candidates, ${malformed} dropped (no date or bad data)`)
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
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.judgmentDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.docName,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.judgmentDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          itemId: rec.itemId,
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

  console.log(`\n── ${PIPELINE}: ECHR Judgments ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    // ECHR is Council of Europe — parent under International
    topicId = await ensureTopic('echr', 'European Court of Human Rights (ECHR)', 'government', 'gov-region-international')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching ECHR judgments from HUDOC...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(-15).map(r => ({
      docName: r.docName,
      externalId: r.externalId,
      judgmentDate: r.judgmentDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      const decade = r.judgmentDateStr.slice(0, 3) + '0s'
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byDecade },
      sampleNewest: sample,
    }

    fs.writeFileSync('pipeline-60-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-60-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by decade:')
      for (const [k, v] of Object.entries(byDecade).sort()) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nSample (newest first):')
      allCandidates.slice(-5).reverse().forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.judgmentDateStr}] ${r.docName.slice(0, 110)}${r.docName.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(-sampleN) : allCandidates

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.docName.slice(0, 70)}`)
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
