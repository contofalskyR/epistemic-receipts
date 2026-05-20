// Pipeline 16 — Congress.gov Roll Call Votes (congress_votes_v1)
// Dataset: Congress.gov API (api.congress.gov/v3) — requires CONGRESS_API_KEY env var.
//          Falls back to DEMO_KEY (30 req/hr) if absent; dry-run only in that case.
// Scope: Passage + cloture recorded votes for enacted bills, 113th–119th Congress.
//        Each recorded vote event → one claim: "[Bill] passed/failed [Chamber] N–N on [date]"
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-votes.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-votes.ts --sample 10
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-votes.ts --full [--from 113] [--to 119] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_votes_v1'
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250
const DEFAULT_FROM = 113
const DEFAULT_TO = 119
// In dry-run/sample, cap bill-level action fetches to avoid burning API quota
const DRY_RUN_BILL_LIMIT = 30

// ── Types ──────────────────────────────────────────────────────────────────────

interface CongressBill {
  number: string
  type: string
  congress: number
  title: string
  latestAction: { actionDate: string; text: string }
  url: string
}

interface CongressLawPage {
  bills: CongressBill[]
  pagination: { count: number; next?: string }
}

interface RecordedVote {
  chamber: string
  congress: number
  date: string
  rollNumber: number
  sessionNumber: number
  url: string
}

interface BillAction {
  actionDate: string
  text: string
  type: string
  recordedVotes?: RecordedVote[]
}

interface BillActionsResponse {
  actions: BillAction[]
  pagination?: { count?: number; next?: string }
}

