// OpenFEC campaign finance pipeline (fec_finance_v1, fec_finance_pac_v1).
// Endpoints:
//   /candidates/totals/  — raised/spent per federal candidate per cycle
//   /totals/pac-party/   — top PACs/Super PACs by total disbursements per cycle
// Cycles: 2012–2024 (all even-year federal election cycles by default)
// Flags: --dry-run, --cycle YYYY (repeatable), --limit N, --pac-limit N, --office P|S|H
//
// Run (dry):
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-fec-finance.ts --dry-run --cycle 2024
// Run (live, all cycles):
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-fec-finance.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = 'https://api.open.fec.gov/v1'
const PIPELINE_CANDIDATE = 'fec_finance_v1'
const PIPELINE_PAC = 'fec_finance_pac_v1'
const DEFAULT_CYCLES = [2012, 2014, 2016, 2018, 2020, 2022, 2024]
const PAGE_DELAY_MS = 250
const TX_TIMEOUT_MS = 30_000
const MAX_RETRIES = 5
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504])

// ── Args ──────────────────────────────────────────────────────────────────────

interface Args {
  cycles: number[]
  limit: number
  pacLimit: number
  office: 'P' | 'S' | 'H' | null
  dryRun: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const cycles: number[] = []
  let limit = 500
  let pacLimit = 100
  let office: 'P' | 'S' | 'H' | null = null
  let dryRun = !process.env.ALLOW_EDITS

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--cycle' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n >= 1980 && n <= 2100) cycles.push(n)
    } else if (a === '--limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) limit = n
    } else if (a === '--pac-limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) pacLimit = n
    } else if (a === '--office' && argv[i + 1]) {
      const v = argv[++i].toUpperCase()
      if (v === 'P' || v === 'S' || v === 'H') office = v as 'P' | 'S' | 'H'
    } else if (a === '--dry-run') {
      dryRun = true
    }
  }

  if (cycles.length === 0) cycles.push(...DEFAULT_CYCLES)
  return { cycles, limit, pacLimit, office, dryRun }
}

// ── HTTP ──────────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

interface FecPagination {
  page: number
  per_page: number
  count: number
  pages: number
}

interface FecEnvelope<T> {
  results: T[]
  pagination: FecPagination
}

