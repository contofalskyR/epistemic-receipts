// Pipeline 15 — Congress.gov Enacted Laws (congress_v1)
// Dataset: Congress.gov API (api.congress.gov/v3) — requires CONGRESS_API_KEY.
//          Falls back to DEMO_KEY (30 req/hr) if key is absent; dry-run only.
// Scope: Enacted public laws from 97th–119th Congress.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress.ts --sample 10
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress.ts --full [--congress 118,119] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_v1'
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250

// ── Types ──────────────────────────────────────────────────────────────────────

interface CongressBill {
  number: string
  type: string
  congress: number
  title: string
  originChamber: string
  originChamberCode: string
  latestAction: {
    actionDate: string
    text: string
  }
  url: string
  updateDate?: string
}

interface CongressLawPage {
  bills: CongressBill[]
  pagination: {
    count: number   // total records available for this endpoint
    next?: string   // present when more pages remain
  }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  billNumber: string
  billType: string
  congress: number
  displayNumber: string
  title: string
  sourceUrl: string
  enactedDate: Date | null
  enactedDateStr: string | null
  externalId: string
  claimText: string
}

// ── Bill type helpers ──────────────────────────────────────────────────────────

const BILL_TYPE_URL: Record<string, string> = {
  HR:      'house-bill',
  S:       'senate-bill',
  HJRES:   'house-joint-resolution',
  SJRES:   'senate-joint-resolution',
  HCONRES: 'house-concurrent-resolution',
  SCONRES: 'senate-concurrent-resolution',
  HRES:    'house-simple-resolution',
  SRES:    'senate-simple-resolution',
}

const BILL_TYPE_PREFIX: Record<string, string> = {
  HR:      'H.R.',
  S:       'S.',
  HJRES:   'H.J.Res.',
  SJRES:   'S.J.Res.',
  HCONRES: 'H.Con.Res.',
  SCONRES: 'S.Con.Res.',
  HRES:    'H.Res.',
  SRES:    'S.Res.',
}

function billDisplayNumber(type: string, number: string): string {
  const prefix = BILL_TYPE_PREFIX[type.toUpperCase()] ?? type
  return `${prefix} ${number}`
}

function billSourceUrl(congress: number, type: string, number: string): string {
  const urlType = BILL_TYPE_URL[type.toUpperCase()] ?? type.toLowerCase()
  return `https://www.congress.gov/bill/${congress}th-congress/${urlType}/${number}`
}

function ordinalCongress(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--congress 118,119] [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const ci = args.indexOf('--congress')
  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  const congressArg = ci !== -1 ? (args[ci + 1] ?? '118,119') : '118,119'
  const congresses = congressArg.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n))

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    congresses,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ───────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 500

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function congressFetch(url: string, retries = 3): Promise<CongressLawPage> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`Congress API ${res.status} at ${url.replace(/api_key=[^&]+/, 'api_key=REDACTED')}`)
    return res.json() as Promise<CongressLawPage>
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Fetch all enacted laws for one congress (paginated) ────────────────────────

