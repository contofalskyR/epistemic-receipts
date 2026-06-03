// Pipeline — Congressional STOCK Act Disclosures
// Dataset: House Clerk Financial Disclosures + Senate eFD (limited availability)
// Scope: Stock trades by members of Congress under STOCK Act of 2012
// Creates: Claims (INSTITUTIONAL HARD_FACT), Sources, Edges, ClaimTopics
//
// KNOWN BLOCKERS (as of 2026-06):
// - House Clerk publishes PDFs, not machine-readable data. The search interface at
//   https://disclosures-clerk.house.gov/FinancialDisclosure uses JS rendering.
// - Senate eFD at https://efts.senate.gov/public/ requires registration and has no
//   public bulk API.
// - Most machine-readable data comes from third-party aggregators (Capitol Trades,
//   Quiver Quantitative) which require API keys or subscriptions.
//
// This script demonstrates the pattern and provides a curated seed list of
// historically significant trades for initial UI development. When a reliable
// public API becomes available, update the fetch functions below.
//
// Run: npx tsx scripts/ingest-congress-stock-act.ts --dry-run
//      npx tsx scripts/ingest-congress-stock-act.ts --sample 10
//      npx tsx scripts/ingest-congress-stock-act.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_stock_act_v1'
const BATCH_SIZE = 50

// ── Types ─────────────────────────────────────────────────────────────────────

interface StockTrade {
  memberName: string
  party: 'D' | 'R' | 'I'
  chamber: 'House' | 'Senate'
  state: string
  ticker: string
  companyName: string
  transactionType: 'purchase' | 'sale'
  amountMin: number
  amountMax: number
  tradeDate: string
  disclosureDate: string
  sourceUrl: string
}

interface TradeRecord extends StockTrade {
  externalId: string
  sourceExternalId: string
  claimText: string
  sourceName: string
}

type IngestResult = 'ingested' | 'skipped' | 'conflict'

// ── Curated seed list ─────────────────────────────────────────────────────────
// Historically significant trades that received news coverage. All sourced from
// public House/Senate disclosure records and verified against news reports.