async function fecFetch<T>(
  path: string,
  params: Record<string, string | number | string[]>,
  apiKey: string,
): Promise<FecEnvelope<T>> {
  const search = new URLSearchParams()
  search.set('api_key', apiKey)
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) {
      for (const item of v) search.append(k, String(item))
    } else {
      search.set(k, String(v))
    }
  }
  const url = `${BASE_URL}${path}?${search.toString()}`

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    let res: Response
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch (err) {
      if (attempt > MAX_RETRIES) throw err
      const wait = Math.min(2 ** attempt * 1000, 30_000)
      console.log(`  Network error — retrying in ${wait}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(wait)
      continue
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      const wait = (isNaN(retryAfter) ? 60 : retryAfter) * 1000
      console.log(`  Rate limited — waiting ${Math.ceil(wait / 1000)}s before retry`)
      await sleep(wait)
      continue
    }

    if (TRANSIENT_STATUSES.has(res.status)) {
      if (attempt > MAX_RETRIES) throw new Error(`FEC fetch failed: ${res.status} — ${url}`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`FEC fetch failed: ${res.status} — ${url}\n${body.slice(0, 500)}`)
    }

    return res.json() as Promise<FecEnvelope<T>>
  }

  throw new Error('fecFetch: exhausted retries')
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmt(n: number | null | undefined): string {
  if (n == null || n === 0) return '$0'
  return '$' + Math.round(n).toLocaleString('en-US')
}

const OFFICE_LABEL: Record<string, string> = { P: 'President', S: 'Senate', H: 'House' }

function officeLabel(o: string | null | undefined): string {
  return o ? (OFFICE_LABEL[o.toUpperCase()] ?? o) : 'federal office'
}

function partyLabel(p: string | null | undefined, pf: string | null | undefined): string {
  return (pf?.trim() || p?.trim() || 'unaffiliated')
}

// ── Topics ────────────────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Result types ──────────────────────────────────────────────────────────────

interface CandidateTotal {
  candidate_id: string
  name: string | null
  party: string | null
  party_full: string | null
  office: string | null
  office_full: string | null
  state: string | null
  district: string | null
  cycle: number
  receipts: number | null
  disbursements: number | null
  individual_itemized_contributions: number | null
  other_political_committee_contributions: number | null
  cash_on_hand_end_period: string | number | null
  coverage_end_date: string | null
}

interface PacTotal {
  committee_id: string
  committee_name: string | null
  committee_type: string | null
  committee_type_full: string | null
  party: string | null
  state: string | null
  cycle: number
  receipts: number | null
  disbursements: number | null
  independent_expenditures: number | null
  contributions: number | null
  coverage_end_date: string | null
}

// ── Counters ──────────────────────────────────────────────────────────────────

interface Counters { ingested: number; updated: number; skipped: number; failed: number }

function zeroCounters(): Counters { return { ingested: 0, updated: 0, skipped: 0, failed: 0 } }

type WriteResult = 'ingested' | 'updated' | 'skipped' | 'failed'

// ── Candidate totals pass ─────────────────────────────────────────────────────

async function ingestCandidateTotals(
  apiKey: string,
  cycle: number,
  limit: number,
  office: 'P' | 'S' | 'H' | null,
  dryRun: boolean,
  topicId: string,
): Promise<Counters> {
  const counters = zeroCounters()
  const perPage = 100
  let page = 1
  let processed = 0

  console.log(`\n── Candidate totals — cycle ${cycle}${office ? ` office=${office}` : ''} ──`)

  while (processed < limit) {
    const params: Record<string, string | number | string[]> = {
      cycle,
      sort: '-receipts',
      per_page: perPage,
      page,
    }
    if (office) params['office'] = office
    else params['office'] = ['P', 'S', 'H']

    const env = await fecFetch<CandidateTotal>('/candidates/totals/', params, apiKey)
    const results = env.results ?? []
    if (results.length === 0) break

    const batch = results.slice(0, limit - processed)
    processed += batch.length
    console.log(`  Page ${page}: ${batch.length} candidates (total ${processed}/${limit}, API count=${env.pagination.count})`)

    for (const row of batch) {
      try {
        const r = await writeCandidateTotal(row, cycle, dryRun, topicId)
        counters[r]++
      } catch (err) {
        counters.failed++
        console.error(`    Failed ${row.candidate_id} (${row.name}): ${err instanceof Error ? err.message : err}`)
      }
    }

    if (page >= env.pagination.pages || results.length < perPage) break
    page++
    await sleep(PAGE_DELAY_MS)
  }

  return counters
}

async function writeCandidateTotal(
  row: CandidateTotal,
  cycle: number,
  dryRun: boolean,
  topicId: string,
): Promise<WriteResult> {
  const name = row.name?.trim()
  if (!name || !row.candidate_id) return 'skipped'

  const externalId = `${PIPELINE_CANDIDATE}-${row.candidate_id}-${cycle}`
  const party = partyLabel(row.party, row.party_full)
  const state = row.state?.trim().toUpperCase() ?? 'UNKNOWN'
  const office = officeLabel(row.office)
  const raised = row.receipts ?? 0
  const spent = row.disbursements ?? 0

  const claimText =
    `${name} (${party}, ${state}, ${office}) raised ${fmt(raised)} ` +
    `and spent ${fmt(spent)} in the ${cycle} election cycle`

  const sourceUrl = `https://www.fec.gov/data/candidate/${row.candidate_id}/`
  const cycleDate = new Date(Date.UTC(cycle, 0, 1))

  if (dryRun) {
    console.log(`    [DRY] ${row.candidate_id} ${name} cycle=${cycle} raised=${fmt(raised)} spent=${fmt(spent)}`)
    return 'ingested'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId }, select: { id: true } })
  const action: WriteResult = existing ? 'updated' : 'ingested'

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId },
      update: {
        name: `FEC — ${name} ${cycle} totals`,
        url: sourceUrl,
        publishedAt: row.coverage_end_date ? new Date(row.coverage_end_date) : cycleDate,
      },
      create: {
        externalId,
        name: `FEC — ${name} ${cycle} totals`,
        url: sourceUrl,
        publishedAt: row.coverage_end_date ? new Date(row.coverage_end_date) : cycleDate,
        methodologyType: 'primary',
        ingestedBy: PIPELINE_CANDIDATE,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId },
      update: {
        text: claimText,
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        metadata: {
          dataset: PIPELINE_CANDIDATE,
          candidate_id: row.candidate_id,
          cycle,
          office: row.office,
          party: row.party,
          party_full: row.party_full,
          state: row.state,
          receipts: raised,
          disbursements: spent,
          individual_itemized_contributions: row.individual_itemized_contributions,
          other_political_committee_contributions: row.other_political_committee_contributions,
          coverage_end_date: row.coverage_end_date,
        },
      },
      create: {
        externalId,
        text: claimText,
        claimType: 'EMPIRICAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: PIPELINE_CANDIDATE,
        humanReviewed: false,
        autoApproved: true,
        metadata: {
          dataset: PIPELINE_CANDIDATE,
          candidate_id: row.candidate_id,
          cycle,
          office: row.office,
          party: row.party,
          party_full: row.party_full,
          state: row.state,
          receipts: raised,
          disbursements: spent,
          individual_itemized_contributions: row.individual_itemized_contributions,
          other_political_committee_contributions: row.other_political_committee_contributions,
          coverage_end_date: row.coverage_end_date,
        },
      },
    })

    const existingEdge = await tx.edge.findFirst({
      where: { claimId: claim.id, sourceId: source.id, type: 'FOR' },
      select: { id: true },
    })
    if (!existingEdge) {
      await tx.edge.create({
        data: {
          claimId: claim.id,
          sourceId: source.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: PIPELINE_CANDIDATE,
        },
      })
    }

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }, { timeout: TX_TIMEOUT_MS })

  return action
}

