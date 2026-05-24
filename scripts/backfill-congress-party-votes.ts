// Backfill: byPartyJson on existing congress_v1 LegislativeVote rows
//
// Strategy:
//   1. Load LegislativeVote rows whose linked Source.ingestedBy = 'congress_v1'
//      and byPartyJson IS NULL.
//   2. Parse the Source.url to recover congress / bill-type / bill-number
//      (e.g. https://www.congress.gov/bill/118th-congress/senate-bill/619).
//   3. Hit /v3/bill/{congress}/{type}/{number}/actions to enumerate recorded
//      votes, then pick the recordedVote whose chamber matches and whose date
//      is closest to our LegislativeVote.voteDate.
//   4. Fetch /v3/vote/{congress}/{chamber}/{session}/{roll} for the party
//      breakdown and shape it into { PartyName: { yes, no, abstain } }.
//   5. Write byPartyJson back to the row (full mode requires ALLOW_EDITS=true).
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-congress-party-votes.ts --dry-run --limit 5 --verbose
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-congress-party-votes.ts --full
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-congress-party-votes.ts --full --limit 50 --verbose

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CONGRESS_BASE = 'https://api.congress.gov/v3'
const MIN_INTERVAL_MS = 250
const RATE_LIMIT_BACKOFF_MS = 30_000

// ── Bill URL-path → Congress.gov bill-type short code ─────────────────────────

const URL_PATH_TO_BILL_TYPE: Record<string, string> = {
  'house-bill': 'hr',
  'senate-bill': 's',
  'house-joint-resolution': 'hjres',
  'senate-joint-resolution': 'sjres',
  'house-concurrent-resolution': 'hconres',
  'senate-concurrent-resolution': 'sconres',
  'house-simple-resolution': 'hres',
  'senate-simple-resolution': 'sres',
}

// ── CLI ───────────────────────────────────────────────────────────────────────

interface CliArgs {
  mode: 'dry-run' | 'full'
  limit: number
  verbose: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run')
    ? 'dry-run'
    : args.includes('--full')
    ? 'full'
    : null
  if (!mode) {
    console.error('Usage: --dry-run | --full [--limit N] [--verbose]')
    process.exit(1)
  }
  const li = args.indexOf('--limit')
  const limit = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) || 0 : 0
  return { mode, limit, verbose: args.includes('--verbose') }
}

// ── Throttling + HTTP ─────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function throttle(): Promise<void> {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function congressGet<T>(url: string, retries = 4): Promise<T | null> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    let res: Response
    try {
      res = await fetch(url, { headers: { Accept: 'application/json' } })
    } catch (err) {
      if (attempt >= retries) throw err
      await sleep(delay)
      delay *= 2
      continue
    }
    if (res.status === 404) return null
    if (res.status === 429) {
      console.warn(`  HTTP 429 — sleeping ${RATE_LIMIT_BACKOFF_MS}ms`)
      await sleep(RATE_LIMIT_BACKOFF_MS)
      continue
    }
    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      const safeUrl = url.replace(/api_key=[^&]+/, 'api_key=REDACTED')
      throw new Error(`Congress API ${res.status} at ${safeUrl}`)
    }
    return (await res.json()) as T
  }
  return null
}

// ── Bill URL parsing ──────────────────────────────────────────────────────────

interface BillRef {
  congress: number
  billType: string
  billNumber: string
}

function parseBillUrl(url: string): BillRef | null {
  // https://www.congress.gov/bill/118th-congress/senate-bill/619
  const m = url.match(/\/bill\/(\d+)(?:st|nd|rd|th)-congress\/([a-z-]+)\/(\d+)/i)
  if (!m) return null
  const congress = parseInt(m[1]!, 10)
  const pathSegment = m[2]!.toLowerCase()
  const billNumber = m[3]!
  const billType = URL_PATH_TO_BILL_TYPE[pathSegment]
  if (!billType) return null
  if (!Number.isFinite(congress)) return null
  return { congress, billType, billNumber }
}

// ── Bill actions / recorded votes ─────────────────────────────────────────────

interface RecordedVote {
  chamber?: string
  congress?: number
  date?: string // ISO datetime
  rollNumber?: number
  sessionNumber?: number
  url?: string
}

interface BillAction {
  actionDate?: string
  recordedVotes?: RecordedVote[]
}

interface BillActionsResponse {
  actions?: BillAction[]
  pagination?: { count?: number; next?: string }
}

