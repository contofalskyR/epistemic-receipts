// Pipeline — SEC Form 4 Insider Trading Disclosures
// Dataset: SEC EDGAR Form 4 filings via full-text search API (free, no API key)
// Scope: Corporate insider stock transactions (CEOs, directors, 10%+ shareholders)
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, ClaimTopics
// Run: npx tsx scripts/ingest-sec-form4.ts --dry-run
//      npx tsx scripts/ingest-sec-form4.ts --sample 10
//      npx tsx scripts/ingest-sec-form4.ts --full [--days 90] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'sec_form4_v1'
const BATCH_SIZE = 50
const USER_AGENT = 'EpistemicReceipts robert.contofalsky@gmail.com'
const EDGAR_SEARCH = 'https://efts.sec.gov/LATEST/search-index'
const FILING_BASE = 'https://www.sec.gov/Archives/edgar/data'
const MIN_INTERVAL = 200

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchHit {
  _id: string
  _source: {
    ciks?: string[]
    period_of_report?: string
    file_date?: string
    display_names?: string[]
    form?: string
    accession_number?: string
  }
}

interface SearchResponse {
  hits: {
    total: { value: number }
    hits: SearchHit[]
  }
}

interface Form4Transaction {
  transactionCode: string // P = Purchase, S = Sale, A = Grant, etc.
  shares: number
  pricePerShare: number | null
  securityTitle: string
  transactionDate: string
  directOrIndirect: string // D = Direct, I = Indirect
}

interface Form4Filing {
  accessionNumber: string
  cik: string
  filerName: string
  issuerName: string
  issuerCik: string
  filedDate: string
  periodOfReport: string
  transactions: Form4Transaction[]
  filingUrl: string
}

interface FilingRecord {
  filerName: string
  issuerName: string
  cik: string
  issuerCik: string
  accessionNumber: string
  filedDate: string
  transactionDate: string
  transactionType: 'purchase' | 'sale' | 'grant' | 'other'
  transactionCode: string
  shares: number
  pricePerShare: number | null
  securityTitle: string
  filingUrl: string
  externalId: string
  sourceExternalId: string
  claimText: string
  sourceName: string
}

interface DeadLetter {
  accession: string
  reason: string
}

type IngestResult = 'ingested' | 'skipped' | 'conflict'

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : args.includes('--sample') ? 'sample'
    : null

  if (!mode) {
    console.error('Usage: --dry-run | --sample N | --full [--days 90] [--limit N] [--verbose]')
    process.exit(1)
  }

  const sampleIdx = args.indexOf('--sample')
  const daysIdx = args.indexOf('--days')
  const limitIdx = args.indexOf('--limit')

  return {
    mode,
    sampleN: sampleIdx !== -1 ? parseInt(args[sampleIdx + 1] ?? '10', 10) : 10,
    days: daysIdx !== -1 ? parseInt(args[daysIdx + 1] ?? '90', 10) : 90,
    limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '0', 10) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

let lastReqAt = 0

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  await throttle()
  const res = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': USER_AGENT,
      'Accept': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.json() as Promise<T>
}

async function fetchText(url: string): Promise<string> {
  await throttle()
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  return res.text()
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0]!
}

function accessionToPath(accession: string): string {
  return accession.replace(/-/g, '')
}

function buildFilingUrl(cik: string, accession: string): string {
  const numericCik = parseInt(cik, 10).toString()
  const path = accessionToPath(accession)
  return `${FILING_BASE}/${numericCik}/${path}/${accession}.txt`
}

function buildIndexUrl(cik: string, accession: string): string {
  const numericCik = parseInt(cik, 10).toString()
  const path = accessionToPath(accession)
  return `${FILING_BASE}/${numericCik}/${path}/`
}

function transactionTypeFromCode(code: string): 'purchase' | 'sale' | 'grant' | 'other' {
  const upper = code.toUpperCase()
  if (upper === 'P') return 'purchase'
  if (upper === 'S') return 'sale'
  if (upper === 'A' || upper === 'G') return 'grant'
  return 'other'
}

function transactionVerb(type: 'purchase' | 'sale' | 'grant' | 'other'): string {
  if (type === 'purchase') return 'purchased'
  if (type === 'sale') return 'sold'
  if (type === 'grant') return 'was granted'
  return 'transacted'
}

// ── Fetch Form 4 filings from EDGAR search ────────────────────────────────────

