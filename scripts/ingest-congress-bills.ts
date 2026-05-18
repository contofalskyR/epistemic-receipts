// Pipeline 1 — Congress Enacted Bills
// Dataset: Congress.gov API (api.congress.gov/v3) — requires CONGRESS_API_KEY env var.
// Scope: Enacted bills (HR, S, HJRES, SJRES). Default 93rd–119th Congress (1973–present).
// Each bill gets three topic tags: root, per-congress, and presidential era.
// Run: npx tsx scripts/ingest-congress-bills.ts --dry-run
//      npx tsx scripts/ingest-congress-bills.ts --sample 10
//      npx tsx scripts/ingest-congress-bills.ts --full [--from 93] [--to 119] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_bills_v1'
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const API_KEY = process.env.CONGRESS_API_KEY
if (!API_KEY) { console.error('CONGRESS_API_KEY not set'); process.exit(1) }

const PAGE_SIZE = 250
const DEFAULT_FROM = 93
const DEFAULT_TO = 119

// ── Presidential era mapping ──────────────────────────────────────────────────

interface PresidentialEra {
  slug: string
  name: string
  presidents: string   // display label
  congresses: number[] // inclusive congress numbers
}

const PRESIDENTIAL_ERAS: PresidentialEra[] = [
  { slug: 'era-nixon-ford',   name: 'Nixon–Ford Era',      presidents: 'Nixon / Ford',   congresses: [93, 94]                   },
  { slug: 'era-carter',       name: 'Carter Era',           presidents: 'Carter',         congresses: [95, 96]                   },
  { slug: 'era-reagan',       name: 'Reagan Era',           presidents: 'Reagan',         congresses: [97, 98, 99, 100]          },
  { slug: 'era-bush-sr',      name: 'Bush Sr. Era',         presidents: 'Bush Sr.',       congresses: [101, 102]                 },
  { slug: 'era-clinton',      name: 'Clinton Era',          presidents: 'Clinton',        congresses: [103, 104, 105, 106]       },
  { slug: 'era-bush-jr',      name: 'Bush Jr. Era',         presidents: 'Bush Jr.',       congresses: [107, 108, 109, 110]       },
  { slug: 'era-obama',        name: 'Obama Era',            presidents: 'Obama',          congresses: [111, 112, 113, 114]       },
  { slug: 'era-trump-1',      name: 'Trump 1st Term',       presidents: 'Trump (1st)',    congresses: [115, 116]                 },
  { slug: 'era-biden',        name: 'Biden Era',            presidents: 'Biden',          congresses: [117, 118]                 },
  { slug: 'era-trump-2',      name: 'Trump 2nd Term',       presidents: 'Trump (2nd)',    congresses: [119]                      },
]

const eraByCongressMap = new Map<number, PresidentialEra>()
for (const era of PRESIDENTIAL_ERAS) {
  for (const c of era.congresses) eraByCongressMap.set(c, era)
}

function eraForCongress(congress: number): PresidentialEra | null {
  return eraByCongressMap.get(congress) ?? null
}

// Bill types that can become public law
const BILL_TYPES = ['hr', 's', 'hjres', 'sjres'] as const
type BillType = typeof BILL_TYPES[number]

// ── Types ─────────────────────────────────────────────────────────────────────

interface CongressBill {
  congress: number
  number: string
  type: string
  title: string
  originChamber: string
  latestAction: { actionDate: string; text: string }
  updateDate: string
  url: string
}

interface BillListPage {
  bills: CongressBill[]
  pagination?: { count?: number; total?: number; next?: string }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  congress: number
  billType: string
  billNumber: string
  title: string
  enactedDate: Date
  publicLawNumber: string | null
  sourceUrl: string
  externalId: string
  claimText: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --sample [N] | --full [--from 113] [--to 119] [--limit N] [--verbose]'); process.exit(1) as never })()