async function fetchEnactedLaws(congressNum: number, apiKey: string): Promise<CongressBill[]> {
  const all: CongressBill[] = []
  let offset = 0

  for (;;) {
    const url = `${CONGRESS_BASE}/law/${congressNum}?api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&offset=${offset}&format=json`
    const data = await congressFetch(url)
    const bills = data.bills ?? []
    all.push(...bills)
    // stop when the API signals no next page, or we got a short page
    if (!data.pagination?.next || bills.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(bill: CongressBill): CandidateRecord | null {
  if (!bill.number || !bill.type || !bill.congress || !bill.title) return null

  const typeUpper = bill.type.toUpperCase()
  const displayNumber = billDisplayNumber(typeUpper, bill.number)
  const sourceUrl = billSourceUrl(bill.congress, typeUpper, bill.number)
  const externalId = `congress_law_${bill.congress}_${bill.type.toLowerCase()}_${bill.number}`

  let enactedDate: Date | null = null
  let enactedDateStr: string | null = null
  if (bill.latestAction?.actionDate) {
    const d = new Date(bill.latestAction.actionDate + 'T00:00:00Z')
    if (!isNaN(d.getTime())) {
      enactedDate = d
      enactedDateStr = bill.latestAction.actionDate
    }
  }

  const ordinal = ordinalCongress(bill.congress)
  const claimText = `${displayNumber} (${ordinal} Congress) enacted — ${bill.title}`

  return {
    billNumber: bill.number,
    billType: typeUpper,
    congress: bill.congress,
    displayNumber,
    title: bill.title,
    sourceUrl,
    enactedDate,
    enactedDateStr,
    externalId,
    claimText,
  }
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureAllTopics(congresses: number[]): Promise<Map<string, string>> {
  const rootId = await ensureTopic('us-enacted-legislation', 'U.S. Enacted Legislation', 'government')
  const map = new Map<string, string>()
  map.set('root', rootId)
  for (const c of congresses) {
    const id = await ensureTopic(
      `congress-${c}th-enacted`,
      `${ordinalCongress(c)} Congress — Enacted Bills`,
      'government',
      'congress-enacted-bills',
    )
    map.set(String(c), id)
  }
  return map
}

// ── Core: write one record ─────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicIds: string[]): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `Congress.gov: ${rec.displayNumber} (${ordinalCongress(rec.congress)} Congress)`,
      url: rec.sourceUrl,
      publishedAt: rec.enactedDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: false,
      externalId: `congress_law_source_${rec.congress}_${rec.billType.toLowerCase()}_${rec.billNumber}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.enactedDate,
      claimEmergedPrecision: rec.enactedDate ? 'DAY' : null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: false,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        billNumber: rec.billNumber,
        congress: rec.congress,
        billType: rec.billType,
        enactedDate: rec.enactedDateStr,
        sponsor: null,
        sponsorState: null,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: false,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 95,
      reason: 'Congress.gov enacted public law — HARD_FACT',
      changedAt: rec.enactedDate ?? new Date(),
    },
  })

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, congresses, limit, sampleN, verbose } = parseArgs()

  const apiKey = process.env.CONGRESS_API_KEY ?? 'DEMO_KEY'
  const hasRealKey = !!process.env.CONGRESS_API_KEY

  if (!hasRealKey) {
    console.warn('\nWARNING: CONGRESS_API_KEY not set — using DEMO_KEY (rate-limited: 30 req/hr, 50/day).')
    console.warn('         Set CONGRESS_API_KEY in .env.local for reliable full access.\n')
  }

  console.log(`\n── Pipeline 15: Congress.gov Enacted Laws ──────────────────────────────`)
  console.log(`Mode: ${mode} | Congress: ${congresses.map(ordinalCongress).join(', ')} | Limit: ${limit || 'all'} | API key: ${hasRealKey ? 'present' : 'DEMO_KEY'}`)

  // Step 1: Topics (skipped in dry-run)
  let topicMap = new Map<string, string>()
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicMap = await ensureAllTopics(congresses)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch enacted laws from API
  console.log('\nStep 2: Fetching enacted laws from Congress.gov API...')
  const allCandidates: CandidateRecord[] = []
  const breakdown = new Map<number, number>()
  let skippedMalformed = 0

  for (const congressNum of congresses) {
    console.log(`  Fetching ${ordinalCongress(congressNum)} Congress...`)
    let bills: CongressBill[]
    try {
      bills = await fetchEnactedLaws(congressNum, apiKey)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR fetching Congress ${congressNum}: ${msg}`)
      breakdown.set(congressNum, 0)
      continue
    }
    console.log(`    Retrieved ${bills.length} raw records`)

    let count = 0
    for (const bill of bills) {
      const rec = buildCandidate(bill)
      if (!rec) { skippedMalformed++; continue }
      allCandidates.push(rec)
      count++
    }
    breakdown.set(congressNum, count)
    console.log(`    Candidates: ${count}`)
  }

  console.log(`\nTotal candidates: ${allCandidates.length} (skipped malformed: ${skippedMalformed})`)
  for (const [num, count] of breakdown) {
    console.log(`  ${ordinalCongress(num)} Congress: ${count}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      billNumber: r.billNumber,
      billType: r.billType,
      congress: r.congress,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      congresses,
      apiKeyPresent: hasRealKey,
      totalCandidates: allCandidates.length,
      congressBreakdown: Object.fromEntries(breakdown),
      sample,
    }

    fs.writeFileSync('pipeline-15-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-15-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nSample titles:')
      allCandidates.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.claimText}`))
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = allCandidates.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, errors = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const topicIds = [
            topicMap.get('root'),
            topicMap.get(String(row.congress)),
          ].filter(Boolean) as string[]
          const result = await writeRow(tx, row, topicIds)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.displayNumber} — ${row.title.slice(0, 70)}`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, errors: ${errors}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  const rows = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nFull ingestion: ${rows.length} rows (per-row transactions)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const row of rows) {
    try {
      const topicIds = [
        topicMap.get('root'),
        topicMap.get(String(row.congress)),
      ].filter(Boolean) as string[]
      const result = await prisma.$transaction(
        (tx) => writeRow(tx, row, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 50 === 0) {
        console.log(`  Progress: ${counts.ingested + counts.skipped}/${rows.length} — ${row.displayNumber}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${row.externalId} — ${msg}`)
      counts.errors++
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

  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB claim count (${dbClaims}) does not match ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