async function searchForm4Filings(startDate: string, endDate: string, from: number = 0, size: number = 100): Promise<{ total: number; hits: SearchHit[] }> {
  const url = `${EDGAR_SEARCH}?q=*&forms=4&dateRange=custom&startdt=${startDate}&enddt=${endDate}&from=${from}&size=${size}`

  try {
    const data = await fetchJSON<SearchResponse>(url)
    return {
      total: data.hits.total.value,
      hits: data.hits.hits,
    }
  } catch (e) {
    console.error(`  Search failed: ${e instanceof Error ? e.message : String(e)}`)
    return { total: 0, hits: [] }
  }
}

// ── Parse Form 4 XML ──────────────────────────────────────────────────────────

function extractXMLValue(xml: string, tag: string): string | null {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i')
  const match = xml.match(regex)
  return match ? match[1]?.trim() ?? null : null
}

function extractAllXMLValues(xml: string, tag: string): string[] {
  const regex = new RegExp(`<${tag}>([^<]*)</${tag}>`, 'gi')
  const matches = [...xml.matchAll(regex)]
  return matches.map(m => m[1]?.trim() ?? '').filter(Boolean)
}

async function parseForm4Filing(cik: string, accession: string): Promise<Form4Filing | null> {
  const indexUrl = buildIndexUrl(cik, accession)

  try {
    const indexHtml = await fetchText(indexUrl)

    const xmlMatch = indexHtml.match(/href="([^"]+\.xml)"/i)
    if (!xmlMatch) return null

    const xmlFile = xmlMatch[1]!
    const xmlUrl = `${indexUrl}${xmlFile}`
    const xml = await fetchText(xmlUrl)

    const filerName = extractXMLValue(xml, 'rptOwnerName') ?? 'Unknown Filer'
    const issuerName = extractXMLValue(xml, 'issuerName') ?? 'Unknown Issuer'
    const issuerCik = extractXMLValue(xml, 'issuerCik') ?? cik
    const periodOfReport = extractXMLValue(xml, 'periodOfReport') ?? ''

    const transactions: Form4Transaction[] = []

    const nonDerivTxBlocks = xml.match(/<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/gi) ?? []

    for (const block of nonDerivTxBlocks) {
      const code = extractXMLValue(block, 'transactionCode') ?? ''
      const sharesStr = extractXMLValue(block, 'transactionShares') ?? extractXMLValue(block, 'sharesOwnedFollowingTransaction')
      const priceStr = extractXMLValue(block, 'transactionPricePerShare')
      const title = extractXMLValue(block, 'securityTitle') ?? 'Common Stock'
      const txDate = extractXMLValue(block, 'transactionDate') ?? periodOfReport
      const ownership = extractXMLValue(block, 'directOrIndirectOwnership') ?? 'D'

      if (!code || !sharesStr) continue

      transactions.push({
        transactionCode: code,
        shares: parseFloat(sharesStr.replace(/,/g, '')) || 0,
        pricePerShare: priceStr ? parseFloat(priceStr.replace(/[$,]/g, '')) : null,
        securityTitle: title,
        transactionDate: txDate,
        directOrIndirect: ownership,
      })
    }

    if (transactions.length === 0) return null

    return {
      accessionNumber: accession,
      cik,
      filerName,
      issuerName,
      issuerCik,
      filedDate: '', // filled from search results
      periodOfReport,
      transactions,
      filingUrl: buildFilingUrl(cik, accession),
    }
  } catch (e) {
    console.error(`  Failed to parse ${accession}: ${e instanceof Error ? e.message : String(e)}`)
    return null
  }
}

// ── Build record ──────────────────────────────────────────────────────────────

