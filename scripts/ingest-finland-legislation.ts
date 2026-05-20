// Pipeline 33 — Finland Eduskunta Legislation (finland_legislation_v1)
// Dataset: Eduskunta Avoin Data API (avoindata.eduskunta.fi). Free, no API key required.
// Scope: SaliDBAanestys table — parliament votes on Hallituksen esitys (HE) bills.
//        One record per unique HE bill (deduplicated by bill ID, latest vote date).
// Topic: fi-eduskunta (Eduskunta Finland, domain=government).
// Run: npx tsx scripts/ingest-finland-legislation.ts --dry-run
//      npx tsx scripts/ingest-finland-legislation.ts --sample 10
//      npx tsx scripts/ingest-finland-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'finland_legislation_v1'
const PIPELINE = 'Pipeline 33'
const API_BASE = 'https://avoindata.eduskunta.fi/api/v1/tables/SaliDBAanestys/rows'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface AanestysRow {
  aanestysId: string
  kieliId: string
  istuntoPvm: string
  kohtaOtsikko: string
  aanestysValtiopaivaasia: string
  aanestysValtiopaivaasiaUrl: string
}

interface ApiPage {
  page: number
  perPage: number
  hasMore: boolean
  columnNames: string[]
  rowData: unknown[][]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  heId: string          // e.g. "HE 91/1999 vp"
  heNumber: string      // e.g. "91"
  heYear: string        // e.g. "1999"
  claimText: string
  decidedDate: Date
  decidedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
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

async function fetchPage(pageNum: number, retries = 4): Promise<ApiPage> {
  const url = `${API_BASE}?perPage=${PAGE_SIZE}&page=${pageNum}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} page ${pageNum} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Eduskunta API ${res.status} at page ${pageNum}`)
      return await res.json() as ApiPage
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error page ${pageNum}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at page ${pageNum}`)
}

// ── Row parsing ────────────────────────────────────────────────────────────────

function parseRow(cols: string[], row: unknown[]): AanestysRow {
  const get = (name: string) => String(row[cols.indexOf(name)] ?? '')
  return {
    aanestysId: get('AanestysId'),
    kieliId: get('KieliId'),
    istuntoPvm: get('IstuntoPvm'),
    kohtaOtsikko: get('KohtaOtsikko'),
    aanestysValtiopaivaasia: get('AanestysValtiopaivaasia'),
    aanestysValtiopaivaasiaUrl: get('AanestysValtiopaivaasiaUrl'),
  }
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(r: AanestysRow, verbose: boolean): CandidateRecord | null {
  // Only Finnish-language rows (KieliId=1), skip Swedish duplicates
  if (r.kieliId !== '1') return null

  // Only government bills: "HE X/YYYY vp"
  const heId = r.aanestysValtiopaivaasia.trim()
  if (!heId.startsWith('HE ')) return null

  // Parse HE number and year: "HE 91/1999 vp" → number=91, year=1999
  const match = heId.match(/^HE\s+(\d+)\/(\d{4})/)
  if (!match) {
    if (verbose) console.log(`  Skip malformed HE ID: ${heId}`)
    return null
  }
  const [, heNumber, heYear] = match

  const claimText = r.kohtaOtsikko.trim().replace(/^None$/, '')
  if (!claimText) {
    if (verbose) console.log(`  Skip ${heId}: no KohtaOtsikko`)
    return null
  }

  const dateStr = r.istuntoPvm.slice(0, 10)
  const decidedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(decidedDate.getTime())) {
    if (verbose) console.log(`  Skip ${heId}: invalid date=${dateStr}`)
    return null
  }

  // Construct canonical URL (open data portal hash route)
  const heUrlPath = r.aanestysValtiopaivaasiaUrl.trim() || `/valtiopaivaasiat/HE+${heNumber}/${heYear}`
  const sourceUrl = `https://avoindata.eduskunta.fi/#/fi${heUrlPath}`

  const externalId = `finland_he_${heNumber}_${heYear}`
  const sourceExternalId = `finland_he_source_${heNumber}_${heYear}`

  return {
    heId,
    heNumber,
    heYear,
    claimText,
    decidedDate,
    decidedDateStr: dateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `${heId}`,
  }
}

// ── Fetch all HE votes ─────────────────────────────────────────────────────────

async function fetchAllHeBills(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  // Deduplicate by externalId, keeping the record with the latest vote date
  const billMap = new Map<string, CandidateRecord>()
  let skippedMalformed = 0
  let pageNum = 0
  let hasMore = true

  while (hasMore) {
    const page = await fetchPage(pageNum)
    hasMore = page.hasMore
    const rows = page.rowData ?? []
    if (rows.length === 0) break

    for (const rawRow of rows) {
      const r = parseRow(page.columnNames, rawRow as unknown[])
      const rec = buildCandidate(r, verbose)
      if (!rec) { skippedMalformed++; continue }

      const existing = billMap.get(rec.externalId)
      if (!existing || rec.decidedDate > existing.decidedDate) {
        // Keep latest vote date (final decision) for each bill
        billMap.set(rec.externalId, rec)
      }
    }

    if (!verbose && pageNum % 50 === 0) {
      process.stdout.write(`  ...page ${pageNum}: ${billMap.size} unique HE bills\r`)
    }

    if (hardLimit > 0 && billMap.size >= hardLimit) break
    pageNum++
    if (hasMore) await sleep(PAGE_DELAY_MS)
  }

  if (skippedMalformed > 0) console.log(`\n  Skipped ${skippedMalformed} non-HE/malformed rows`)

  const candidates = Array.from(billMap.values())
    .sort((a, b) => b.decidedDate.getTime() - a.decidedDate.getTime())

  return hardLimit > 0 ? candidates.slice(0, hardLimit) : candidates
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
        publishedAt: rec.decidedDate,
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
        claimEmergedAt: rec.decidedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          heId: rec.heId,
          heNumber: rec.heNumber,
          heYear: rec.heYear,
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

  console.log(`\n── ${PIPELINE}: Finland Eduskunta Legislation ─────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('fi-eduskunta', 'Eduskunta (Finland)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching HE bills from Eduskunta API (SaliDBAanestys)...')
  const candidates = await fetchAllHeBills(limit, verbose)
  console.log(`\nTotal unique HE bills found: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      heId: r.heId,
      heNumber: r.heNumber,
      heYear: r.heYear,
      decidedDate: r.decidedDateStr,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
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

    fs.writeFileSync('pipeline-33-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-33-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.decidedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
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