async function fetchBillActions(ref: BillRef, apiKey: string): Promise<RecordedVote[]> {
  const all: RecordedVote[] = []
  let offset = 0
  const limit = 250
  for (;;) {
    const url =
      `${CONGRESS_BASE}/bill/${ref.congress}/${ref.billType}/${ref.billNumber}/actions` +
      `?format=json&limit=${limit}&offset=${offset}&api_key=${encodeURIComponent(apiKey)}`
    const data = await congressGet<BillActionsResponse>(url)
    if (!data) break
    const actions = data.actions ?? []
    for (const a of actions) {
      if (!a.recordedVotes) continue
      for (const rv of a.recordedVotes) {
        // Some payloads include only roll-call-list pointers; require an identifiable roll
        if (rv.rollNumber == null || rv.sessionNumber == null) continue
        all.push(rv)
      }
    }
    if (!data.pagination?.next || actions.length < limit) break
    offset += limit
  }
  return all
}

// ── Vote detail (party breakdown) ─────────────────────────────────────────────

interface PartyVoteRow {
  partyName?: string
  voteType?: string // 'Yea' | 'Nay' | 'Present' | 'Not Voting' | …
  memberCount?: number
}

interface VoteDetailResponse {
  vote?: { partyVotes?: PartyVoteRow[] }
  partyVotes?: PartyVoteRow[]
}

type PartyTally = { yes: number; no: number; abstain: number }

function normalizeVoteType(t: string | undefined): keyof PartyTally | null {
  if (!t) return null
  const v = t.trim().toLowerCase()
  if (v === 'yea' || v === 'aye' || v === 'yes') return 'yes'
  if (v === 'nay' || v === 'no') return 'no'
  if (v === 'present' || v === 'not voting' || v === 'abstain' || v === 'absent') return 'abstain'
  return null
}

function buildByPartyJson(rows: PartyVoteRow[]): Record<string, PartyTally> | null {
  const out: Record<string, PartyTally> = {}
  for (const r of rows) {
    const party = r.partyName?.trim()
    const slot = normalizeVoteType(r.voteType)
    const count = typeof r.memberCount === 'number' ? r.memberCount : Number(r.memberCount ?? 0)
    if (!party || !slot || !Number.isFinite(count) || count <= 0) continue
    const prev = out[party] ?? { yes: 0, no: 0, abstain: 0 }
    prev[slot] += count
    out[party] = prev
  }
  return Object.keys(out).length > 0 ? out : null
}

async function fetchVoteDetail(
  congress: number,
  chamber: string,
  session: number,
  roll: number,
  apiKey: string,
): Promise<PartyVoteRow[] | null> {
  const chamberLower = chamber.toLowerCase()
  const url =
    `${CONGRESS_BASE}/vote/${congress}/${chamberLower}/${session}/${roll}` +
    `?format=json&api_key=${encodeURIComponent(apiKey)}`
  const data = await congressGet<VoteDetailResponse>(url)
  if (!data) return null
  return data.vote?.partyVotes ?? data.partyVotes ?? null
}

// ── Matching logic ────────────────────────────────────────────────────────────

function chamberMatches(rvChamber: string | undefined, rowChamber: string): boolean {
  if (!rvChamber) return false
  return rvChamber.trim().toLowerCase() === rowChamber.trim().toLowerCase()
}

