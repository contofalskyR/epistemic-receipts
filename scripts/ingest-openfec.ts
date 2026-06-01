// OpenFEC campaign finance ingester (openfec_v1, openfec_ie_v1).
// Dataset: api.open.fec.gov/v1 (Federal Election Commission)
// Scope:
//   1) Candidate fundraising totals — per-cycle aggregate receipts, individual
//      itemized contributions, PAC contributions, plus context fields (party,
//      office, state). One claim per candidate per cycle.
//   2) Independent expenditures — per-cycle Super-PAC outside spending support /
//      oppose totals from Schedule E. One claim per (candidate, cycle,
//      support_oppose_indicator) tuple, gated at total >= $100,000.
//
// Verifiable URLs:
//   - api.open.fec.gov/v1/candidates/totals/
//   - api.open.fec.gov/v1/schedules/schedule_e/totals/by_candidate/
//   - fec.gov/data/candidate/{candidate_id}/ (UI surface)
//
// Run:
//   npx ts-node --project tsconfig.scripts.json scripts/ingest-openfec.ts --cycle 2024 --limit 200
//   --cycle YYYY (repeatable), --limit N, --office P|S|H, --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const BASE_URL = 'https://api.open.fec.gov/v1'
const PIPELINE_CANDIDATE = 'openfec_v1'
const PIPELINE_IE = 'openfec_ie_v1'
const IE_THRESHOLD = 100_000
const PAGE_DELAY_MS = 200
const TX_TIMEOUT_MS = 30_000

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface Args {
  cycles: number[]
  limit: number
  office: 'P' | 'S' | 'H' | null
  dryRun: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  const cycles: number[] = []
  let limit = 200
  let office: 'P' | 'S' | 'H' | null = null
  let dryRun = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--cycle' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n >= 1980 && n <= 2100) cycles.push(n)
    } else if (a === '--limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) limit = n
    } else if (a === '--office' && argv[i + 1]) {
      const v = argv[++i].toUpperCase()
      if (v === 'P' || v === 'S' || v === 'H') office = v
    } else if (a === '--dry-run') {
      dryRun = true
    }
  }

  if (cycles.length === 0) cycles.push(2024)
  return { cycles, limit, office, dryRun }
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
  last_indexes?: Record<string, unknown> | null
}

interface FecEnvelope<T> {
  api_version?: string
  results: T[]
  pagination: FecPagination
}

const MAX_RETRIES = 5
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504])

async function fecFetch<T>(path: string, params: Record<string, string | number | string[]>, apiKey: string): Promise<FecEnvelope<T>> {
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
      if (attempt > MAX_RETRIES) {
        throw new Error(`OpenFEC fetch failed: ${res.status} ${res.statusText} — ${url}`)
      }
      const wait = 2 ** attempt * 1000
      console.log(`  Transient ${res.status} — retrying in ${wait}ms (attempt ${attempt}/${MAX_RETRIES})`)
      await sleep(wait)
      continue
    }

    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`OpenFEC fetch failed: ${res.status} ${res.statusText} — ${url}\n${body.slice(0, 500)}`)
    }

    return res.json() as Promise<FecEnvelope<T>>
  }

  throw new Error('fecFetch: exhausted retries')
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
  cycle: number
  receipts: number | null
  individual_itemized_contributions: number | null
  other_political_committee_contributions: number | null
  disbursements: number | null
  cash_on_hand_end_period: number | null
  coverage_end_date: string | null
}

interface IETotal {
  candidate_id: string
  candidate_name?: string | null
  cycle: number
  support_oppose_indicator: 'S' | 'O' | string | null
  total: number | null
  count?: number | null
}

interface CandidateMeta {
  candidate_id: string
  name: string | null
  party?: string | null
  party_full?: string | null
  office?: string | null
  state?: string | null
}

// ── Formatting ────────────────────────────────────────────────────────────────

function fmtMoney(n: number | null | undefined): string {
  if (n == null) return '0'
  return Math.round(n).toLocaleString('en-US')
}

const OFFICE_LABEL: Record<string, string> = {
  P: 'President',
  S: 'Senate',
  H: 'House',
}

function officeLabel(office: string | null | undefined): string {
  if (!office) return 'federal office'
  return OFFICE_LABEL[office.toUpperCase()] ?? office
}

