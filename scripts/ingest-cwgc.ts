// Pipeline 128 — Commonwealth War Graves Commission (CWGC) Casualties
// Dataset: CWGC API v2 — ~1.7 million verified WWI/WWII Commonwealth death records.
// API: https://www.cwgc.org/api/v2/casualties (no key required for public endpoints)
// Optional: set CWGC_SUBSCRIPTION_KEY in .env.local to pass Ocp-Apim-Subscription-Key
//           (registration free at https://www.cwgc.org/our-work/making-our-data-open/)
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cwgc.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cwgc.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'cwgc_v1'
const CWGC_API_BASE = 'https://www.cwgc.org/api/v2'
const CWGC_CASUALTY_BASE = 'https://www.cwgc.org/find-records/find-war-dead/casualty-details'
const PAGE_SIZE = 50
const THROTTLE_MS = 600
const DRY_RUN_SAMPLE_COUNT = 20
const FULL_RUN_CAP = 10_000

// ── Types ─────────────────────────────────────────────────────────────────────

interface CWGCCasualty {
  id: string | number
  name: string
  rank?: string | null
  regiment?: string | null
  unit?: string | null
  service?: string | null
  country?: string | null
  nationality?: string | null
  dateOfDeath?: string | null
  age?: number | null
  cemetery?: string | null
  cemeteryRef?: string | null
  war?: string | null
  additionalInfo?: string | null
  forceDetails?: string | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any
}

interface CWGCResponse {
  totalCount?: number
  total?: number
  count?: number
  casualties?: CWGCCasualty[]
  results?: CWGCCasualty[]
  data?: CWGCCasualty[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  externalId: string
  sourceUrl: string
  claimText: string
  name: string
  rank: string | null
  unit: string | null
  dateOfDeath: Date | null
  datePrecision: string | null
  rawDate: string | null
  war: string | null
  cemetery: string | null
  country: string | null
  additionalInfo: string | null
  cwgcId: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--limit N] [--verbose]')
    process.exit(1)
  }

  const mode = args.includes('--full') ? 'full' : 'dry-run'

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const li = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
  }
  const key = process.env.CWGC_SUBSCRIPTION_KEY
  if (key) headers['Ocp-Apim-Subscription-Key'] = key
  return headers
}