// ── PAC totals pass ───────────────────────────────────────────────────────────

// committee_type codes included for major-PAC pass:
// O = Super PAC (Independent Expenditure-Only)
// V = Hybrid PAC with Non-Contribution Account (nonqualified)
// W = Hybrid PAC with Non-Contribution Account (connected)
const PAC_TYPES = ['O', 'V', 'W']

async function ingestPacTotals(
  apiKey: string,
  cycle: number,
  pacLimit: number,
  dryRun: boolean,
  topicId: string,
): Promise<Counters> {
  const counters = zeroCounters()
  let processed = 0

  console.log(`\n── PAC totals — cycle ${cycle} (top ${pacLimit}) ──`)

  for (const ctype of PAC_TYPES) {
    if (processed >= pacLimit) break
    const perPage = Math.min(100, pacLimit - processed)
    const params: Record<string, string | number> = {
      cycle,
      committee_type: ctype,
      sort: '-disbursements',
      per_page: perPage,
      page: 1,
    }

    let env: FecEnvelope<PacTotal>
    try {
      env = await fecFetch<PacTotal>('/totals/pac-party/', params, apiKey)
    } catch (err) {
      console.error(`  Failed to fetch PAC type=${ctype} cycle=${cycle}: ${err instanceof Error ? err.message : err}`)
      continue
    }

    const results = env.results ?? []
    if (results.length === 0) continue

    console.log(`  Type ${ctype}: ${results.length} PACs (API count=${env.pagination.count})`)

    for (const row of results) {
      try {
        const r = await writePacTotal(row, cycle, dryRun, topicId)
        counters[r]++
        processed++
      } catch (err) {
        counters.failed++
        console.error(`    Failed ${row.committee_id} (${row.committee_name}): ${err instanceof Error ? err.message : err}`)
      }
    }

    await sleep(PAGE_DELAY_MS)
  }

  return counters
}