function partyLabel(party: string | null | undefined, partyFull: string | null | undefined): string {
  if (partyFull && partyFull.trim()) return partyFull.trim()
  if (party && party.trim()) return party.trim()
  return 'unaffiliated'
}

function stateLabel(state: string | null | undefined): string {
  if (!state) return 'unknown'
  return state.trim().toUpperCase()
}

// ── Candidate name cache ──────────────────────────────────────────────────────

const candidateMetaCache = new Map<string, CandidateMeta>()

async function lookupCandidateMeta(apiKey: string, candidateId: string): Promise<CandidateMeta | null> {
  const cached = candidateMetaCache.get(candidateId)
  if (cached) return cached
  try {
    const env = await fecFetch<CandidateMeta>('/candidates/', { candidate_id: candidateId, per_page: 1 }, apiKey)
    const row = env.results?.[0]
    if (!row) return null
    candidateMetaCache.set(candidateId, row)
    return row
  } catch (err) {
    console.error(`  Candidate lookup failed for ${candidateId}: ${err instanceof Error ? err.message : err}`)
    return null
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Candidate-totals pass ─────────────────────────────────────────────────────

interface IngestCounters {
  ingested: number
  updated: number
  skipped: number
  failed: number
}

async function ingestCandidateTotals(
  apiKey: string,
  cycle: number,
  limit: number,
  office: 'P' | 'S' | 'H' | null,
  dryRun: boolean,
  campaignTopicId: string,
): Promise<IngestCounters> {
  const counters: IngestCounters = { ingested: 0, updated: 0, skipped: 0, failed: 0 }
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

    const env = await fecFetch<CandidateTotal>('/candidates/totals/', params, apiKey)
    const results = env.results ?? []
    if (results.length === 0) break

    const remaining = limit - processed
    const batch = results.slice(0, remaining)
    processed += batch.length
    console.log(`  Page ${page}: ${batch.length} candidates (running total ${processed}/${limit})`)

    for (const row of batch) {
      if (row.candidate_id && row.name) {
        candidateMetaCache.set(row.candidate_id, {
          candidate_id: row.candidate_id,
          name: row.name,
          party: row.party,
          party_full: row.party_full,
          office: row.office,
          state: row.state,
        })
      }
      try {
        const result = await writeCandidateTotal(row, cycle, dryRun, campaignTopicId)
        counters[result]++
      } catch (err) {
        counters.failed++
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`    Failed ${row.candidate_id} (${row.name}): ${msg}`)
      }
    }

    if (page >= env.pagination.pages || results.length < perPage) break
    page++
    await sleep(PAGE_DELAY_MS)
  }

  return counters
}

type WriteResult = 'ingested' | 'updated' | 'skipped' | 'failed'