  const fi = args.indexOf('--from')
  const ti = args.indexOf('--to')
  const li = args.indexOf('--limit')
  const si = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    fromCongress: fi !== -1 ? parseInt(args[fi + 1] ?? String(DEFAULT_FROM), 10) : DEFAULT_FROM,
    toCongress: ti !== -1 ? parseInt(args[ti + 1] ?? String(DEFAULT_TO), 10) : DEFAULT_TO,
    limit: li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0,
    sampleN: si !== -1 ? parseInt(args[si + 1] ?? '10', 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 250 // 4 req/s, well under the 5,000/hr limit

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function congressFetch(url: string, retries = 3): Promise<BillListPage> {
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
    if (!res.ok) throw new Error(`Congress API ${res.status} at ${url}`)
    return res.json() as Promise<BillListPage>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch enacted bills for one congress + type ───────────────────────────────

async function fetchEnactedBills(congress: number, billType: BillType): Promise<CongressBill[]> {
  const all: CongressBill[] = []
  let offset = 0

  for (;;) {
    const url = `${CONGRESS_BASE}/bill/${congress}/${billType}?api_key=${API_KEY}&limit=${PAGE_SIZE}&offset=${offset}&sort=updateDate+desc&format=json`
    const data = await congressFetch(url)
    const bills = data.bills ?? []

    for (const bill of bills) {
      if (isEnacted(bill)) all.push(bill)
    }

    const total = data.pagination?.total ?? bills.length
    offset += bills.length
    if (bills.length < PAGE_SIZE || offset >= total) break
  }

  return all
}

function isEnacted(bill: CongressBill): boolean {
  return /Became Public Law/i.test(bill.latestAction?.text ?? '')
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPublicLawNumber(actionText: string): string | null {
  const match = actionText.match(/Public Law No[.:]\s*([\d-]+)/i)
  return match ? (match[1] ?? null) : null
}

const BILL_TYPE_DISPLAY: Record<string, string> = {
  hr: 'H.R.',
  s: 'S.',
  hjres: 'H.J.Res.',
  sjres: 'S.J.Res.',
}

const BILL_TYPE_URL_PATH: Record<string, string> = {
  hr: 'house-bill',
  s: 'senate-bill',
  hjres: 'house-joint-resolution',
  sjres: 'senate-joint-resolution',
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}

function buildSourceUrl(congress: number, billType: string, number: string): string {
  const path = BILL_TYPE_URL_PATH[billType.toLowerCase()] ?? billType.toLowerCase()
  return `https://www.congress.gov/bill/${ordinal(congress)}-congress/${path}/${number}`
}

function buildClaimText(rec: Omit<CandidateRecord, 'claimText' | 'externalId' | 'sourceUrl'>): string {
  const typeDisplay = BILL_TYPE_DISPLAY[rec.billType.toLowerCase()] ?? rec.billType.toUpperCase()
  const dateStr = rec.enactedDate.toISOString().split('T')[0]!
  const plPart = rec.publicLawNumber ? `, enacted as Public Law No. ${rec.publicLawNumber}` : ', enacted into law'
  return `${typeDisplay} ${rec.billNumber} (${ordinal(rec.congress)} Congress), "${rec.title}"${plPart} on ${dateStr}.`
}

function buildCandidate(bill: CongressBill): CandidateRecord | null {
  if (!bill.number || !bill.title || !bill.latestAction?.actionDate) return null
  const billType = bill.type?.toLowerCase() ?? ''
  if (!BILL_TYPES.includes(billType as BillType)) return null

  let enactedDate: Date
  try {
    enactedDate = new Date(bill.latestAction.actionDate + 'T00:00:00Z')
    if (isNaN(enactedDate.getTime())) return null
  } catch { return null }

  const publicLawNumber = extractPublicLawNumber(bill.latestAction.text)
  const externalId = `congress_bill_${billType}_${bill.congress}_${bill.number}`
  const sourceUrl = buildSourceUrl(bill.congress, billType, bill.number)

  const partial = { congress: bill.congress, billType, billNumber: bill.number, title: bill.title, enactedDate, publicLawNumber }
  return {
    ...partial,
    sourceUrl,
    externalId,
    claimText: buildClaimText(partial),
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function ensureTopic(tx: TxClient, slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await tx.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }

  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await tx.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await tx.topic.create({ data: { slug, name, domain, parentTopicId } })
  topicCache.set(slug, created.id)
  return created.id
}

async function ensureTopicsForRecord(tx: TxClient, rec: CandidateRecord): Promise<string[]> {
  const rootId = await ensureTopic(tx, 'congress-enacted-bills', 'Congress — Enacted Bills', 'government')

  const congressSlug = `congress-${rec.congress}th-enacted`
  const congressId = await ensureTopic(
    tx,
    congressSlug,
    `${ordinal(rec.congress)} Congress — Enacted Bills`,
    'government',
    'congress-enacted-bills',
  )

  const topicIds = [rootId, congressId]

  const era = eraForCongress(rec.congress)
  if (era) {
    const eraId = await ensureTopic(
      tx,
      era.slug,
      `${era.name} — Enacted Legislation`,
      'government',
      'congress-enacted-bills',
    )
    topicIds.push(eraId)
  }

  return topicIds
}

// ── Core: write one record ────────────────────────────────────────────────────

async function writeRow(tx: TxClient, rec: CandidateRecord): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const topicIds = await ensureTopicsForRecord(tx, rec)

  const source = await tx.source.create({
    data: {
      name: `Congress.gov: ${BILL_TYPE_DISPLAY[rec.billType] ?? rec.billType.toUpperCase()} ${rec.billNumber} (${ordinal(rec.congress)} Congress)`,
      url: rec.sourceUrl,
      publishedAt: rec.enactedDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `${rec.externalId}_source`,
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
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        congress: rec.congress,
        billType: rec.billType,
        billNumber: rec.billNumber,
        publicLawNumber: rec.publicLawNumber,
        enactedDate: rec.enactedDate.toISOString().split('T')[0],
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
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 95,
      reason: 'Congress.gov official record — enacted legislation, HARD_FACT',
      changedAt: rec.enactedDate,
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!API_KEY) { console.error('CONGRESS_API_KEY not set'); process.exit(1) }
  const { mode, fromCongress, toCongress, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 1: Congress Enacted Bills ──────────────────────────────`)
  console.log(`Mode: ${mode} | Congress: ${fromCongress}–${toCongress} | Types: ${BILL_TYPES.join(', ')} | Limit: ${limit || 'all'}`)

  // Step 1: Fetch all enacted bills
  console.log('\nStep 1: Fetching enacted bills from Congress.gov API...')
  const allCandidates: CandidateRecord[] = []
  const congressBreakdown = new Map<number, number>()
  let skippedMalformed = 0

  for (let cong = fromCongress; cong <= toCongress; cong++) {
    let congCount = 0
    process.stdout.write(`  Congress ${cong}: `)
    for (const billType of BILL_TYPES) {
      const bills = await fetchEnactedBills(cong, billType)
      for (const bill of bills) {
        const rec = buildCandidate(bill)
        if (!rec) { skippedMalformed++; continue }
        allCandidates.push(rec)
        congCount++
      }
      process.stdout.write(`${billType.toUpperCase()}(${bills.length}) `)
    }
    congressBreakdown.set(cong, congCount)
    console.log(`→ ${congCount} enacted`)
  }

  console.log(`\nTotal candidates: ${allCandidates.length} (skipped malformed: ${skippedMalformed})`)
  console.log('Per-congress breakdown:')
  for (const [cong, count] of congressBreakdown) {
    console.log(`  ${ordinal(cong)} Congress: ${count}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nDry-run sample (first 10):')
    for (const rec of allCandidates.slice(0, 10)) {
      console.log(`  [${rec.congress}] ${rec.externalId}`)
      console.log(`    ${rec.claimText}`)
      console.log(`    ${rec.sourceUrl}`)
    }
    console.log('\nDry-run complete. STOP — awaiting explicit go-ahead from Robert before sample run.')
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
          const result = await writeRow(tx, row)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
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
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, row),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 50 === 0) {
        console.log(`  Progress: ${counts.ingested}/${rows.length} — ${row.externalId}`)
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