async function writePacTotal(
  row: PacTotal,
  cycle: number,
  dryRun: boolean,
  topicId: string,
): Promise<WriteResult> {
  const name = row.committee_name?.trim()
  if (!name || !row.committee_id) return 'skipped'

  const externalId = `${PIPELINE_PAC}-${row.committee_id}-${cycle}`
  const typeFull = row.committee_type_full ?? row.committee_type ?? 'PAC'
  const raised = row.receipts ?? 0
  const spent = row.disbursements ?? 0
  const ie = row.independent_expenditures ?? 0

  let claimText = `${name} (${typeFull}) raised ${fmt(raised)} and spent ${fmt(spent)} in the ${cycle} election cycle`
  if (ie > 0) claimText += `, including ${fmt(ie)} in independent expenditures`

  const sourceUrl = `https://www.fec.gov/data/committee/${row.committee_id}/`
  const cycleDate = new Date(Date.UTC(cycle, 0, 1))

  if (dryRun) {
    console.log(`    [DRY] ${row.committee_id} "${name}" cycle=${cycle} raised=${fmt(raised)} spent=${fmt(spent)}`)
    return 'ingested'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId }, select: { id: true } })
  const action: WriteResult = existing ? 'updated' : 'ingested'

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId },
      update: {
        name: `FEC — ${name} ${cycle} totals`,
        url: sourceUrl,
        publishedAt: row.coverage_end_date ? new Date(row.coverage_end_date) : cycleDate,
      },
      create: {
        externalId,
        name: `FEC — ${name} ${cycle} totals`,
        url: sourceUrl,
        publishedAt: row.coverage_end_date ? new Date(row.coverage_end_date) : cycleDate,
        methodologyType: 'primary',
        ingestedBy: PIPELINE_PAC,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId },
      update: {
        text: claimText,
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        metadata: {
          dataset: PIPELINE_PAC,
          committee_id: row.committee_id,
          committee_type: row.committee_type,
          committee_type_full: row.committee_type_full,
          cycle,
          receipts: raised,
          disbursements: spent,
          independent_expenditures: ie,
          state: row.state,
          coverage_end_date: row.coverage_end_date,
        },
      },
      create: {
        externalId,
        text: claimText,
        claimType: 'EMPIRICAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: PIPELINE_PAC,
        humanReviewed: false,
        autoApproved: true,
        metadata: {
          dataset: PIPELINE_PAC,
          committee_id: row.committee_id,
          committee_type: row.committee_type,
          committee_type_full: row.committee_type_full,
          cycle,
          receipts: raised,
          disbursements: spent,
          independent_expenditures: ie,
          state: row.state,
          coverage_end_date: row.coverage_end_date,
        },
      },
    })

    const existingEdge = await tx.edge.findFirst({
      where: { claimId: claim.id, sourceId: source.id, type: 'FOR' },
      select: { id: true },
    })
    if (!existingEdge) {
      await tx.edge.create({
        data: {
          claimId: claim.id,
          sourceId: source.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: PIPELINE_PAC,
        },
      })
    }

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }, { timeout: TX_TIMEOUT_MS })

  return action
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENFEC_API_KEY
  if (!apiKey) {
    console.error('Error: OPENFEC_API_KEY not set in environment.')
    process.exit(1)
  }

  const args = parseArgs()

  console.log(`\n=== FEC Finance ingestion (fec_finance_v1 + fec_finance_pac_v1) ===`)
  console.log(`  Cycles     : ${args.cycles.join(', ')}`)
  console.log(`  Cand limit : ${args.limit} per cycle`)
  console.log(`  PAC limit  : ${args.pacLimit} per cycle`)
  console.log(`  Office     : ${args.office ?? 'P+S+H'}`)
  console.log(`  Dry run    : ${args.dryRun}`)

  let candTopicId = ''
  let pacTopicId = ''
  if (!args.dryRun) {
    const financeTopicId = await ensureTopic('campaign-finance-fec', 'FEC Campaign Finance', 'government', 'campaign-finance')
    candTopicId = await ensureTopic('fec-candidate-totals', 'FEC Candidate Totals', 'government', 'campaign-finance-fec')
    pacTopicId = await ensureTopic('fec-pac-totals', 'FEC PAC Totals', 'government', 'campaign-finance-fec')
    void financeTopicId // used implicitly via parent
  }

  const totals = {
    candidates: zeroCounters(),
    pacs: zeroCounters(),
  }

  for (const cycle of args.cycles) {
    const c = await ingestCandidateTotals(apiKey, cycle, args.limit, args.office, args.dryRun, candTopicId)
    totals.candidates.ingested += c.ingested
    totals.candidates.updated += c.updated
    totals.candidates.skipped += c.skipped
    totals.candidates.failed += c.failed

    const p = await ingestPacTotals(apiKey, cycle, args.pacLimit, args.dryRun, pacTopicId)
    totals.pacs.ingested += p.ingested
    totals.pacs.updated += p.updated
    totals.pacs.skipped += p.skipped
    totals.pacs.failed += p.failed
  }

  const totalIngested = totals.candidates.ingested + totals.candidates.updated +
    totals.pacs.ingested + totals.pacs.updated

  console.log(`\n=== Summary ===`)
  console.log(`  Candidates: ingested=${totals.candidates.ingested} updated=${totals.candidates.updated} skipped=${totals.candidates.skipped} failed=${totals.candidates.failed}`)
  console.log(`  PACs      : ingested=${totals.pacs.ingested} updated=${totals.pacs.updated} skipped=${totals.pacs.skipped} failed=${totals.pacs.failed}`)
  console.log(`  Total written: ${totalIngested}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