function buildRecord(filing: Form4Filing, tx: Form4Transaction, txIndex: number): FilingRecord {
  const type = transactionTypeFromCode(tx.transactionCode)
  const verb = transactionVerb(type)

  const priceClause = tx.pricePerShare && tx.pricePerShare > 0
    ? ` at $${tx.pricePerShare.toFixed(2)} per share`
    : ''

  const claimText = `${filing.filerName} ${verb} ${tx.shares.toLocaleString()} shares of ${filing.issuerName}${priceClause} on ${tx.transactionDate}, disclosed to SEC on ${filing.filedDate}.`

  const externalId = `sec_form4_${filing.accessionNumber.replace(/-/g, '_')}_tx${txIndex}`
  const sourceExternalId = `sec_form4_source_${filing.accessionNumber.replace(/-/g, '_')}_tx${txIndex}`
  const sourceName = `SEC Form 4 — ${filing.filerName} (${filing.issuerName}) ${filing.filedDate}`

  return {
    filerName: filing.filerName,
    issuerName: filing.issuerName,
    cik: filing.cik,
    issuerCik: filing.issuerCik,
    accessionNumber: filing.accessionNumber,
    filedDate: filing.filedDate,
    transactionDate: tx.transactionDate,
    transactionType: type,
    transactionCode: tx.transactionCode,
    shares: tx.shares,
    pricePerShare: tx.pricePerShare,
    securityTitle: tx.securityTitle,
    filingUrl: filing.filingUrl,
    externalId,
    sourceExternalId,
    claimText,
    sourceName,
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
  description?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (!parent) throw new Error(`Parent topic not found: ${parentSlug}`)
    parentTopicId = parent.id
  }
  const created = await prisma.topic.create({
    data: { slug, name, domain, description: description ?? null, parentTopicId },
  })
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureTopics(): Promise<{ rootId: string; insiderTradingId: string }> {
  const rootId = await ensureTopic(
    'corporate-accountability',
    'Corporate Accountability',
    'politics',
    undefined,
    'SEC filings, corporate disclosures, financial fraud, and regulatory compliance.',
  )

  const insiderTradingId = await ensureTopic(
    'insider-trading-disclosures',
    'Insider Trading Disclosures',
    'politics',
    'corporate-accountability',
    'SEC Form 4 filings — corporate insider stock purchases and sales.',
  )

  console.log(`  corporate-accountability: ${rootId}`)
  console.log(`  insider-trading-disclosures: ${insiderTradingId}`)
  return { rootId, insiderTradingId }
}

// ── Single row write ──────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  record: FilingRecord,
  insiderTradingTopicId: string,
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({
    where: { externalId: record.externalId },
    select: { externalId: true, ingestedBy: true },
  })
  if (existing) {
    return existing.ingestedBy === INGESTED_BY ? 'skipped' : 'conflict'
  }

  const filedDate = new Date(record.filedDate)
  const txDate = new Date(record.transactionDate)

  const claim = await tx.claim.create({
    data: {
      text: record.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      externalId: record.externalId,
      claimEmergedAt: txDate,
      claimEmergedPrecision: 'DAY',
      metadata: {
        dataset: INGESTED_BY,
        filer_name: record.filerName,
        issuer_name: record.issuerName,
        cik: record.cik,
        issuer_cik: record.issuerCik,
        accession_number: record.accessionNumber,
        filed_date: record.filedDate,
        transaction_date: record.transactionDate,
        transaction_type: record.transactionType,
        transaction_code: record.transactionCode,
        shares: record.shares,
        price_per_share: record.pricePerShare,
        security_title: record.securityTitle,
      },
    },
  })

  const source = await tx.source.create({
    data: {
      name: record.sourceName,
      url: record.filingUrl,
      publishedAt: filedDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      externalId: record.sourceExternalId,
      autoApproved: true,
    },
  })

  const edge = await tx.edge.create({
    data: {
      claimId: claim.id,
      sourceId: source.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: { edgeId: edge.id, newScore: 95, reason: 'SEC Form 4 mandatory disclosure — HARD_FACT' },
  })

  await tx.claimTopic.create({
    data: { claimId: claim.id, topicId: insiderTradingTopicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, days, limit, verbose } = parseArgs()

  console.log(`\n── SEC Form 4 Insider Trading Disclosures ──────────────────────────`)
  console.log(`Mode: ${mode} | Days: ${days} | Limit: ${limit || 'all'}`)

  const endDate = new Date()
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)

  const startStr = formatDate(startDate)
  const endStr = formatDate(endDate)
  console.log(`Date range: ${startStr} to ${endStr}`)

  // Step 1: Topics
  console.log('\nStep 1: Ensuring topics...')
  const { insiderTradingId } = await ensureTopics()

  // Step 2: Search for Form 4 filings
  console.log('\nStep 2: Searching for Form 4 filings...')

  const allRecords: FilingRecord[] = []
  const dead: DeadLetter[] = []
  const seenExternalIds = new Set<string>()
  let searchFrom = 0
  const searchSize = 100
  let totalFound = 0

  const maxFilings = limit > 0 ? limit : 500

  const firstPage = await searchForm4Filings(startStr, endStr, 0, 1)
  totalFound = firstPage.total
  console.log(`  Total Form 4 filings in date range: ${totalFound.toLocaleString()}`)

  while (allRecords.length < maxFilings) {
    const page = await searchForm4Filings(startStr, endStr, searchFrom, searchSize)
    if (page.hits.length === 0) break

    for (const hit of page.hits) {
      if (allRecords.length >= maxFilings) break

      const src = hit._source
      const ciks = src.ciks ?? []
      const accession = src.accession_number ?? ''
      const filedDate = src.file_date ?? src.period_of_report ?? ''

      if (!accession || ciks.length === 0) {
        dead.push({ accession, reason: 'missing accession or CIK' })
        continue
      }

      const cik = ciks[0]!

      console.log(`  Parsing ${accession}...`)
      const filing = await parseForm4Filing(cik, accession)

      if (!filing) {
        dead.push({ accession, reason: 'failed to parse XML or no transactions' })
        continue
      }

      filing.filedDate = filedDate

      for (let i = 0; i < filing.transactions.length && allRecords.length < maxFilings; i++) {
        const tx = filing.transactions[i]!
        if (tx.transactionCode.toUpperCase() !== 'P' && tx.transactionCode.toUpperCase() !== 'S') continue

        const record = buildRecord(filing, tx, i)

        if (seenExternalIds.has(record.externalId)) continue
        seenExternalIds.add(record.externalId)

        allRecords.push(record)
      }

      if (verbose) {
        console.log(`    ${filing.filerName} → ${filing.issuerName}: ${filing.transactions.length} transactions`)
      }
    }

    searchFrom += page.hits.length
    console.log(`  Progress: ${allRecords.length} records from ${searchFrom} filings searched`)

    if (searchFrom >= totalFound) break
  }

  console.log(`\nFetch complete: ${allRecords.length} purchase/sale transactions, ${dead.length} dead-lettered`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const byType: Record<string, number> = {}
    for (const r of allRecords) {
      byType[r.transactionType] = (byType[r.transactionType] ?? 0) + 1
    }

    console.log('\nDry-run summary:')
    console.log(`  Total transactions to ingest: ${allRecords.length}`)
    console.log('  By type:')
    for (const [t, n] of Object.entries(byType)) console.log(`    ${t}: ${n}`)

    console.log('\nSample claims (first 5):')
    for (const r of allRecords.slice(0, 5)) {
      console.log(`  [${r.transactionType.toUpperCase()}] ${r.claimText}`)
      console.log(`           URL: ${r.filingUrl}`)
    }

    const sample = allRecords.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      transactionType: r.transactionType,
      filerName: r.filerName,
      issuerName: r.issuerName,
      shares: r.shares,
      pricePerShare: r.pricePerShare,
    }))
    fs.writeFileSync('pipeline-form4-dry-run-sample.json', JSON.stringify(sample, null, 2))
    fs.writeFileSync('pipeline-form4-dead-letter.json', JSON.stringify(dead, null, 2))

    console.log('\n  Written: pipeline-form4-dry-run-sample.json')
    console.log('  Written: pipeline-form4-dead-letter.json')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = allRecords.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, conflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const result = await writeRow(tx, row, insiderTradingId)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else conflicts++
          if (verbose) console.log(`  [${result}] ${row.filerName} ${row.transactionType} ${row.issuerName}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, conflicts: ${conflicts}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount}`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log(`\nFull ingestion: ${allRecords.length} rows in batches of ${BATCH_SIZE}...`)
  const startTime = Date.now()
  let totalIngested = 0, totalSkipped = 0, totalConflicts = 0, totalErrors = 0
  const errorLog: Array<{ externalId: string; error: string }> = []

  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE)
    let batchIngested = 0, batchSkipped = 0, batchConflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, insiderTradingId)
          if (result === 'ingested') batchIngested++
          else if (result === 'skipped') batchSkipped++
          else batchConflicts++
        }
      }, { timeout: 30000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  Batch ${i}–${i + batch.length - 1} FAILED: ${msg}`)
      for (const row of batch) {
        try {
          await prisma.$transaction(async (tx) => {
            const result = await writeRow(tx, row, insiderTradingId)
            if (result === 'ingested') batchIngested++
            else if (result === 'skipped') batchSkipped++
            else batchConflicts++
          }, { timeout: 30000 })
        } catch (rowErr) {
          const rowMsg = rowErr instanceof Error ? rowErr.message : String(rowErr)
          errorLog.push({ externalId: row.externalId, error: rowMsg })
          totalErrors++
        }
      }
    }

    totalIngested += batchIngested
    totalSkipped += batchSkipped
    totalConflicts += batchConflicts

    if (verbose || i % 100 === 0) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length} — ingested ${totalIngested}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totalIngested} | Skipped: ${totalSkipped} | Conflicts: ${totalConflicts} | Errors: ${totalErrors}`)

  console.log('\nPost-ingestion DB verification...')
  const claimCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const sourceCount = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const edgeCount = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${claimCount}`)
  console.log(`  Sources: ${sourceCount}`)
  console.log(`  Edges:   ${edgeCount}`)

  if (errorLog.length > 0) {
    fs.writeFileSync('pipeline-form4-errors.json', JSON.stringify(errorLog, null, 2))
    console.log('  Written: pipeline-form4-errors.json')
  }
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