async function writeCandidateTotal(
  row: CandidateTotal,
  cycle: number,
  dryRun: boolean,
  campaignTopicId: string,
): Promise<WriteResult> {
  const name = row.name?.trim()
  if (!name || !row.candidate_id) return 'skipped'

  const sourceId = `${PIPELINE_CANDIDATE}-${row.candidate_id}-${cycle}`
  const office = officeLabel(row.office)
  const party = partyLabel(row.party, row.party_full)
  const state = stateLabel(row.state)
  const receipts = row.receipts ?? 0
  const indiv = row.individual_itemized_contributions ?? 0
  const pacs = row.other_political_committee_contributions ?? 0

  const claimText =
    `${name} raised $${fmtMoney(receipts)} total ` +
    `($${fmtMoney(indiv)} from individuals, $${fmtMoney(pacs)} from PACs) ` +
    `in the ${cycle} election cycle as a ${party} candidate for ${office} in ${state}`

  const sourceUrl = `https://www.fec.gov/data/candidate/${row.candidate_id}/`
  const cycleDate = new Date(Date.UTC(cycle, 0, 1))

  const tags = [
    'campaign-finance',
    'fundraising',
    (row.party ?? '').toLowerCase(),
    (row.office ?? '').toLowerCase(),
    (row.state ?? '').toLowerCase(),
  ].filter(Boolean)

  if (dryRun) {
    console.log(`    [DRY] ${row.candidate_id} cycle=${cycle} receipts=$${fmtMoney(receipts)}`)
    return 'ingested'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId: sourceId }, select: { id: true } })
  const action: WriteResult = existing ? 'updated' : 'ingested'

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId: sourceId },
      update: {
        name: `OpenFEC — ${name} ${cycle} totals`,
        url: sourceUrl,
        publishedAt: row.coverage_end_date ? new Date(row.coverage_end_date) : cycleDate,
      },
      create: {
        externalId: sourceId,
        name: `OpenFEC — ${name} ${cycle} totals`,
        url: sourceUrl,
        publishedAt: row.coverage_end_date ? new Date(row.coverage_end_date) : cycleDate,
        methodologyType: 'primary',
        ingestedBy: PIPELINE_CANDIDATE,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId: sourceId },
      update: {
        text: claimText,
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        metadata: {
          dataset: PIPELINE_CANDIDATE,
          tags,
          candidate_id: row.candidate_id,
          cycle,
          office: row.office,
          party: row.party,
          party_full: row.party_full,
          state: row.state,
          receipts,
          individual_itemized_contributions: indiv,
          other_political_committee_contributions: pacs,
          disbursements: row.disbursements,
          cash_on_hand_end_period: row.cash_on_hand_end_period,
          coverage_end_date: row.coverage_end_date,
        },
      },
      create: {
        externalId: sourceId,
        text: claimText,
        claimType: 'EMPIRICAL',
        currentStatus: 'DISPUTED',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: PIPELINE_CANDIDATE,
        humanReviewed: false,
        autoApproved: false,
        metadata: {
          dataset: PIPELINE_CANDIDATE,
          tags,
          candidate_id: row.candidate_id,
          cycle,
          office: row.office,
          party: row.party,
          party_full: row.party_full,
          state: row.state,
          receipts,
          individual_itemized_contributions: indiv,
          other_political_committee_contributions: pacs,
          disbursements: row.disbursements,
          cash_on_hand_end_period: row.cash_on_hand_end_period,
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
      where: { claimId_topicId: { claimId: claim.id, topicId: campaignTopicId } },
      update: {},
      create: { claimId: claim.id, topicId: campaignTopicId },
    })
  }, { timeout: TX_TIMEOUT_MS })

  return action
}

// ── Independent-expenditure pass ──────────────────────────────────────────────

async function ingestIETotals(
  apiKey: string,
  cycle: number,
  limit: number,
  dryRun: boolean,
  ieTopicId: string,
): Promise<IngestCounters> {
  const counters: IngestCounters = { ingested: 0, updated: 0, skipped: 0, failed: 0 }
  const perPage = 100
  let page = 1
  let processed = 0

  console.log(`\n── Independent expenditures — cycle ${cycle} ──`)

  while (processed < limit) {
    const params: Record<string, string | number> = {
      cycle,
      sort: '-total',
      per_page: perPage,
      page,
    }

    const env = await fecFetch<IETotal>('/schedules/schedule_e/totals/by_candidate/', params, apiKey)
    const results = env.results ?? []
    if (results.length === 0) break

    const remaining = limit - processed
    const batch = results.slice(0, remaining)
    processed += batch.length
    console.log(`  Page ${page}: ${batch.length} rows (running total ${processed}/${limit})`)

    for (const row of batch) {
      try {
        const result = await writeIETotal(row, cycle, dryRun, ieTopicId, apiKey)
        counters[result]++
      } catch (err) {
        counters.failed++
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`    Failed ${row.candidate_id}/${row.support_oppose_indicator}: ${msg}`)
      }
    }

    if (page >= env.pagination.pages || results.length < perPage) break
    page++
    await sleep(PAGE_DELAY_MS)
  }

  return counters
}

