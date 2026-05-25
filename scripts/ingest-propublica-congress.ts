// Pipeline 111 — ProPublica Congress API: Roll Call Votes
// Dataset: ProPublica Congress API (propublica.org/datastore/api/propublica-congress-api)
// Scope: US Congress roll call votes — House + Senate, recent to historical via offset pagination
// Pipeline tag: propublica_congress_v1
// Run: npx tsx scripts/ingest-propublica-congress.ts --dry-run
//      npx tsx scripts/ingest-propublica-congress.ts --full [--limit N] [--verbose]
//      Requires PROPUBLICA_API_KEY in .env.local (free at propublica.org/datastore/api/propublica-congress-api)
//      Full run also requires ALLOW_EDITS=true

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const INGESTED_BY = 'propublica_congress_v1'
const PP_BASE = 'https://api.propublica.org/congress/v1'
const PAGE_SIZE = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface PpPartyVotes {
  yes: number
  no: number
  not_voting: number
  majority_position?: string
}

interface PpTotals {
  yes: number
  no: number
  not_voting: number
  present?: number
}

interface PpVote {
  congress: number
  chamber: string
  session: number
  roll_call: number
  source?: string
  url?: string
  question: string
  question_text?: string
  description: string
  vote_type: string
  date: string
  time: string
  result: string
  democratic: PpPartyVotes
  republican: PpPartyVotes
  independent: PpPartyVotes
  total: PpTotals
  bill?: {
    bill_id?: string
    number?: string
    title?: string
    api_uri?: string
    latest_action?: string
  }
}