interface VoteCandidate {
  congress: number
  billType: string
  billNumber: string
  billDisplayNumber: string
  billTitle: string
  billSourceUrl: string
  chamber: string
  voteDate: Date
  voteDateStr: string
  yea: number
  nay: number
  present: number
  rollNumber: number | null
  rollUrl: string | null
  voteType: string
  passed: boolean
  externalId: string
  claimText: string
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

const BILL_TYPE_DISPLAY: Record<string, string> = {
  hr: 'H.R.', s: 'S.', hjres: 'H.J.Res.', sjres: 'S.J.Res.',
  hconres: 'H.Con.Res.', sconres: 'S.Con.Res.', hres: 'H.Res.', sres: 'S.Res.',
}

const BILL_TYPE_URL_PATH: Record<string, string> = {
  hr: 'house-bill', s: 'senate-bill',
  hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
  hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
  hres: 'house-simple-resolution', sres: 'senate-simple-resolution',
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}

function billDisplayNumber(type: string, number: string): string {
  return `${BILL_TYPE_DISPLAY[type] ?? type.toUpperCase()} ${number}`
}

function billSourceUrl(congress: number, type: string, number: string): string {
  const path = BILL_TYPE_URL_PATH[type] ?? type
  return `https://www.congress.gov/bill/${ordinal(congress)}-congress/${path}/${number}`
}

function parseVoteCounts(text: string): { yea: number; nay: number; present: number } {
  const m = text.match(/(\d+)\s*[-–]\s*(\d+)/)
  if (!m) return { yea: 0, nay: 0, present: 0 }
  const presentM = text.match(/(\d+)\s+Present/i)
  return {
    yea: parseInt(m[1]!, 10),
    nay: parseInt(m[2]!, 10),
    present: presentM ? parseInt(presentM[1]!, 10) : 0,
  }
}

function classifyVoteType(text: string): string | null {
  const t = text.toLowerCase()
  if (t.includes('cloture')) return 'cloture'
  // House passage patterns
  if (t.includes('on passage') || t.includes('on final passage')) return 'passage'
  // Senate passage patterns
  if (/passed senate|failed of passage in senate/i.test(t)) return 'passage'
  return null
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample [N] | --full [--from 113] [--to 119] [--limit N] [--verbose]')
        process.exit(1) as never
      })()

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
const MIN_INTERVAL = 250

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function congressGet<T>(url: string, retries = 3): Promise<T> {
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
    if (!res.ok) {
      const safeUrl = url.replace(/api_key=[^&]+/, 'api_key=REDACTED')
      throw new Error(`Congress API ${res.status} at ${safeUrl}`)
    }
    return res.json() as Promise<T>
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Fetch enacted bills for one congress via /law endpoint ────────────────────

async function fetchEnactedBills(congress: number, apiKey: string): Promise<CongressBill[]> {
  const all: CongressBill[] = []
  let offset = 0
  for (;;) {
    const url = `${CONGRESS_BASE}/law/${congress}?api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&offset=${offset}&format=json`
    const data = await congressGet<CongressLawPage>(url)
    const bills = data.bills ?? []
    all.push(...bills)
    if (!data.pagination?.next || bills.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

// ── Fetch all actions for one bill ────────────────────────────────────────────

async function fetchBillActions(congress: number, billType: string, number: string, apiKey: string): Promise<BillAction[]> {
  const all: BillAction[] = []
  let offset = 0
  for (;;) {
    const url = `${CONGRESS_BASE}/bill/${congress}/${billType}/${number}/actions?api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&offset=${offset}&format=json`
    const data = await congressGet<BillActionsResponse>(url)
    const actions = data.actions ?? []
    all.push(...actions)
    if (!data.pagination?.next || actions.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

// ── Build vote candidates from a bill + its actions ───────────────────────────

function extractVoteCandidates(bill: CongressBill, actions: BillAction[]): VoteCandidate[] {
  const results: VoteCandidate[] = []
  const billType = bill.type.toLowerCase()
  const billDisplay = billDisplayNumber(billType, bill.number)
  const sourceBillUrl = billSourceUrl(bill.congress, billType, bill.number)

  for (const action of actions) {
    if (!action.recordedVotes || action.recordedVotes.length === 0) continue

    const voteType = classifyVoteType(action.text)
    if (!voteType) continue

    const rv = action.recordedVotes[0]!
    const { yea, nay, present } = parseVoteCounts(action.text)
    if (yea === 0 && nay === 0) continue

    let voteDate: Date
    try {
      voteDate = new Date(action.actionDate + 'T00:00:00Z')
      if (isNaN(voteDate.getTime())) continue
    } catch { continue }

    const chamber = rv.chamber || 'Unknown'
    const chamberKey = chamber.toLowerCase().replace(/\s+/g, '-')
    const rollKey = rv.rollNumber ? `roll${rv.rollNumber}` : action.actionDate.replace(/-/g, '')
    const externalId = `congress_vote_${chamberKey}_${bill.congress}_${billType}_${bill.number}_${rollKey}`

    const passed = yea > nay
    const passedWord = passed ? 'passed' : 'failed'
    const voteLabel = voteType === 'cloture' ? `${chamber} cloture vote` : `${chamber} ${voteType} vote`
    const rollStr = rv.rollNumber ? ` (Roll No. ${rv.rollNumber})` : ''
    const titleSnippet = bill.title.length > 80 ? bill.title.slice(0, 80) + '…' : bill.title
    const claimText = `${billDisplay} (${ordinal(bill.congress)} Congress), "${titleSnippet}": ${passedWord} ${voteLabel} ${yea}–${nay} on ${action.actionDate}${rollStr}`

    const sourceUrl = rv.url || `${sourceBillUrl}/actions`

    results.push({
      congress: bill.congress,
      billType,
      billNumber: bill.number,
      billDisplayNumber: billDisplay,
      billTitle: bill.title,
      billSourceUrl: sourceBillUrl,
      chamber,
      voteDate,
      voteDateStr: action.actionDate,
      yea,
      nay,
      present,
      rollNumber: rv.rollNumber ?? null,
      rollUrl: rv.url ?? null,
      voteType,
      passed,
      externalId,
      claimText,
      sourceUrl,
    })
  }

  return results
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

async function ensureTopicsForVote(tx: TxClient, rec: VoteCandidate): Promise<string[]> {
  const rootId = await ensureTopic(tx, 'congress-roll-call-votes', 'Congress — Roll Call Votes', 'government')
  const congressId = await ensureTopic(
    tx,
    `congress-${rec.congress}-votes`,
    `${ordinal(rec.congress)} Congress — Roll Call Votes`,
    'government',
    'congress-roll-call-votes',
  )
  const chamberSlug = rec.chamber.toLowerCase() === 'house' ? 'house-votes' : 'senate-votes'
  const chamberName = rec.chamber.toLowerCase() === 'house' ? 'House Roll Call Votes' : 'Senate Roll Call Votes'
  const chamberId = await ensureTopic(tx, chamberSlug, chamberName, 'government', 'congress-roll-call-votes')
  return [rootId, congressId, chamberId]
}

// ── Core: write one vote record ───────────────────────────────────────────────

async function writeRow(tx: TxClient, rec: VoteCandidate): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const topicIds = await ensureTopicsForVote(tx, rec)

  const source = await tx.source.create({
    data: {
      name: `Congress.gov: ${rec.billDisplayNumber} (${ordinal(rec.congress)} Congress) — ${rec.chamber} ${rec.voteType} vote${rec.rollNumber ? ` Roll No. ${rec.rollNumber}` : ''}`,
      url: rec.sourceUrl,
      publishedAt: rec.voteDate,
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
      claimEmergedAt: rec.voteDate,
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
        chamber: rec.chamber,
        voteType: rec.voteType,
        yea: rec.yea,
        nay: rec.nay,
        present: rec.present,
        passed: rec.passed,
        rollNumber: rec.rollNumber,
        rollUrl: rec.rollUrl,
        voteDate: rec.voteDateStr,
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
      reason: 'Congress.gov official record — recorded floor vote, HARD_FACT',
      changedAt: rec.voteDate,
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
  const { mode, fromCongress, toCongress, limit, sampleN, verbose } = parseArgs()

  const apiKey = process.env.CONGRESS_API_KEY ?? 'DEMO_KEY'
  const hasRealKey = !!process.env.CONGRESS_API_KEY

  if (!hasRealKey) {
    console.warn('\nWARNING: CONGRESS_API_KEY not set — using DEMO_KEY (30 req/hr, 50/day).')
    console.warn('         Dry-run will be limited to avoid quota exhaustion.\n')
  }

  console.log(`\n── Pipeline 16: Congress.gov Roll Call Votes ──────────────────────────`)
  console.log(`Mode: ${mode} | Congress: ${fromCongress}–${toCongress} | Limit: ${limit || 'all'} | API key: ${hasRealKey ? 'present' : 'DEMO_KEY'}`)

  // Phase 1: fetch enacted bills per congress
  console.log('\nPhase 1: Fetching enacted bills...')
  const allBills: CongressBill[] = []
  const billBreakdown = new Map<number, number>()

  for (let cong = fromCongress; cong <= toCongress; cong++) {
    console.log(`  Fetching ${ordinal(cong)} Congress...`)
    try {
      const bills = await fetchEnactedBills(cong, apiKey)
      allBills.push(...bills)
      billBreakdown.set(cong, bills.length)
      console.log(`    ${bills.length} enacted bills`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ERROR fetching Congress ${cong}: ${msg}`)
      billBreakdown.set(cong, 0)
    }
  }

  console.log(`\nTotal enacted bills retrieved: ${allBills.length}`)

  // Phase 2: fetch actions and extract votes
  // In dry-run/sample, cap bill count to avoid excessive API calls
  const billsToProcess = (mode === 'dry-run' || mode === 'sample')
    ? allBills.slice(0, DRY_RUN_BILL_LIMIT)
    : (limit > 0 ? allBills.slice(0, limit) : allBills)

  console.log(`\nPhase 2: Fetching actions for ${billsToProcess.length} bills...`)
  const allCandidates: VoteCandidate[] = []
  let billsProcessed = 0
  let billsErrored = 0

  for (const bill of billsToProcess) {
    const billType = bill.type.toLowerCase()
    try {
      const actions = await fetchBillActions(bill.congress, billType, bill.number, apiKey)
      const votes = extractVoteCandidates(bill, actions)
      allCandidates.push(...votes)
      billsProcessed++
      if (verbose && votes.length > 0) {
        console.log(`  ${bill.congress}/${billType}/${bill.number} → ${votes.length} vote(s)`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed actions for ${bill.congress}/${billType}/${bill.number}: ${msg}`)
      billsErrored++
    }
    if (billsProcessed % 10 === 0) {
      process.stdout.write(`  Processed ${billsProcessed}/${billsToProcess.length} bills, ${allCandidates.length} votes found...\r`)
    }
  }

  console.log(`\n  Done. Bills processed: ${billsProcessed}, errors: ${billsErrored}`)

  // Congress.gov sometimes returns the same action from multiple source systems
  const seenIds = new Set<string>()
  const dedupedCandidates = allCandidates.filter(r => {
    if (seenIds.has(r.externalId)) return false
    seenIds.add(r.externalId)
    return true
  })
  console.log(`  Raw vote candidates: ${allCandidates.length} → deduplicated: ${dedupedCandidates.length}`)

  const byType = dedupedCandidates.reduce<Record<string, number>>((acc, r) => {
    acc[r.voteType] = (acc[r.voteType] ?? 0) + 1
    return acc
  }, {})
  console.log(`  By type: ${JSON.stringify(byType)}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nPhase 3: Writing dry-run sample (no DB writes)...')

    const sample = dedupedCandidates.slice(0, 20).map(r => ({
      externalId: r.externalId,
      claimText: r.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      metadata: {
        congress: r.congress,
        billType: r.billType,
        billNumber: r.billNumber,
        chamber: r.chamber,
        voteType: r.voteType,
        yea: r.yea,
        nay: r.nay,
        present: r.present,
        passed: r.passed,
        rollNumber: r.rollNumber,
        voteDate: r.voteDateStr,
      },
      sourceUrl: r.sourceUrl,
    }))

    const output = {
      runDate: new Date().toISOString(),
      mode: 'dry-run',
      fromCongress,
      toCongress,
      apiKeyPresent: hasRealKey,
      billsRetrieved: allBills.length,
      billsActionsChecked: billsProcessed,
      billsLimitedTo: DRY_RUN_BILL_LIMIT,
      rawVoteCandidates: allCandidates.length,
      totalVoteCandidates: dedupedCandidates.length,
      byVoteType: byType,
      billBreakdown: Object.fromEntries(billBreakdown),
      note: `Dry-run checked only first ${DRY_RUN_BILL_LIMIT} bills. Full run will cover all ${allBills.length} enacted bills.`,
      sample,
    }

    fs.writeFileSync('pipeline-16-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-16-dry-run-sample.json')

    if (dedupedCandidates.length > 0) {
      console.log('\nSample vote claims:')
      dedupedCandidates.slice(0, 5).forEach((r, i) => console.log(`  ${i + 1}. ${r.claimText}`))
    } else {
      console.log('\nNo vote candidates found in sampled bills (passage/cloture with recorded vote).')
    }

    console.log('\nDry-run complete.')
    console.log('STOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = dedupedCandidates.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, errors = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const result = await writeRow(tx, row)
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] ${row.externalId}`)
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
  const rows = limit > 0 ? dedupedCandidates.slice(0, limit) : dedupedCandidates
  console.log(`\nFull ingestion: ${rows.length} vote records (per-row transactions)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const row of rows) {
    try {
      const result = await prisma.$transaction(
        (tx) => writeRow(tx, row),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 50 === 0) {
        console.log(`  Progress: ${counts.ingested + counts.skipped}/${rows.length} — ${row.externalId}`)
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
