// Pipeline 18 — Ireland Oireachtas Enacted Acts (oireachtas_v1)
// Dataset: Houses of the Oireachtas Open Data API (api.oireachtas.ie/v1).
//          Free, no API key required.
// Scope: All enacted Irish bills (Acts) signed into law, filtered by bill_status=Enacted.
// Topic: ie-oireachtas (Irish Oireachtas, domain=government).
// Run: npx tsx scripts/ingest-oireachtas.ts --dry-run
//      npx tsx scripts/ingest-oireachtas.ts --sample 10
//      npx tsx scripts/ingest-oireachtas.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'oireachtas_v1'
const PIPELINE = 'Pipeline 18'
const API_BASE = 'https://api.oireachtas.ie/v1'
const PAGE_SIZE = 250
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface OireachtasAct {
  actNo?: string
  actYear?: string
  dateSigned?: string
  longTitleEn?: string | null
  shortTitleEn?: string | null
  statutebookURI?: string | null
  uri?: string | null
}

interface OireachtasBill {
  billNo: string
  billYear: string
  billType: string
  longTitleEn?: string | null
  shortTitleEn?: string | null
  status?: string
  lastUpdated?: string
  act?: OireachtasAct | null
}

interface OireachtasResult {
  bill: OireachtasBill
}

interface OireachtasPage {
  head: { counts: { billCount: number; resultCount: number } }
  results: OireachtasResult[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  billNo: string
  billYear: string
  billType: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
}

// ── HTML helpers ───────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim()
}

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

// The Oireachtas legislation endpoint ignores the documented `offset` query
// parameter — `skip` is the correct paging key when combined with `bill_status`.
async function fetchPage(skip: number, retries = 3): Promise<OireachtasPage> {
  const url = `${API_BASE}/legislation?limit=${PAGE_SIZE}&skip=${skip}&bill_status=Enacted`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} at skip=${skip} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`Oireachtas API ${res.status} at ${url}`)
    return res.json() as Promise<OireachtasPage>
  }
  throw new Error(`Failed after ${retries} retries at skip=${skip}`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(bill: OireachtasBill, verbose: boolean): CandidateRecord | null {
  if (!bill.billNo || !bill.billYear) return null
  // Filter client-side as belt-and-suspenders even though server is filtering already.
  if (!bill.act) return null

  const dateStr = bill.act.dateSigned
  if (!dateStr) {
    if (verbose) console.log(`  Skip ${bill.billYear}/${bill.billNo}: no dateSigned`)
    return null
  }
  const enactedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ${bill.billYear}/${bill.billNo}: invalid dateSigned=${dateStr}`)
    return null
  }

  // Prefer the bill's longTitleEn (formal "Bill entitled an Act to...") stripped of HTML.
  // Fall back to act.longTitleEn, then act.shortTitleEn, then bill.shortTitleEn.
  const rawTitle = bill.longTitleEn || bill.act.longTitleEn || bill.act.shortTitleEn || bill.shortTitleEn || ''
  const claimText = stripHtml(rawTitle)
  if (!claimText) {
    if (verbose) console.log(`  Skip ${bill.billYear}/${bill.billNo}: no usable title`)
    return null
  }

  const sourceUrl = `https://www.oireachtas.ie/en/bills/bill/${bill.billYear}/${bill.billNo}/`
  const externalId = `oireachtas_bill_${bill.billYear}_${bill.billNo}`
  const sourceExternalId = `oireachtas_source_${bill.billYear}_${bill.billNo}`

  return {
    billNo: bill.billNo,
    billYear: bill.billYear,
    billType: bill.billType,
    claimText,
    enactedDate,
    enactedDateStr: dateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
  }
}

// ── Fetch all enacted bills ────────────────────────────────────────────────────

async function fetchAllEnacted(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skip = 0
  let total = -1
  let skippedMalformed = 0

  for (;;) {
    const page = await fetchPage(skip)
    if (total === -1) {
      total = page.head.counts.resultCount
      console.log(`  API reports ${total} enacted bills available`)
    }
    const results = page.results ?? []
    if (results.length === 0) break

    let newOnPage = 0
    for (const r of results) {
      const rec = buildCandidate(r.bill, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue  // defensive against any API duplicates
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (results.length < PAGE_SIZE) break
    if (newOnPage === 0) break

    skip += PAGE_SIZE
    if (verbose) console.log(`  ...fetched ${Math.min(skip, total)}/${total}`)
    if (total > 0 && skip >= total) break
    await sleep(PAGE_DELAY_MS)
  }

  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed/incomplete records`)
  return candidates
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
        name: `oireachtas_bill_${rec.billYear}_${rec.billNo}`,
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
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          billNo: rec.billNo,
          billYear: rec.billYear,
          billType: rec.billType,
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

  console.log(`\n── ${PIPELINE}: Ireland Oireachtas Enacted Acts ───────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('ie-oireachtas', 'Irish Oireachtas', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch enacted acts
  console.log('\nStep 2: Fetching enacted acts from Oireachtas API...')
  const candidates = await fetchAllEnacted(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      billNo: r.billNo,
      billYear: r.billYear,
      billType: r.billType,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-18-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-18-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full run share batch write logic ──────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : (limit > 0 ? candidates.slice(0, limit) : candidates)

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