function pickClosestVote(rvs: RecordedVote[], rowChamber: string, voteDate: Date): RecordedVote | null {
  const candidates = rvs.filter((rv) => chamberMatches(rv.chamber, rowChamber))
  if (candidates.length === 0) return null
  let best: RecordedVote | null = null
  let bestDelta = Infinity
  for (const rv of candidates) {
    if (!rv.date) continue
    const t = new Date(rv.date).getTime()
    if (!Number.isFinite(t)) continue
    const delta = Math.abs(t - voteDate.getTime())
    if (delta < bestDelta) {
      bestDelta = delta
      best = rv
    }
  }
  return best
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface LegislativeVoteRow {
  id: string
  chamber: string
  yesCount: number | null
  noCount: number | null
  voteDate: Date | null
  source: { url: string | null } | null
}

interface Counts {
  considered: number
  matched: number
  written: number
  noBillUrl: number
  noRecordedVote: number
  noPartyDetail: number
  errors: number
}

async function main(): Promise<void> {
  const { mode, limit, verbose } = parseArgs()
  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  const apiKey = process.env.CONGRESS_API_KEY
  if (!apiKey) {
    console.error('CONGRESS_API_KEY env var is required.')
    process.exit(1)
  }

  console.log('\n── Backfill: byPartyJson on congress_v1 LegislativeVote rows ─────────')
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Verbose: ${verbose}`)

  const rowsRaw = await prisma.legislativeVote.findMany({
    where: {
      byPartyJson: null,
      source: { ingestedBy: 'congress_v1' },
    },
    select: {
      id: true,
      chamber: true,
      yesCount: true,
      noCount: true,
      voteDate: true,
      source: { select: { url: true } },
    },
    orderBy: { createdAt: 'asc' },
    take: limit > 0 ? limit : undefined,
  })

  const rows: LegislativeVoteRow[] = rowsRaw
  console.log(`Loaded ${rows.length} candidate row(s).\n`)

  const counts: Counts = {
    considered: 0,
    matched: 0,
    written: 0,
    noBillUrl: 0,
    noRecordedVote: 0,
    noPartyDetail: 0,
    errors: 0,
  }

  // Cache bill-level action lookups so multiple LegislativeVote rows for the
  // same bill share one /actions request.
  const actionsCache = new Map<string, RecordedVote[]>()

  for (const row of rows) {
    counts.considered++

    const url = row.source?.url
    if (!url) {
      counts.noBillUrl++
      if (verbose) console.log(`  [skip:no-url] ${row.id}`)
      continue
    }
    const ref = parseBillUrl(url)
    if (!ref) {
      counts.noBillUrl++
      if (verbose) console.log(`  [skip:bad-url] ${row.id} url=${url}`)
      continue
    }
    if (!row.voteDate) {
      counts.noRecordedVote++
      if (verbose) console.log(`  [skip:no-date] ${row.id}`)
      continue
    }

    const cacheKey = `${ref.congress}/${ref.billType}/${ref.billNumber}`
    let rvs = actionsCache.get(cacheKey)
    if (!rvs) {
      try {
        rvs = await fetchBillActions(ref, apiKey)
      } catch (err) {
        counts.errors++
        console.error(`  [error:actions] ${row.id} ${cacheKey}: ${err instanceof Error ? err.message : String(err)}`)
        continue
      }
      actionsCache.set(cacheKey, rvs)
    }

    const rv = pickClosestVote(rvs, row.chamber, row.voteDate)
    if (!rv || rv.rollNumber == null || rv.sessionNumber == null || !rv.chamber) {
      counts.noRecordedVote++
      if (verbose) console.log(`  [skip:no-roll] ${row.id} ${cacheKey} chamber=${row.chamber}`)
      continue
    }

    counts.matched++

    let partyRows: PartyVoteRow[] | null
    try {
      partyRows = await fetchVoteDetail(ref.congress, rv.chamber, rv.sessionNumber, rv.rollNumber, apiKey)
    } catch (err) {
      counts.errors++
      console.error(
        `  [error:vote-detail] ${row.id} ${cacheKey} ${rv.chamber}/${rv.sessionNumber}/${rv.rollNumber}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      )
      continue
    }

    if (!partyRows || partyRows.length === 0) {
      counts.noPartyDetail++
      if (verbose) {
        console.log(
          `  [skip:no-party] ${row.id} ${cacheKey} ${rv.chamber}/${rv.sessionNumber}/${rv.rollNumber}`,
        )
      }
      continue
    }

    const byParty = buildByPartyJson(partyRows)
    if (!byParty) {
      counts.noPartyDetail++
      if (verbose) console.log(`  [skip:empty-party] ${row.id} ${cacheKey}`)
      continue
    }

    if (verbose) {
      const summary = Object.entries(byParty)
        .map(([p, t]) => `${p}=${t.yes}/${t.no}/${t.abstain}`)
        .join(' ')
      console.log(
        `  [match] ${row.id} ${cacheKey} ${rv.chamber}/${rv.sessionNumber}/${rv.rollNumber} → ${summary}`,
      )
    }

    if (mode === 'dry-run') continue

    try {
      await prisma.legislativeVote.update({
        where: { id: row.id },
        data: { byPartyJson: JSON.stringify(byParty) },
      })
      counts.written++
    } catch (err) {
      counts.errors++
      console.error(`  [error:write] ${row.id}: ${err instanceof Error ? err.message : String(err)}`)
    }
  }

  console.log('\n── Summary ──────────────────────────────────────────────────────────')
  console.log(`  Considered:        ${counts.considered}`)
  console.log(`  Matched roll call: ${counts.matched}`)
  console.log(`  Written:           ${counts.written}`)
  console.log(`  Skipped (no URL):  ${counts.noBillUrl}`)
  console.log(`  Skipped (no roll): ${counts.noRecordedVote}`)
  console.log(`  Skipped (no party):${counts.noPartyDetail}`)
  console.log(`  Errors:            ${counts.errors}`)

  if (mode === 'full' && counts.written > 0) {
    const dbCount = await prisma.legislativeVote.count({
      where: { source: { ingestedBy: 'congress_v1' }, byPartyJson: { not: null } },
    })
    console.log(`  Post-write DB: byPartyJson non-null on congress_v1 = ${dbCount}`)
  }
}

main()
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
