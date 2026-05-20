// Pipeline 27 — New Zealand Public Acts (nz_legislation_v1)
// Dataset: New Zealand Parliamentary Counsel Office (PCO) Legislation API v0
// API: https://api.legislation.govt.nz/v0/works/
// Key: NZ_LEGISLATION_API_KEY env var — request via https://www.legislation.govt.nz
// Scope: Acts of Parliament currently in force (type=act, act_type=public, act_status=in_force)
// Topic: nz-parliament (NZ Parliament, domain=government)
// Run: npx tsx scripts/ingest-nz-legislation.ts --dry-run
//      npx tsx scripts/ingest-nz-legislation.ts --sample 10
//      npx tsx scripts/ingest-nz-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'nz_legislation_v1'
const PIPELINE = 'Pipeline 27'
const API_BASE = 'https://api.legislation.govt.nz'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface NzVersion {
  title: string
  version_id: string
  is_latest_version: boolean
  formats: Array<{ format: string; url: string }>
}

interface NzWork {
  work_id: string
  legislation_type: string
  legislation_status: string
  act_type: string
  act_status: string
  act_classification: string
  latest_matching_version: NzVersion
}

interface NzWorksResponse {
  results: NzWork[]
  page: number
  per_page: number
  total: number
}

interface CandidateRecord {
  workId: string
  year: string
  actNumber: string
  actType: string
  actClassification: string
  claimText: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function getApiKey(): string {
  const key = process.env.NZ_LEGISLATION_API_KEY
  if (!key) {
    console.error('\nERROR: NZ_LEGISLATION_API_KEY is not set.')
    console.error('The PCO Legislation API (api.legislation.govt.nz) requires an API key.')
    console.error('To obtain a free key:')
    console.error('  1. Visit https://www.legislation.govt.nz/About/About')
    console.error('  2. Register for API access through the Developer section')
    console.error('  3. Add NZ_LEGISLATION_API_KEY=your_key to .env.local')
    process.exit(1)
  }
  return key
}

async function fetchPage(apiKey: string, page: number, retries = 4): Promise<NzWorksResponse> {
  const url = new URL(`${API_BASE}/v0/works/`)
  url.searchParams.set('legislation_type', 'act')
  url.searchParams.set('act_type', 'public')
  url.searchParams.set('act_status', 'in_force')
  url.searchParams.set('act_classification', 'principal')
  url.searchParams.set('per_page', String(PAGE_SIZE))
  url.searchParams.set('page', String(page))
  url.searchParams.set('sort_by', 'year_asc')

  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        headers: {
          'X-Api-Key': apiKey,
          'Accept': 'application/json',
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        const retryAfter = res.headers.get('Retry-After')
        const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : delay
        console.warn(`  HTTP ${res.status} at page ${page} — retrying in ${retryMs}ms`)
        await sleep(retryMs)
        delay *= 2
        continue
      }
      if (!res.ok) {
        const body = await res.text()
        throw new Error(`PCO API ${res.status} at page ${page}: ${body.slice(0, 100)}`)
      }
      return await res.json() as NzWorksResponse
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error at page ${page}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at page ${page}`)
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(work: NzWork, verbose: boolean): CandidateRecord | null {
  const { work_id, latest_matching_version } = work
  if (!work_id || !latest_matching_version) {
    if (verbose) console.log(`  Skip: missing work_id or version (${work_id})`)
    return null
  }

  const title = latest_matching_version.title?.trim()
  if (!title) {
    if (verbose) console.log(`  Skip ${work_id}: no title`)
    return null
  }

  // work_id format: act_{subtype}_{year}_{number}
  const parts = work_id.split('_')
  if (parts.length < 4) {
    if (verbose) console.log(`  Skip ${work_id}: unexpected work_id format`)
    return null
  }

  // parts[0]=act, parts[1]=subtype, parts[2]=year, parts[3]=number (may have suffix)
  const year = parts[2]
  const actNumber = parts.slice(3).join('_')
  if (!year || !actNumber) {
    if (verbose) console.log(`  Skip ${work_id}: cannot extract year/number`)
    return null
  }

  // Construct the legislation.govt.nz URL
  const subtype = parts[1]
  const sourceUrl = `https://www.legislation.govt.nz/act/${subtype}/${year}/${actNumber}/en/latest/`

  const externalId = `nz_legislation_${year}_${actNumber}`
  const sourceExternalId = `nz_legislation_source_${year}_${actNumber}`

  return {
    workId: work_id,
    year,
    actNumber,
    actType: work.act_type ?? subtype,
    actClassification: work.act_classification ?? '',
    claimText: title,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `NZ Public Act ${year} No ${actNumber}`,
  }
}

// ── Fetch all acts ─────────────────────────────────────────────────────────────

async function fetchAllActs(
  apiKey: string,
  hardLimit: number,
  verbose: boolean,
): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedMalformed = 0
  let page = 1
  let totalFromApi = 0

  while (true) {
    const data = await fetchPage(apiKey, page)
    if (page === 1) {
      totalFromApi = data.total
      console.log(`  API reports ${totalFromApi} total acts in force`)
    }

    const results = data.results ?? []
    if (results.length === 0) break

    let newOnPage = 0
    for (const work of results) {
      const rec = buildCandidate(work, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (newOnPage === 0 && results.length < PAGE_SIZE) break
    if (candidates.length >= totalFromApi) break

    if (verbose) console.log(`  ...page ${page}: cumulative ${candidates.length}`)
    page++
    await sleep(PAGE_DELAY_MS)
  }

  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed/incomplete records`)
  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

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

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: rec.sourceName,
        url: rec.sourceUrl,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const enactedDate = new Date(`${rec.year}-01-01T00:00:00Z`)

    const claim = await tx.claim.create({
      data: {
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: enactedDate,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          workId: rec.workId,
          year: rec.year,
          actNumber: rec.actNumber,
          actType: rec.actType,
          actClassification: rec.actClassification,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: New Zealand Public Acts ─────────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  const apiKey = getApiKey()

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('nz-parliament', 'NZ Parliament', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching NZ Public Acts in force from PCO API...')
  const candidates = await fetchAllActs(apiKey, limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      workId: r.workId,
      year: r.year,
      actNumber: r.actNumber,
      actType: r.actType,
      actClassification: r.actClassification,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      apiEndpoint: `${API_BASE}/v0/works/?legislation_type=act&act_type=public&act_status=in_force&act_classification=principal`,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-27-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-27-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year} No ${r.actNumber}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : (limit > 0 ? candidates.slice(0, limit) : candidates)

  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
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

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
