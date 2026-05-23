// Enrichment: Individual Member Votes for US Congress
// Fetches per-member vote positions for each LegislativeVote record
// with dataSource='congress_votes_v1', using the rollUrl stored in claim metadata.
// House votes come from clerk.house.gov XML; Senate from senate.gov XML.
//
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-member-votes.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/enrich-member-votes.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
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

async function fetchXml(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'text/xml, application/xml, */*' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
    return res.text()
  }
  throw new Error('Failed after retries')
}

// ── XML parsers ───────────────────────────────────────────────────────────────

interface ParsedMember {
  memberId: string | null
  memberName: string
  memberState: string | null
  memberParty: string | null
  vote: string
}

// House XML: <recorded-vote><legislator name-id="A000055" sort-field="..." party="R" state="AL">Aderholt</legislator><vote>Yea</vote></recorded-vote>
function parseHouseXml(xml: string): ParsedMember[] {
  const results: ParsedMember[] = []
  const blockRe = /<recorded-vote>([\s\S]*?)<\/recorded-vote>/g
  let block: RegExpExecArray | null
  while ((block = blockRe.exec(xml)) !== null) {
    const inner = block[1]!
    const nameId = /name-id="([^"]*)"/.exec(inner)?.[1] ?? null
    const party = /party="([^"]*)"/.exec(inner)?.[1] ?? null
    const state = /state="([^"]*)"/.exec(inner)?.[1] ?? null
    const name = /<legislator[^>]*>([^<]+)<\/legislator>/.exec(inner)?.[1]?.trim() ?? 'Unknown'
    const voteText = /<vote>([^<]+)<\/vote>/.exec(inner)?.[1]?.trim() ?? 'Not Voting'
    results.push({ memberId: nameId, memberName: name, memberState: state, memberParty: party, vote: voteText })
  }
  return results
}

// Senate XML: <member><last_name>X</last_name><first_name>Y</first_name><party>R</party><state>TN</state><vote_cast>Yea</vote_cast><lis_member_id>S289</lis_member_id></member>
function parseSenateXml(xml: string): ParsedMember[] {
  const results: ParsedMember[] = []
  const blockRe = /<member>([\s\S]*?)<\/member>/g
  let block: RegExpExecArray | null
  while ((block = blockRe.exec(xml)) !== null) {
    const inner = block[1]!
    const tag = (t: string) => new RegExp(`<${t}>([^<]*)<\/${t}>`).exec(inner)?.[1]?.trim() ?? null
    const lastName = tag('last_name') ?? ''
    const firstName = tag('first_name') ?? ''
    const party = tag('party')
    const state = tag('state')
    const voteCast = tag('vote_cast') ?? 'Not Voting'
    const lisId = tag('lis_member_id')
    const name = [firstName, lastName].filter(Boolean).join(' ') || 'Unknown'
    results.push({ memberId: lisId, memberName: name, memberState: state, memberParty: party, vote: voteCast })
  }
  return results
}

function parseVoteXml(url: string, xml: string): ParsedMember[] {
  if (url.includes('clerk.house.gov')) return parseHouseXml(xml)
  if (url.includes('senate.gov')) return parseSenateXml(xml)
  throw new Error(`Unknown roll URL host: ${url}`)
}

// ── Normalize chamber name ────────────────────────────────────────────────────
function normalizeChamber(chamber: string): 'house' | 'senate' {
  return chamber.toLowerCase().includes('house') ? 'house' : 'senate'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()

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

  // Load congress_votes_v1 claims for rollUrl lookup
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

  let enriched = 0, skipped = 0, failed = 0, noRollUrl = 0
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

    const rollUrl = typeof meta.rollUrl === 'string' ? meta.rollUrl : null
    const rollNumber = typeof meta.rollNumber === 'number' ? meta.rollNumber : null

    if (!rollUrl) {
      if (verbose) console.log(`  [no-url] ${billKey} (${lv.chamber}): no rollUrl in metadata`)
      noRollUrl++
      continue
    }

    if (mode === 'dry-run') {
      console.log(`  [dry-run] ${billKey} | ${lv.chamber} | roll ${rollNumber ?? 'unknown'}`)
      if (verbose) console.log(`    URL: ${rollUrl}`)
      enriched++
      continue
    }

    try {
      const xml = await fetchXml(rollUrl)
      const members = parseVoteXml(rollUrl, xml)

      if (members.length === 0) {
        if (verbose) console.log(`  [empty] ${billKey} roll ${rollNumber}: no member records in XML`)
        skipped++
        continue
      }

      await prisma.memberVote.createMany({
        data: members.map(m => ({
          legislativeVoteId: lv.id,
          memberName: m.memberName,
          memberState: m.memberState,
          memberParty: m.memberParty,
          memberId: m.memberId,
          chamber: lv.chamber,
          vote: m.vote,
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

  console.log(`\nResults: enriched=${enriched} skipped=${skipped} no-url=${noRollUrl} failed=${failed}`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error(err)
  prisma.$disconnect()
  process.exit(1)
})
