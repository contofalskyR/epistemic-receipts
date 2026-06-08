// Pipeline — Congressional STOCK Act Disclosures
// Dataset: Quiver Quantitative congressional trading data
// Source: https://api.quiverquant.com/beta/live/congresstrading
// Returns ~1000 most-recent STOCK Act Periodic Transaction Reports
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-stock-act.ts --dry-run
//      npx dotenv-cli -e .env.local -- ALLOW_EDITS=true npx tsx scripts/ingest-congress-stock-act.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_stock_act_v1'
const BATCH_SIZE = 50
const API_URL = 'https://api.quiverquant.com/beta/live/congresstrading'

// ── Types ─────────────────────────────────────────────────────────────────────

interface QuiverTrade {
  Representative: string
  BioGuideID: string | null
  ReportDate: string
  TransactionDate: string
  Ticker: string
  Transaction: string
  Range: string
  House: string
  Amount: string | number | null
  Party: string | null
  last_modified: string | null
  TickerType: string | null
  Description: string | null
  ExcessReturn: number | null
  PriceChange: number | null
  SPYChange: number | null
}

interface TradeRecord {
  memberName: string
  bioguideId: string | null
  party: string
  chamber: string
  ticker: string
  transactionType: string
  amountRange: string
  amountMin: number
  tradeDate: string
  disclosureDate: string
  tickerType: string | null
  description: string | null
  excessReturn: number | null
  priceChange: number | null
  spyChange: number | null
  externalId: string
  sourceExternalId: string
  claimText: string
  sourceName: string
  sourceUrl: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : null
  if (!mode) {
    console.error('Usage: --dry-run | --full')
    process.exit(1)
  }
  return {
    mode,
    verbose: args.includes('--verbose'),
    allowEdits: process.env.ALLOW_EDITS === 'true',
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

const CACHE_PATH = '.cache/stock-act/quiverquant-2026-06-08.json'

async function fetchTrades(): Promise<QuiverTrade[]> {
  // Try live API first; fall back to local cache on 401/403 (API has a free-tier quota)
  console.log(`  Fetching from ${API_URL}...`)
  try {
    const res = await fetch(API_URL, {
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json() as QuiverTrade[]
      if (Array.isArray(data) && data.length > 0) {
        console.log(`  Got ${data.length} records from live API`)
        // Update cache
        const fs = await import('fs')
        fs.mkdirSync('.cache/stock-act', { recursive: true })
        fs.writeFileSync(CACHE_PATH, JSON.stringify(data))
        return data
      }
    }
    console.log(`  API returned ${res.status} — falling back to cache`)
  } catch (e) {
    console.log(`  API fetch error (${e instanceof Error ? e.message : e}) — falling back to cache`)
  }

  // Use cached data
  const fs = await import('fs')
  if (!fs.existsSync(CACHE_PATH)) {
    throw new Error(`No cache found at ${CACHE_PATH}. Fetch the data manually first.`)
  }
  const raw = fs.readFileSync(CACHE_PATH, 'utf-8')
  const data = JSON.parse(raw) as QuiverTrade[]
  console.log(`  Using cached data: ${data.length} records from ${CACHE_PATH}`)
  return data
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseAmountMin(range: string): number {
  const m = range.match(/\$?([\d,]+)/)
  if (!m) return 0
  return parseInt(m[1].replace(/,/g, ''), 10)
}

function mapChamber(house: string): string {
  const h = house.toLowerCase()
  if (h.includes('senate')) return 'Senate'
  return 'House'
}

function mapTransactionType(t: string): string {
  const l = t.toLowerCase()
  if (l.includes('sale') || l === 'sell') return 'sale'
  if (l.includes('purchase') || l === 'buy') return 'purchase'
  return l
}

function buildRecord(trade: QuiverTrade): TradeRecord {
  const chamber = mapChamber(trade.House)
  const txType = mapTransactionType(trade.Transaction)
  const party = trade.Party ?? 'I'
  const amountMin = parseAmountMin(trade.Range)

  const title = chamber === 'Senate' ? 'Sen.' : 'Rep.'
  const verb = txType === 'purchase' ? 'purchased' : txType === 'sale' ? 'sold' : txType
  const claimText = `${title} ${trade.Representative} (${party}) ${verb} ${trade.Range} of ${trade.Ticker} on ${trade.TransactionDate}, disclosed ${trade.ReportDate} under STOCK Act.`

  const hash = `${trade.Representative}_${trade.Ticker}_${trade.TransactionDate}_${txType}`
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_-]/g, '')
    .toLowerCase()
  const externalId = `${INGESTED_BY}_${hash}`
  const sourceExternalId = `${INGESTED_BY}_src_${hash}`
  const sourceName = `STOCK Act PTR — ${trade.Representative} (disclosed ${trade.ReportDate})`
  const sourceUrl = trade.BioGuideID
    ? `https://disclosures-clerk.house.gov/FinancialDisclosure`
    : `https://disclosures-clerk.house.gov/FinancialDisclosure`

  return {
    memberName: trade.Representative,
    bioguideId: trade.BioGuideID ?? null,
    party,
    chamber,
    ticker: trade.Ticker,
    transactionType: txType,
    amountRange: trade.Range,
    amountMin,
    tradeDate: trade.TransactionDate,
    disclosureDate: trade.ReportDate,
    tickerType: trade.TickerType ?? null,
    description: trade.Description ?? null,
    excessReturn: trade.ExcessReturn ?? null,
    priceChange: trade.PriceChange ?? null,
    spyChange: trade.SPYChange ?? null,
    externalId,
    sourceExternalId,
    claimText,
    sourceName,
    sourceUrl,
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
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
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
  return ensureTopic(
    'congress-stock-act',
    'Congress STOCK Act Disclosures',
    'politics',
    'corporate-accountability',
    'Congressional stock trades disclosed under the STOCK Act of 2012.',
  )
}

// ── DB write ──────────────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  record: TradeRecord,
  topicId: string,
): Promise<'ingested' | 'skipped'> {
  const existing = await tx.claim.findUnique({
    where: { externalId: record.externalId },
    select: { id: true },
  })
  if (existing) return 'skipped'

  const disclosureDate = new Date(record.disclosureDate)

  const claim = await tx.claim.create({
    data: {
      text: record.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      epistemicAxis: 'RECORDED',
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
        bioguide_id: record.bioguideId,
        party: record.party,
        chamber: record.chamber,
        ticker: record.ticker,
        transaction_type: record.transactionType,
        amount_range: record.amountRange,
        amount_min: record.amountMin,
        trade_date: record.tradeDate,
        disclosure_date: record.disclosureDate,
        ticker_type: record.tickerType,
        description: record.description,
        excess_return: record.excessReturn,
        price_change: record.priceChange,
        spy_change: record.spyChange,
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
    data: { edgeId: edge.id, newScore: 90, reason: 'STOCK Act mandatory disclosure — RECORDED (public legal record)' },
  })

  await tx.claimTopic.create({
    data: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, verbose, allowEdits } = parseArgs()

  console.log(`\n── Congress STOCK Act Disclosures (Quiver Quant) ──────────────────`)
  console.log(`Mode: ${mode}`)

  console.log('\nStep 1: Fetching trades from Quiver Quantitative API...')
  const rawTrades = await fetchTrades()
  console.log(`  Fetched ${rawTrades.length} records`)

  const records = rawTrades.map(buildRecord)
  console.log(`  Built ${records.length} TradeRecords`)

  // Stats
  const byParty: Record<string, number> = {}
  const byChamber: Record<string, number> = {}
  const byType: Record<string, number> = {}
  const tickers = new Set<string>()
  for (const r of records) {
    byParty[r.party] = (byParty[r.party] ?? 0) + 1
    byChamber[r.chamber] = (byChamber[r.chamber] ?? 0) + 1
    byType[r.transactionType] = (byType[r.transactionType] ?? 0) + 1
    tickers.add(r.ticker)
  }

  const tradeDates = records.map(r => r.tradeDate).filter(Boolean).sort()
  console.log(`\n  Date range: ${tradeDates[0]} → ${tradeDates[tradeDates.length - 1]}`)
  console.log('  By party:', JSON.stringify(byParty))
  console.log('  By chamber:', JSON.stringify(byChamber))
  console.log('  By type:', JSON.stringify(byType))
  console.log(`  Unique tickers: ${tickers.size}`)

  if (mode === 'dry-run') {
    console.log('\nSample claims:')
    for (const r of records.slice(0, 5)) {
      console.log(`  [${r.party}/${r.chamber}] ${r.claimText}`)
    }
    console.log('\nDry-run complete. Pass --full with ALLOW_EDITS=true to write.')
    return
  }

  // Full run
  if (!allowEdits) {
    console.error('\n⚠️  Set ALLOW_EDITS=true to run full ingestion.')
    process.exit(1)
  }

  console.log('\nStep 2: Ensuring topics...')
  const topicId = await ensureTopics()
  console.log(`  Topic ID: ${topicId}`)

  console.log('\nStep 3: Writing to DB...')
  let totalIngested = 0, totalSkipped = 0, totalErrors = 0
  const start = Date.now()

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    let bIngested = 0, bSkipped = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') bIngested++
          else bSkipped++
          if (verbose) console.log(`  [${result}] ${row.memberName} ${row.transactionType} ${row.ticker}`)
        }
      }, { timeout: 30000 })
    } catch (e) {
      console.error(`  Batch ${i}–${i + BATCH_SIZE} failed: ${e instanceof Error ? e.message : String(e)}`)
      totalErrors += batch.length
      continue
    }

    totalIngested += bIngested
    totalSkipped += bSkipped
    console.log(`  Progress: ${Math.min(i + BATCH_SIZE, records.length)}/${records.length} — ingested ${totalIngested}`)
  }

  const elapsed = ((Date.now() - start) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totalIngested} | Skipped: ${totalSkipped} | Errors: ${totalErrors}`)

  const claimCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`\nDB verification — ${INGESTED_BY} claims: ${claimCount}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
