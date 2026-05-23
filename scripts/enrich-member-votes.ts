// Enrichment: Individual Member Votes for US Congress
// Fetches per-member vote positions for each LegislativeVote record
// with dataSource='congress_votes_v1', using Congress.gov API v3.
//
// Requires CONGRESS_API_KEY in .env.local.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-member-votes.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-member-votes.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const MIN_INTERVAL = 300 // ms between requests

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --full [--limit N] [--verbose]')
        process.exit(1) as never
      })()
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0,
    verbose: args.includes('--verbose'),
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

let lastReqAt = 0
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
  throw new Error('Failed after retries')
}

// ── Session number: 1 = first (odd) year of congress, 2 = second (even) year ──
// 113th starts 2013, 114th 2015, etc.
function getSessionNumber(congress: number, voteDate: Date): 1 | 2 {
  const firstYear = 2013 + (congress - 113) * 2
  return voteDate.getFullYear() === firstYear ? 1 : 2
}

// ── Normalize chamber name to congress.gov API slug ───────────────────────────
function normalizeChamber(chamber: string): 'house' | 'senate' {
  return chamber.toLowerCase().includes('house') ? 'house' : 'senate'
}

// ── Congress.gov API response types ──────────────────────────────────────────

interface CgMember {
  bioguideId?: string
  fullName?: string
  lastName?: string
  firstName?: string
  party?: string
  state?: string
  votePosition?: string
}

interface CgVoteResponse {
  vote?: {
    members?: { member?: CgMember[] }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()

  const apiKey = process.env.CONGRESS_API_KEY
  if (!apiKey) {
    console.error('ERROR: CONGRESS_API_KEY not set in environment')
    process.exit(1)
  }

  console.log(`\n── Enrich Member Votes ─────────────────────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // Find all LegislativeVotes with congress_votes_v1 data source
  const legislativeVotes = await prisma.legislativeVote.findMany({
    where: { dataSource: 'congress_votes_v1' },
    include: {
      source: { select: { id: true, externalId: true } },
      memberVotes: { select: { id: true }, take: 1 },
    },
  })
  console.log(`Found ${legislativeVotes.length} congress_votes_v1 LegislativeVote records`)

  // Load congress_votes_v1 claims for roll number lookup
  type VoteClaim = {
    id: string
    externalId: string | null
    metadata: unknown
    claimEmergedAt: Date | null
  }
  const voteClaims: VoteClaim[] = await prisma.claim.findMany({
    where: { ingestedBy: 'congress_votes_v1', deleted: false },
    select: { id: true, externalId: true, metadata: true, claimEmergedAt: true },
  })

  // Build lookup: "congress_type_number" → vote claim array
  const claimsByBillKey = new Map<string, VoteClaim[]>()
  for (const vc of voteClaims) {
    const m = vc.externalId?.match(/^congress_vote_[^_]+_(\d+)_([a-z]+)_(\d+)_/)
    if (!m) continue
    const key = `${m[1]}_${m[2]}_${m[3]}`
    const arr = claimsByBillKey.get(key) ?? []
    arr.push(vc)
    claimsByBillKey.set(key, arr)
  }
  console.log(`Loaded ${voteClaims.length} congress_votes_v1 claims (${claimsByBillKey.size} unique bill keys)`)

  let enriched = 0, skipped = 0, failed = 0, noRoll = 0
  const toProcess = limit > 0 ? legislativeVotes.slice(0, limit) : legislativeVotes

  for (const lv of toProcess) {
    // Skip if already enriched
    if (lv.memberVotes.length > 0) {
      skipped++
      continue
    }

    // Parse source externalId: congress_law_source_{congress}_{type}_{number}
    const sm = lv.source.externalId?.match(/^congress_law_source_(\d+)_([a-z]+)_(\d+)$/)
    if (!sm) {
      if (verbose) console.log(`  [skip] unparseable source externalId: ${lv.source.externalId}`)
      skipped++
      continue
    }

    const congress = parseInt(sm[1]!, 10)
    const billKey = `${sm[1]}_${sm[2]}_${sm[3]}`
    const candidates = claimsByBillKey.get(billKey) ?? []

    if (candidates.length === 0) {
      if (verbose) console.log(`  [skip] no vote claims for bill key: ${billKey}`)
      skipped++
      continue
    }

    // Match claim to this LegislativeVote by chamber
    const chamberApi = normalizeChamber(lv.chamber)
    const matchedClaim = candidates.find(vc => {
      const meta = vc.metadata as Record<string, unknown> | null
      if (!meta) return false
      const c = typeof meta.chamber === 'string' ? normalizeChamber(meta.chamber) : ''
      return c === chamberApi
    }) ?? candidates[0]!

    const meta = matchedClaim.metadata as Record<string, unknown> | null
    if (!meta) {
      if (verbose) console.log(`  [skip] no metadata on claim ${matchedClaim.externalId}`)
      skipped++
      continue
    }

    const rollNumber = typeof meta.rollNumber === 'number' ? meta.rollNumber : null
    if (!rollNumber) {
      if (verbose) console.log(`  [no-roll] ${billKey} (${lv.chamber}): no roll number`)
      noRoll++
      continue
    }

    const voteDate = lv.voteDate ?? matchedClaim.claimEmergedAt
    if (!voteDate) {
      if (verbose) console.log(`  [skip] no vote date for ${billKey}`)
      skipped++
      continue
    }

    const session = getSessionNumber(congress, voteDate)
    const url = `${CONGRESS_BASE}/vote/${congress}/${chamberApi}/${session}/${rollNumber}?api_key=${encodeURIComponent(apiKey)}&format=json`

    if (mode === 'dry-run') {
      const safeUrl = url.replace(/api_key=[^&]+/, 'api_key=REDACTED')
      console.log(`  [dry-run] ${billKey} | ${lv.chamber} | roll ${rollNumber} session ${session}`)
      if (verbose) console.log(`    URL: ${safeUrl}`)
      enriched++
      continue
    }

    try {
      const data = await congressGet<CgVoteResponse>(url)
      const members = data.vote?.members?.member ?? []

      if (members.length === 0) {
        if (verbose) console.log(`  [empty] ${billKey} roll ${rollNumber}: no member records in API response`)
        skipped++
        continue
      }

      await prisma.memberVote.createMany({
        data: members.map(m => ({
          legislativeVoteId: lv.id,
          memberName: m.fullName ?? (`${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() || 'Unknown'),
          memberState: m.state ?? null,
          memberParty: m.party ?? null,
          memberId: m.bioguideId ?? null,
          chamber: lv.chamber,
          vote: m.votePosition ?? 'Not Voting',
        })),
        skipDuplicates: true,
      })

      enriched++
      console.log(`  [enriched] ${billKey} (${lv.chamber} roll ${rollNumber}): ${members.length} members`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  [failed] ${billKey} roll ${rollNumber}: ${msg}`)
      failed++
    }
  }

  console.log(`\nResults: enriched=${enriched} skipped=${skipped} no-roll=${noRoll} failed=${failed}`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
