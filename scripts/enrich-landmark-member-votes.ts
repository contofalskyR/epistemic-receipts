// Enrichment: Individual Member Votes for the B11 landmark rollcall subset (voteview_v1)
//
// Reads data/landmark-rollcalls.json and fetches per-member positions from the
// Voteview per-rollcall API (https://voteview.com/api/download?rollcall_id=...).
// Clerk/Senate XML does not exist for pre-1990 votes; Voteview is the canonical
// member-level source for the whole 1789–present range and is keyed by ICPSR.
//
// Member identity: exact ICPSR join to MemberIdeology (icpsrId, congress, chamber)
// → bioguideId. No fuzzy matching. Members without a MemberIdeology row (or with a
// null bioguideId) get memberId=null but keep name/party/state from the API payload.
// Presidents (POTUS rows, icpsr >= 99000) are excluded — they are not chamber members.
//
// Safety: writes only with --execute; count sanity check (API yea/nay vs DB
// LegislativeVote.yesCount/noCount) must pass or the rollcall is skipped to residue —
// never inferred. Idempotent: rollcalls that already have MemberVote rows are skipped,
// so a killed run resumes cleanly.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-landmark-member-votes.ts            # dry-run all
//      ... --pilot                 # deterministic 25-entry pilot (15 landmark + 10 close-call, era-spread), dry-run
//      ... --pilot --execute      # pilot with writes
//      ... --execute [--limit N]  # full run with writes

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()
const MIN_INTERVAL = 300 // ms between requests

interface SubsetEntry {
  externalId: string
  legislativeVoteId: string
  sourceId: string
  sourceName: string
  voteDate: string
  result: string
  reason: string
  reasonType: 'landmark' | 'close_call'
  sourceUrl: string
}

interface VoteviewVote {
  icpsr: number
  vote: string
  name: string
  party_short_name?: string
  state_abbrev?: string
  district?: string
  vote_modifier?: string
}

interface VoteviewRollcall {
  id: string
  yea_count: number
  nay_count: number
  votes: VoteviewVote[]
}

function parseArgs() {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  return {
    execute: args.includes('--execute'),
    pilot: args.includes('--pilot'),
    verbose: args.includes('--verbose'),
    limit: li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0,
  }
}

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }
let lastReqAt = 0
async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// voteview_source_{congress}_{h|s}_{rollnumber} → e.g. RH0880128
function toRollcallId(externalId: string): { rcId: string; congress: number; chamber: 'House' | 'Senate'; roll: number } | null {
  const m = /^voteview_source_(\d+)_([hs])_(\d+)$/.exec(externalId)
  if (!m) return null
  const congress = parseInt(m[1]!, 10)
  const chamber = m[2] === 'h' ? 'House' : 'Senate'
  const roll = parseInt(m[3]!, 10)
  const rcId = `R${m[2]!.toUpperCase()}${String(congress).padStart(3, '0')}${String(roll).padStart(4, '0')}`
  return { rcId, congress, chamber, roll }
}

async function fetchRollcall(rcId: string, retries = 3): Promise<VoteviewRollcall | null> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(`https://voteview.com/api/download?rollcall_id=${rcId}`, {
      headers: { Accept: 'application/json' },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} for ${rcId} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) return null
    const body = (await res.json()) as { rollcalls?: VoteviewRollcall[] }
    const rc = body.rollcalls?.[0]
    if (!rc || !Array.isArray(rc.votes)) return null
    return rc
  }
  return null
}

// Deterministic era-spread pilot: 15 landmark + 10 close-call, evenly spaced through
// each group in file order (landmarks are grouped by act; close-calls span congresses).
function selectPilot(entries: SubsetEntry[]): SubsetEntry[] {
  const pick = (group: SubsetEntry[], n: number) => {
    if (group.length <= n) return group
    const out: SubsetEntry[] = []
    for (let i = 0; i < n; i++) out.push(group[Math.floor((i * group.length) / n)]!)
    return out
  }
  return [
    ...pick(entries.filter(e => e.reasonType === 'landmark'), 15),
    ...pick(entries.filter(e => e.reasonType === 'close_call'), 10),
  ]
}