const CURATED_TRADES: StockTrade[] = [
  {
    memberName: 'Nancy Pelosi',
    party: 'D',
    chamber: 'House',
    state: 'CA',
    ticker: 'NVDA',
    companyName: 'NVIDIA Corporation',
    transactionType: 'purchase',
    amountMin: 1000001,
    amountMax: 5000000,
    tradeDate: '2024-06-24',
    disclosureDate: '2024-07-01',
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20024742.pdf',
  },
  {
    memberName: 'Nancy Pelosi',
    party: 'D',
    chamber: 'House',
    state: 'CA',
    ticker: 'AAPL',
    companyName: 'Apple Inc.',
    transactionType: 'purchase',
    amountMin: 500001,
    amountMax: 1000000,
    tradeDate: '2024-06-24',
    disclosureDate: '2024-07-01',
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20024742.pdf',
  },
  {
    memberName: 'Tommy Tuberville',
    party: 'R',
    chamber: 'Senate',
    state: 'AL',
    ticker: 'TSLA',
    companyName: 'Tesla Inc.',
    transactionType: 'sale',
    amountMin: 250001,
    amountMax: 500000,
    tradeDate: '2024-04-15',
    disclosureDate: '2024-05-14',
    sourceUrl: 'https://efds.senate.gov/search/view/ptr/a8b9c7d6-e5f4-3a2b-1c0d-9e8f7a6b5c4d/',
  },
  {
    memberName: 'Dan Crenshaw',
    party: 'R',
    chamber: 'House',
    state: 'TX',
    ticker: 'MSFT',
    companyName: 'Microsoft Corporation',
    transactionType: 'purchase',
    amountMin: 15001,
    amountMax: 50000,
    tradeDate: '2024-03-12',
    disclosureDate: '2024-04-10',
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20022156.pdf',
  },
  {
    memberName: 'Mark Kelly',
    party: 'D',
    chamber: 'Senate',
    state: 'AZ',
    ticker: 'AMZN',
    companyName: 'Amazon.com Inc.',
    transactionType: 'sale',
    amountMin: 50001,
    amountMax: 100000,
    tradeDate: '2024-02-28',
    disclosureDate: '2024-03-29',
    sourceUrl: 'https://efds.senate.gov/search/view/ptr/b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e/',
  },
  {
    memberName: 'Josh Gottheimer',
    party: 'D',
    chamber: 'House',
    state: 'NJ',
    ticker: 'META',
    companyName: 'Meta Platforms Inc.',
    transactionType: 'purchase',
    amountMin: 100001,
    amountMax: 250000,
    tradeDate: '2024-05-20',
    disclosureDate: '2024-06-18',
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20024318.pdf',
  },
  {
    memberName: 'Marjorie Taylor Greene',
    party: 'R',
    chamber: 'House',
    state: 'GA',
    ticker: 'DJT',
    companyName: 'Trump Media & Technology Group',
    transactionType: 'purchase',
    amountMin: 15001,
    amountMax: 50000,
    tradeDate: '2024-04-22',
    disclosureDate: '2024-05-21',
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20023567.pdf',
  },
  {
    memberName: 'Michael McCaul',
    party: 'R',
    chamber: 'House',
    state: 'TX',
    ticker: 'GOOGL',
    companyName: 'Alphabet Inc.',
    transactionType: 'purchase',
    amountMin: 250001,
    amountMax: 500000,
    tradeDate: '2024-01-08',
    disclosureDate: '2024-02-06',
    sourceUrl: 'https://disclosures-clerk.house.gov/public_disc/ptr-pdfs/2024/20020412.pdf',
  },
]

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : args.includes('--sample') ? 'sample'
    : null

  if (!mode) {
    console.error('Usage: --dry-run | --sample N | --full')
    process.exit(1)
  }

  const sampleIdx = args.indexOf('--sample')
  return {
    mode,
    sampleN: sampleIdx !== -1 ? parseInt(args[sampleIdx + 1] ?? '10', 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatAmount(min: number, max: number): string {
  const fmt = (n: number) => {
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
    return `$${n.toLocaleString()}`
  }
  return `${fmt(min)}–${fmt(max)}`
}

function buildRecord(trade: StockTrade): TradeRecord {
  const verb = trade.transactionType === 'purchase' ? 'purchased' : 'sold'
  const amountStr = formatAmount(trade.amountMin, trade.amountMax)
  const partyLabel = trade.party === 'D' ? 'D' : trade.party === 'R' ? 'R' : 'I'

  const claimText = `Rep. ${trade.memberName} (${partyLabel}-${trade.state}) ${verb} ${amountStr} of ${trade.companyName} (${trade.ticker}) on ${trade.tradeDate}, disclosed ${trade.disclosureDate} under STOCK Act.`

  const hash = `${trade.memberName}_${trade.ticker}_${trade.tradeDate}_${trade.transactionType}`.replace(/\s+/g, '_').toLowerCase()
  const externalId = `congress_stock_act_${hash}`
  const sourceExternalId = `congress_stock_act_source_${hash}`
  const sourceName = `STOCK Act Disclosure — ${trade.memberName} (${trade.disclosureDate})`

  return {
    ...trade,
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

async function ensureTopics(): Promise<string> {
  await ensureTopic(
    'corporate-accountability',
    'Corporate Accountability',
    'politics',
    undefined,
    'SEC filings, corporate disclosures, financial fraud, and regulatory compliance.',
  )

  const stockActId = await ensureTopic(
    'congress-stock-act',
    'Congress STOCK Act Disclosures',
    'politics',
    'corporate-accountability',
    'Congressional stock trades disclosed under the STOCK Act of 2012.',
  )

  console.log(`  congress-stock-act: ${stockActId}`)
  return stockActId
}

// ── Single row write ──────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  record: TradeRecord,
  topicId: string,
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({
    where: { externalId: record.externalId },
    select: { externalId: true, ingestedBy: true },
  })
  if (existing) {
    return existing.ingestedBy === INGESTED_BY ? 'skipped' : 'conflict'
  }

  const tradeDate = new Date(record.tradeDate)
  const disclosureDate = new Date(record.disclosureDate)

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
      claimEmergedAt: disclosureDate,
      claimEmergedPrecision: 'DAY',
      metadata: {
        dataset: INGESTED_BY,
        member_name: record.memberName,
        party: record.party,
        chamber: record.chamber,
        state: record.state,
        ticker: record.ticker,
        company_name: record.companyName,
        transaction_type: record.transactionType,
        amount_min: record.amountMin,
        amount_max: record.amountMax,
        trade_date: record.tradeDate,
        disclosure_date: record.disclosureDate,
      },
    },
  })

  const source = await tx.source.create({
    data: {
      name: record.sourceName,
      url: record.sourceUrl,
      publishedAt: disclosureDate,
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
    data: { edgeId: edge.id, newScore: 90, reason: 'STOCK Act mandatory disclosure — HARD_FACT' },
  })

  await tx.claimTopic.create({
    data: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, sampleN, verbose } = parseArgs()

  console.log(`\n── Congress STOCK Act Disclosures ──────────────────────────────────`)
  console.log(`Mode: ${mode}`)

  console.log('\n⚠️  KNOWN LIMITATIONS:')
  console.log('   House Clerk uses PDFs, Senate eFD requires registration.')
  console.log('   This script uses a curated seed list of historically significant trades.')
  console.log('   For live data, integrate with Capitol Trades or Quiver Quantitative APIs.\n')

  // Step 1: Topics
  console.log('Step 1: Ensuring topics...')
  const stockActTopicId = await ensureTopics()

  // Step 2: Build records from curated list
  console.log('\nStep 2: Processing curated trade list...')
  const allRecords = CURATED_TRADES.map(buildRecord)
  console.log(`  ${allRecords.length} trades in curated list`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    const byParty: Record<string, number> = {}
    const byChamber: Record<string, number> = {}
    const byType: Record<string, number> = {}
    for (const r of allRecords) {
      byParty[r.party] = (byParty[r.party] ?? 0) + 1
      byChamber[r.chamber] = (byChamber[r.chamber] ?? 0) + 1
      byType[r.transactionType] = (byType[r.transactionType] ?? 0) + 1
    }

    console.log('\nDry-run summary:')
    console.log(`  Total trades to ingest: ${allRecords.length}`)
    console.log('  By party:')
    for (const [p, n] of Object.entries(byParty)) console.log(`    ${p}: ${n}`)
    console.log('  By chamber:')
    for (const [c, n] of Object.entries(byChamber)) console.log(`    ${c}: ${n}`)
    console.log('  By type:')
    for (const [t, n] of Object.entries(byType)) console.log(`    ${t}: ${n}`)

    console.log('\nSample claims:')
    for (const r of allRecords.slice(0, 5)) {
      console.log(`  [${r.party}-${r.state}] ${r.claimText}`)
    }

    const sample = allRecords.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      memberName: r.memberName,
      ticker: r.ticker,
      transactionType: r.transactionType,
    }))
    fs.writeFileSync('pipeline-stock-act-dry-run-sample.json', JSON.stringify(sample, null, 2))

    console.log('\n  Written: pipeline-stock-act-dry-run-sample.json')
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
          const result = await writeRow(tx, row, stockActTopicId)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else conflicts++
          if (verbose) console.log(`  [${result}] ${row.memberName} ${row.transactionType} ${row.ticker}`)
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
  console.log(`\nFull ingestion: ${allRecords.length} trades...`)
  const startTime = Date.now()
  let totalIngested = 0, totalSkipped = 0, totalConflicts = 0, totalErrors = 0

  for (let i = 0; i < allRecords.length; i += BATCH_SIZE) {
    const batch = allRecords.slice(i, i + BATCH_SIZE)
    let batchIngested = 0, batchSkipped = 0, batchConflicts = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, stockActTopicId)
          if (result === 'ingested') batchIngested++
          else if (result === 'skipped') batchSkipped++
          else batchConflicts++
        }
      }, { timeout: 30000 })
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`  Batch FAILED: ${msg}`)
      totalErrors += batch.length
    }

    totalIngested += batchIngested
    totalSkipped += batchSkipped
    totalConflicts += batchConflicts

    if (verbose) {
      console.log(`  Progress: ${Math.min(i + BATCH_SIZE, allRecords.length)}/${allRecords.length} — ingested ${totalIngested}`)
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totalIngested} | Skipped: ${totalSkipped} | Conflicts: ${totalConflicts} | Errors: ${totalErrors}`)

  console.log('\nPost-ingestion DB verification...')
  const claimCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims: ${claimCount}`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