async function writeIETotal(
  row: IETotal,
  cycle: number,
  dryRun: boolean,
  ieTopicId: string,
  apiKey: string,
): Promise<WriteResult> {
  const total = row.total ?? 0
  const so = (row.support_oppose_indicator ?? '').toUpperCase()
  if (!row.candidate_id) return 'skipped'
  if (total < IE_THRESHOLD) return 'skipped'

  let name = row.candidate_name?.trim() ?? ''
  if (!name) {
    const meta = await lookupCandidateMeta(apiKey, row.candidate_id)
    name = meta?.name?.trim() ?? ''
  }
  if (!name) return 'skipped'

  const sourceId = `${PIPELINE_IE}-${row.candidate_id}-${cycle}-${so || 'X'}`
  const verb = so === 'S' ? 'supporting' : 'opposing'
  const claimText =
    `Outside groups spent ${verb} ${name} — ` +
    `$${fmtMoney(total)} in independent expenditures in the ${cycle} cycle`

  const sourceUrl = `https://www.fec.gov/data/candidate/${row.candidate_id}/?cycle=${cycle}&tab=spending-against`
  const cycleDate = new Date(Date.UTC(cycle, 0, 1))

  const tags = ['campaign-finance', 'independent-expenditure', 'super-pac']

  if (dryRun) {
    console.log(`    [DRY] ${row.candidate_id} cycle=${cycle} ${so} total=$${fmtMoney(total)}`)
    return 'ingested'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId: sourceId }, select: { id: true } })
  const action: WriteResult = existing ? 'updated' : 'ingested'

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId: sourceId },
      update: {
        name: `OpenFEC — independent expenditures ${verb} ${name} (${cycle})`,
        url: sourceUrl,
        publishedAt: cycleDate,
      },
      create: {
        externalId: sourceId,
        name: `OpenFEC — independent expenditures ${verb} ${name} (${cycle})`,
        url: sourceUrl,
        publishedAt: cycleDate,
        methodologyType: 'primary',
        ingestedBy: PIPELINE_IE,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId: sourceId },
      update: {
        text: claimText,
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        metadata: {
          dataset: PIPELINE_IE,
          tags,
          candidate_id: row.candidate_id,
          cycle,
          support_oppose_indicator: so,
          total,
          count: row.count ?? null,
        },
      },
      create: {
        externalId: sourceId,
        text: claimText,
        claimType: 'EMPIRICAL',
        currentStatus: 'DISPUTED',
        verificationStatus: 'PROVISIONAL',
        claimEmergedAt: cycleDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: PIPELINE_IE,
        humanReviewed: false,
        autoApproved: false,
        metadata: {
          dataset: PIPELINE_IE,
          tags,
          candidate_id: row.candidate_id,
          cycle,
          support_oppose_indicator: so,
          total,
          count: row.count ?? null,
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
          ingestedBy: PIPELINE_IE,
        },
      })
    }

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId: ieTopicId } },
      update: {},
      create: { claimId: claim.id, topicId: ieTopicId },
    })
  }, { timeout: TX_TIMEOUT_MS })

  return action
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const apiKey = process.env.OPENFEC_API_KEY
  if (!apiKey) {
    console.error('Error: OPENFEC_API_KEY not set in environment. Add it to .env.local.')
    process.exit(1)
  }

  const args = parseArgs()
  console.log(`\n=== OpenFEC ingestion ===`)
  console.log(`  Cycles : ${args.cycles.join(', ')}`)
  console.log(`  Limit  : ${args.limit} per endpoint per cycle`)
  console.log(`  Office : ${args.office ?? 'all'}`)
  console.log(`  Dry run: ${args.dryRun}`)

  let campaignTopicId = ''
  let ieTopicId = ''
  if (!args.dryRun) {
    campaignTopicId = await ensureTopic('campaign-finance', 'Campaign Finance', 'government')
    ieTopicId = await ensureTopic('independent-expenditure', 'Independent Expenditures', 'government')
  }

  const totals: Record<string, IngestCounters> = {
    candidate: { ingested: 0, updated: 0, skipped: 0, failed: 0 },
    ie: { ingested: 0, updated: 0, skipped: 0, failed: 0 },
  }

  for (const cycle of args.cycles) {
    const c = await ingestCandidateTotals(apiKey, cycle, args.limit, args.office, args.dryRun, campaignTopicId)
    totals.candidate.ingested += c.ingested
    totals.candidate.updated += c.updated
    totals.candidate.skipped += c.skipped
    totals.candidate.failed += c.failed

    const i = await ingestIETotals(apiKey, cycle, args.limit, args.dryRun, ieTopicId)
    totals.ie.ingested += i.ingested
    totals.ie.updated += i.updated
    totals.ie.skipped += i.skipped
    totals.ie.failed += i.failed
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Candidate totals: ingested=${totals.candidate.ingested} updated=${totals.candidate.updated} skipped=${totals.candidate.skipped} failed=${totals.candidate.failed}`)
  console.log(`  IE totals       : ingested=${totals.ie.ingested} updated=${totals.ie.updated} skipped=${totals.ie.skipped} failed=${totals.ie.failed}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