async function main() {
  const { execute, pilot, verbose, limit } = parseArgs()
  const mode = execute ? 'EXECUTE' : 'dry-run'
  console.log(`\n── Enrich Landmark Member Votes (voteview_v1) ──────────────────────────`)
  console.log(`Mode: ${mode} | Pilot: ${pilot} | Limit: ${limit || 'all'}`)

  const all: SubsetEntry[] = JSON.parse(
    readFileSync(join(process.cwd(), 'data/landmark-rollcalls.json'), 'utf-8'),
  )
  let entries = pilot ? selectPilot(all) : all
  if (limit > 0) entries = entries.slice(0, limit)
  console.log(`Subset: ${all.length} total → processing ${entries.length}`)

  // ICPSR → bioguide crosswalk, exact (icpsrId, congress, chamber) key
  const ideologyRows = await prisma.memberIdeology.findMany({
    select: { icpsrId: true, congress: true, chamber: true, bioguideId: true },
  })
  const bioguideByKey = new Map<string, string | null>()
  for (const r of ideologyRows) {
    bioguideByKey.set(`${r.icpsrId}_${r.congress}_${r.chamber}`, r.bioguideId)
  }
  console.log(`Crosswalk: ${ideologyRows.length} MemberIdeology rows loaded`)

  let written = 0, wouldWrite = 0, alreadyDone = 0
  let membersTotal = 0, bioguideJoined = 0
  const residue: { externalId: string; reason: string }[] = []

  for (const entry of entries) {
    const parsed = toRollcallId(entry.externalId)
    if (!parsed) {
      residue.push({ externalId: entry.externalId, reason: 'unparseable externalId' })
      continue
    }
    const { rcId, congress, chamber } = parsed

    const lv = await prisma.legislativeVote.findUnique({
      where: { id: entry.legislativeVoteId },
      select: { id: true, chamber: true, yesCount: true, noCount: true, memberVotes: { select: { id: true }, take: 1 } },
    })
    if (!lv) {
      residue.push({ externalId: entry.externalId, reason: 'LegislativeVote id not found in DB' })
      continue
    }
    if (lv.memberVotes.length > 0) {
      alreadyDone++
      if (verbose) console.log(`  [skip] ${rcId}: already has MemberVote rows`)
      continue
    }

    const rc = await fetchRollcall(rcId)
    if (!rc) {
      residue.push({ externalId: entry.externalId, reason: `Voteview API returned no rollcall for ${rcId}` })
      continue
    }

    // Exclude POTUS rows only. NOTE: do not filter on icpsr ranges — Voteview assigns
    // 99xxx ICPSRs to real members too (e.g. Thurmond 99369 after his party switch).
    const members = rc.votes.filter(v => v.vote_modifier !== 'president' && v.district !== 'POTUS' && v.state_abbrev !== 'USA')
    if (members.length === 0) {
      residue.push({ externalId: entry.externalId, reason: `no member votes in API payload for ${rcId}` })
      continue
    }

    // Vote normalization: paired/announced positions are not cast votes — label them
    // explicitly so MemberVote tallies reconcile against official yea/nay counts.
    const voteLabel = (v: VoteviewVote): string => {
      const base = v.vote === 'Abs' ? 'Not Voting' : v.vote
      if (v.vote_modifier === 'paired') return `Paired ${base}`
      if (v.vote_modifier === 'announced') return `Announced ${base}`
      return base
    }

    // Count sanity: plain cast tallies must match BOTH the API totals and the DB
    // LegislativeVote counts (same upstream source). Mismatch → residue, never inferred.
    const plain = members.filter(v => !v.vote_modifier)
    const yea = plain.filter(v => v.vote === 'Yea').length
    const nay = plain.filter(v => v.vote === 'Nay').length
    if (yea !== rc.yea_count || nay !== rc.nay_count) {
      residue.push({ externalId: entry.externalId, reason: `tally mismatch: parsed ${yea}-${nay} vs API ${rc.yea_count}-${rc.nay_count}` })
      continue
    }
    if ((lv.yesCount != null && rc.yea_count !== lv.yesCount) || (lv.noCount != null && rc.nay_count !== lv.noCount)) {
      residue.push({ externalId: entry.externalId, reason: `count mismatch: API ${rc.yea_count}-${rc.nay_count} vs DB ${lv.yesCount}-${lv.noCount}` })
      continue
    }

    const rows = members.map(v => {
      const bioguide = bioguideByKey.get(`${v.icpsr}_${congress}_${chamber}`) ?? null
      if (bioguide) bioguideJoined++
      return {
        legislativeVoteId: lv.id,
        memberName: v.name,
        memberState: v.state_abbrev ?? null,
        memberParty: v.party_short_name ?? null,
        memberId: bioguide,
        chamber: lv.chamber,
        vote: voteLabel(v),
      }
    })
    membersTotal += rows.length

    if (!execute) {
      wouldWrite++
      console.log(`  [dry-run] ${rcId} | ${entry.reason} | ${rows.length} members (tallied ${yea}-${nay}, API ${rc.yea_count}-${rc.nay_count})`)
      continue
    }

    await prisma.memberVote.createMany({ data: rows, skipDuplicates: true })
    written++
    console.log(`  [written] ${rcId} | ${entry.reason} | ${rows.length} members (${yea}-${nay})`)
  }

  console.log(`\nResults: ${execute ? `written=${written}` : `would-write=${wouldWrite}`} already-done=${alreadyDone} residue=${residue.length}`)
  console.log(`Members: ${membersTotal} rows | bioguide joined: ${bioguideJoined} (${membersTotal ? ((100 * bioguideJoined) / membersTotal).toFixed(1) : 0}%)`)
  if (residue.length > 0) {
    console.log(`\nResidue (skipped, never inferred):`)
    for (const r of residue) console.log(`  - ${r.externalId}: ${r.reason}`)
  }
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