async function cwgcFetch(url: string, retries = 3): Promise<CWGCResponse> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: buildHeaders() })

    const contentType = res.headers.get('content-type') ?? ''
    if (res.status === 403 || (res.status === 200 && contentType.includes('text/html'))) {
      const body = await res.text()
      if (body.includes('azwaf') || body.includes('Azure WAF') || body.includes('captcha')) {
        throw new Error(
          `CWGC API blocked by Azure WAF (HTTP ${res.status}). ` +
          `The API requires either a browser session or a free subscription key. ` +
          `Register at https://www.cwgc.org/our-work/making-our-data-open/ ` +
          `and set CWGC_SUBSCRIPTION_KEY in .env.local`,
        )
      }
      throw new Error(`CWGC API HTTP ${res.status} at ${url}`)
    }

    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }

    if (!res.ok) throw new Error(`CWGC API ${res.status} at ${url}`)
    return res.json() as Promise<CWGCResponse>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(raw: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }

  const full = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (full) {
    const d = new Date(`${full[1]}-${full[2]}-${full[3]}T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
  }

  const month = raw.match(/^(\d{4})-(\d{2})/)
  if (month) {
    const d = new Date(`${month[1]}-${month[2]}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
  }

  const year = raw.match(/^(\d{4})/)
  if (year) {
    const d = new Date(`${year[1]}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

// ── Extract unit from casualty (API returns different field names) ─────────────

function extractUnit(c: CWGCCasualty): string | null {
  return (c.regiment ?? c.unit ?? c.forceDetails ?? c.service ?? null)?.trim() || null
}

// ── Build candidate from API record ──────────────────────────────────────────

function buildCandidate(c: CWGCCasualty): CandidateRecord | null {
  const cwgcId = String(c.id ?? '').trim()
  if (!cwgcId) return null

  const name = (c.name ?? '').trim()
  if (!name) return null

  const rank = (c.rank ?? '').trim() || null
  const unit = extractUnit(c)
  const rawDate = c.dateOfDeath ? String(c.dateOfDeath).split('T')[0] : null
  const { date, precision } = parseDate(rawDate)
  const war = (c.war ?? '').trim() || null
  const cemetery = (c.cemetery ?? '').trim() || null
  const country = (c.country ?? c.nationality ?? '').trim() || null
  const additionalInfo = (c.additionalInfo ?? '').trim().slice(0, 500) || null

  // Claim text: "{NAME}, {Rank}, {Unit} — died {date}"
  const parts: string[] = [name]
  if (rank) parts.push(rank)
  if (unit) parts.push(unit)
  const datePart = rawDate ? `died ${rawDate}` : war ? war : null
  const claimText = datePart ? `${parts.join(', ')} — ${datePart}` : parts.join(', ')

  const externalId = `cwgc_${cwgcId}`
  const sourceUrl = `${CWGC_CASUALTY_BASE}/${cwgcId}/`

  return {
    externalId,
    sourceUrl,
    claimText,
    name,
    rank,
    unit,
    dateOfDeath: date,
    datePrecision: precision,
    rawDate,
    war,
    cemetery,
    country,
    additionalInfo,
    cwgcId,
  }
}

// ── Normalize response (handle different field naming) ────────────────────────

function normalizeCasualties(body: CWGCResponse): CWGCCasualty[] {
  return body.casualties ?? body.results ?? body.data ?? []
}

function normalizeTotalCount(body: CWGCResponse): number {
  return body.totalCount ?? body.total ?? body.count ?? 0
}

// ── Fetch all casualties ──────────────────────────────────────────────────────

async function fetchCasualties(maxRecords: number): Promise<{
  candidates: CandidateRecord[]
  skippedMalformed: number
  totalCount: number
  rawKeys: string[]
}> {
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  let totalCount = 0
  let rawKeys: string[] = []
  let page = 1

  while (true) {
    const url = `${CWGC_API_BASE}/casualties?page=${page}&pageSize=${PAGE_SIZE}`
    console.log(`  Fetching page ${page} — ${url}`)

    const body = await cwgcFetch(url)
    const items = normalizeCasualties(body)

    if (page === 1) {
      totalCount = normalizeTotalCount(body)
      if (items.length > 0) rawKeys = Object.keys(items[0])
      console.log(`  API total count: ${totalCount.toLocaleString()}`)
    }

    if (items.length === 0) break

    for (const item of items) {
      const c = buildCandidate(item)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
      if (maxRecords > 0 && candidates.length >= maxRecords) break
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break
    if (items.length < PAGE_SIZE) break

    page++
  }

  return { candidates, skippedMalformed, totalCount, rawKeys }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existingClaim = await tx.claim.findUnique({
    where: { externalId: rec.externalId },
    select: { id: true },
  })
  if (existingClaim) return 'skipped'

  const existingSource = await tx.source.findFirst({
    where: { url: rec.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: rec.claimText.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.dateOfDeath ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `cwgc_source_${rec.cwgcId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.dateOfDeath ?? null,
      claimEmergedPrecision: rec.datePrecision ?? null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        cwgcId: rec.cwgcId,
        name: rec.name,
        rank: rec.rank,
        unit: rec.unit,
        war: rec.war,
        cemetery: rec.cemetery,
        country: rec.country,
        rawDate: rec.rawDate,
        additionalInfo: rec.additionalInfo,
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
      reason: 'CWGC verified death record — primary source government archive, HARD_FACT',
      changedAt: rec.dateOfDeath ?? new Date(),
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

  console.log(`\n── Pipeline 128: CWGC War Dead ─────────────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Cap: ${FULL_RUN_CAP.toLocaleString()}`)
  if (process.env.CWGC_SUBSCRIPTION_KEY) {
    console.log('  Subscription key: present')
  } else {
    console.log('  Subscription key: none (public endpoint only)')
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing API and sampling records (no DB writes)...')

    const { candidates, skippedMalformed, totalCount, rawKeys } =
      await fetchCasualties(DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  API total count: ${totalCount.toLocaleString()}`)
    console.log(`  Candidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
    console.log(`  Raw field keys: ${rawKeys.join(', ')}`)

    const sample = candidates.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.cwgcId}] ${r.rawDate ?? 'no-date'} | ${r.war ?? 'unknown war'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
      if (r.cemetery) console.log(`    Cemetery: ${r.cemetery}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      apiBase: CWGC_API_BASE,
      totalCount,
      candidatesFetched: candidates.length,
      skippedMalformed,
      rawApiKeys: rawKeys,
      sample: sample.map(r => ({
        cwgcId: r.cwgcId,
        claimText: r.claimText,
        externalId: r.externalId,
        sourceUrl: r.sourceUrl,
        rawDate: r.rawDate,
        datePrecision: r.datePrecision,
        name: r.name,
        rank: r.rank,
        unit: r.unit,
        war: r.war,
        cemetery: r.cemetery,
        country: r.country,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-128-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-128-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic('cwgc-war-dead', 'CWGC War Dead', 'archives')

  const maxFetch = limit > 0 ? limit : FULL_RUN_CAP
  console.log(`\nStep 2: Fetching CWGC casualties (cap: ${maxFetch.toLocaleString()})...`)
  const { candidates, skippedMalformed, totalCount } = await fetchCasualties(maxFetch)

  console.log(`\nTotal from API: ${totalCount.toLocaleString()}`)
  console.log(`Candidates: ${candidates.length} (malformed: ${skippedMalformed})`)

  console.log(`\nStep 3: Ingesting ${candidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, [rootTopicId]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 500 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.claimText.slice(0, 70)}`)
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
    console.warn(`  WARNING: DB count (${dbClaims}) != ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
