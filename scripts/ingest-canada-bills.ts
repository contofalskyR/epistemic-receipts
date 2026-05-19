// Pipeline 24 — Canadian Parliament Bills (canada_bills_v1)
// Dataset: Parliament of Canada LEGISinfo Open Data. Free, no API key required.
// Scope: Bills that received Royal Assent (enacted laws), all sessions from 35th Parliament
//        (January 1994) to present.
// Topic: ca-parliament (Canadian Parliament, domain=government).
// Run: npx tsx scripts/ingest-canada-bills.ts --dry-run
//      npx tsx scripts/ingest-canada-bills.ts --sample 10
//      npx tsx scripts/ingest-canada-bills.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'canada_bills_v1'
const PIPELINE = 'Pipeline 24'
const API_URL = 'https://www.parl.ca/LegisInfo/en/bills/json?parlsession=all'
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

interface CanadaBill {
  BillId: number
  BillNumberFormatted: string
  LongTitleEn: string
  LongTitleFr: string
  ShortTitleEn: string
  ShortTitleFr: string
  ReceivedRoyalAssentDateTime: string | null
  ParlSessionCode: string
  ParlSessionEn: string
  ParliamentNumber: number
  SessionNumber: number
  BillTypeEn: string
  CurrentStatusEn: string
  SponsorEn: string
  IsFromCurrentSession: boolean
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  billId: number
  billNumber: string
  parliament: number
  session: number
  parlSession: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
  billType: string
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

async function fetchAllBills(retries = 4): Promise<CanadaBill[]> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(API_URL, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`LEGISinfo API ${res.status}`)
      return await res.json() as CanadaBill[]
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(bill: CanadaBill, verbose: boolean): CandidateRecord | null {
  if (!bill.ReceivedRoyalAssentDateTime) return null

  const parliament = bill.ParliamentNumber
  const session = bill.SessionNumber
  const billNumber = bill.BillNumberFormatted?.trim() ?? ''
  if (!parliament || !session || !billNumber) {
    if (verbose) console.log(`  Skip BillId ${bill.BillId}: missing parliament/session/number`)
    return null
  }

  const dateStr = bill.ReceivedRoyalAssentDateTime.slice(0, 10)
  const enactedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ${parliament}-${session}:${billNumber}: invalid date ${dateStr}`)
    return null
  }

  // Prefer long title, fall back to short title
  const claimText = (bill.LongTitleEn?.trim() || bill.ShortTitleEn?.trim()) ?? ''
  if (!claimText) {
    if (verbose) console.log(`  Skip ${parliament}-${session}:${billNumber}: no English title`)
    return null
  }

  const externalId = `canada_bill_${parliament}_${session}_${billNumber}`
  const sourceExternalId = `canada_source_${parliament}_${session}_${billNumber}`
  // LEGISinfo URL uses lowercase bill number
  const sourceUrl = `https://www.parl.ca/LegisInfo/en/bill/${parliament}-${session}/${billNumber.toLowerCase()}`

  return {
    billId: bill.BillId,
    billNumber,
    parliament,
    session,
    parlSession: bill.ParlSessionCode,
    claimText,
    enactedDate,
    enactedDateStr: dateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `Canada Bill ${parliament}-${session} ${billNumber}`,
    billType: bill.BillTypeEn ?? '',
  }
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
          billId: rec.billId,
          billNumber: rec.billNumber,
          parliament: rec.parliament,
          session: rec.session,
          parlSession: rec.parlSession,
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

  console.log(`\n── ${PIPELINE}: Canadian Parliament Bills ─────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('ca-parliament', 'Canadian Parliament', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching all bills from LEGISinfo API...')
  const allBills = await fetchAllBills()
  console.log(`  API returned ${allBills.length} total bills`)
  await sleep(PAGE_DELAY_MS)

  let skippedMalformed = 0
  const seenIds = new Set<string>()
  const candidates: CandidateRecord[] = []

  for (const bill of allBills) {
    const rec = buildCandidate(bill, verbose)
    if (!rec) {
      if (bill.ReceivedRoyalAssentDateTime) skippedMalformed++
      continue
    }
    if (seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) break
  }

  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} Royal Assent bills with malformed data`)
  console.log(`\nTotal candidates (Royal Assent): ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      billNumber: r.billNumber,
      parliament: r.parliament,
      session: r.session,
      parlSession: r.parlSession,
      billType: r.billType,
      enactedDate: r.enactedDateStr,
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
      totalBillsFromApi: allBills.length,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-24-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-24-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.parlSession} ${r.billNumber} ${r.enactedDateStr}] ${r.claimText.slice(0, 100)}${r.claimText.length > 100 ? '…' : ''}`)
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