interface PpRecentVotesResponse {
  status: string
  results: {
    chamber: string
    num_results: number
    offset: number
    votes: PpVote[]
  }
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateVote {
  externalId: string
  sourceExternalId: string
  claimText: string
  sourceUrl: string
  congress: number
  chamber: string
  session: number
  rollCall: number
  result: string
  voteDate: Date
  metadata: Record<string, unknown>
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --full [--limit N] [--verbose]'); process.exit(1) as never })()
  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? parseInt(args[li + 1] ?? '0', 10) || 0 : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 400

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function ppFetch(url: string, apiKey: string, retries = 3): Promise<PpRecentVotesResponse> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: { 'X-API-Key': apiKey, Accept: 'application/json' },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`ProPublica API ${res.status} at ${url}`)
    return res.json() as Promise<PpRecentVotesResponse>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeChamber(chamber: string): 'house' | 'senate' | 'other' {
  const l = chamber.toLowerCase()
  if (l.includes('house')) return 'house'
  if (l.includes('senate')) return 'senate'
  return 'other'
}

function buildSourceUrl(vote: PpVote): string {
  if (vote.source) return vote.source
  if (vote.url) return vote.url
  return `https://www.congress.gov/search?q=%7B%22congress%22%3A%22${vote.congress}%22%7D`
}

function buildExternalId(vote: PpVote): string {
  return `propublica_vote_${vote.congress}_${normalizeChamber(vote.chamber)}_${vote.session ?? 1}_${vote.roll_call}`
}

function buildClaimText(vote: PpVote): string {
  const chamber = normalizeChamber(vote.chamber) === 'senate' ? 'Senate' : 'House'
  const desc = (vote.description?.trim() || vote.question?.trim() || 'Unnamed vote').slice(0, 200)
  return `${chamber} Vote #${vote.roll_call} (${vote.congress}th Congress): ${desc} — Result: ${vote.result}`
}

function buildCandidate(vote: PpVote): CandidateVote | null {
  if (!vote.congress || !vote.chamber || !vote.roll_call || !vote.date) return null
  const voteDate = new Date(vote.date + 'T00:00:00Z')
  if (isNaN(voteDate.getTime())) return null
  const externalId = buildExternalId(vote)
  return {
    externalId,
    sourceExternalId: `${externalId}_src`,
    claimText: buildClaimText(vote),
    sourceUrl: buildSourceUrl(vote),
    congress: vote.congress,
    chamber: vote.chamber,
    session: vote.session ?? 1,
    rollCall: vote.roll_call,
    result: vote.result,
    voteDate,
    metadata: {
      dataset: INGESTED_BY,
      congress: vote.congress,
      chamber: vote.chamber,
      session: vote.session ?? 1,
      rollCall: vote.roll_call,
      result: vote.result,
      democraticYes: vote.democratic?.yes ?? 0,
      democraticNo: vote.democratic?.no ?? 0,
      democraticNotVoting: vote.democratic?.not_voting ?? 0,
      republicanYes: vote.republican?.yes ?? 0,
      republicanNo: vote.republican?.no ?? 0,
      republicanNotVoting: vote.republican?.not_voting ?? 0,
      independentYes: vote.independent?.yes ?? 0,
      independentNo: vote.independent?.no ?? 0,
      independentNotVoting: vote.independent?.not_voting ?? 0,
      totalYes: vote.total?.yes ?? 0,
      totalNo: vote.total?.no ?? 0,
      totalNotVoting: vote.total?.not_voting ?? 0,
      date: vote.date,
      billId: vote.bill?.bill_id ?? null,
      question: vote.question,
    },
  }
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

async function fetchAllVotes(apiKey: string, dryRun: boolean): Promise<CandidateVote[]> {
  const all: CandidateVote[] = []
  let offset = 0
  let skippedMalformed = 0

  for (;;) {
    const url = `${PP_BASE}/both/votes/recent.json?offset=${offset}`
    let data: PpRecentVotesResponse
    try {
      data = await ppFetch(url, apiKey)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch failed at offset ${offset}: ${msg}`)
      break
    }

    const votes = data.results?.votes ?? []
    if (votes.length === 0) break

    for (const vote of votes) {
      const candidate = buildCandidate(vote)
      if (!candidate) { skippedMalformed++; continue }
      all.push(candidate)
    }

    console.log(`  Fetched offset ${offset}: ${votes.length} votes (total so far: ${all.length})`)

    if (dryRun) break
    if (votes.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  if (skippedMalformed > 0) console.warn(`  Skipped ${skippedMalformed} malformed vote records`)
  return all
}

// ── Topic management ──────────────────────────────────────────────────────────

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  const existing = await prisma.topic.findUnique({ where: { slug }, select: { id: true } })
  if (existing) return existing.id
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  return created.id
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateVote,
  topicIds: string[],
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const existingSrc = await tx.source.findUnique({ where: { externalId: rec.sourceExternalId }, select: { id: true } })
  const sourceId = existingSrc?.id ?? (await tx.source.create({
    data: {
      name: `ProPublica: ${rec.chamber} Vote #${rec.rollCall} (${rec.congress}th Congress)`,
      url: rec.sourceUrl,
      publishedAt: rec.voteDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.sourceExternalId,
    },
  })).id

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
      metadata: rec.metadata as Prisma.InputJsonValue,
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId,
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
      reason: 'ProPublica Congress API — official roll call vote with party breakdown',
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
  const { mode, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 111: ProPublica Congress — Roll Call Votes ────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Tag: ${INGESTED_BY}`)

  const apiKey = process.env.PROPUBLICA_API_KEY ?? ''
  if (!apiKey) {
    console.error('\nPROPUBLICA_API_KEY not set in .env.local')
    console.error('  Get a free key at: https://www.propublica.org/datastore/api/propublica-congress-api')
    console.error('  Add to .env.local: PROPUBLICA_API_KEY=your-key-here')
    if (mode === 'dry-run') {
      const schema = {
        note: 'PROPUBLICA_API_KEY required — no data fetched',
        keyUrl: 'https://www.propublica.org/datastore/api/propublica-congress-api',
        exampleRecord: {
          claimText: 'House Vote #123 (118th Congress): On Passage of H.R.1 — Result: Passed',
          externalId: 'propublica_vote_118_house_1_123',
          claimType: 'INSTITUTIONAL',
          currentStatus: 'HARD_FACT',
          verificationStatus: 'VERIFIED',
          ingestedBy: INGESTED_BY,
          source: { url: 'https://clerk.house.gov/evs/2023/roll123.xml', methodologyType: 'primary' },
          metadata: {
            congress: 118, chamber: 'House', session: 1, rollCall: 123,
            result: 'Passed',
            democraticYes: 200, democraticNo: 5, democraticNotVoting: 10,
            republicanYes: 20, republicanNo: 200, republicanNotVoting: 10,
            date: '2023-01-12',
          },
        },
      }
      fs.writeFileSync('pipeline-111-dry-run-sample.json', JSON.stringify(schema, null, 2))
      console.log('\nWritten: pipeline-111-dry-run-sample.json (schema only — API key required for live data)')
    }
    process.exit(1)
  }

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true environment variable')
    process.exit(1)
  }

  // Step 1: Topics
  let topicRootId = ''
  let topicHouseId = ''
  let topicSenateId = ''
  if (mode === 'full') {
    console.log('\nStep 1: Ensuring topics...')
    topicRootId = await ensureTopic('us-congress-votes', 'US Congress Roll Call Votes', 'government')
    topicHouseId = await ensureTopic('us-house-votes', 'US House Roll Call Votes', 'government')
    topicSenateId = await ensureTopic('us-senate-votes', 'US Senate Roll Call Votes', 'government')
    console.log('  Topics ready.')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch
  console.log('\nStep 2: Fetching vote records from ProPublica API...')
  const allCandidates = await fetchAllVotes(apiKey, mode === 'dry-run')
  const candidates = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')
    const sample = candidates.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      congress: r.congress,
      chamber: r.chamber,
      rollCall: r.rollCall,
      result: r.result,
      voteDate: r.voteDate.toISOString().split('T')[0],
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
      metadata: r.metadata,
    }))
    const output = {
      runDate: new Date().toISOString(),
      totalFetched: candidates.length,
      note: 'Dry-run: no DB writes. Run --full with ALLOW_EDITS=true to ingest.',
      sample,
    }
    fs.writeFileSync('pipeline-111-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-111-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log(`\nStep 3: Full ingestion of ${candidates.length} vote records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    const chamberNorm = normalizeChamber(rec.chamber)
    const chamberTopicId = chamberNorm === 'senate' ? topicSenateId : topicHouseId
    const topicIds = [topicRootId, chamberTopicId].filter(Boolean) as string[]

    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 500 === 0) {
        console.log(`  Progress: ${counts.ingested} ingested — ${rec.congress}th ${rec.chamber} Vote #${rec.rollCall}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${rec.externalId} — ${msg}`)
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
