// Pipeline 27 — New Zealand Legislation
// Dataset: New Zealand Parliamentary Counsel Office (PCO) Legislation API v0
// API: https://api.legislation.govt.nz/v0/works/
// Key: NZ_LEGISLATION_API_KEY env var — request via https://www.legislation.govt.nz
// Modes (--mode flag):
//   in-force  (default): Public acts in force        → nz_legislation_v1
//   repealed           : Repealed public acts         → nz_repealed_acts_v1
//   bills              : Bills                        → nz_bills_v1
//   local              : Local acts in force          → nz_local_acts_v1
// Run: npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/ingest-nz-legislation.ts --mode in-force --dry-run
//      npx dotenv-cli -e .env.local -- npx ts-node --project tsconfig.scripts.json scripts/ingest-nz-legislation.ts --mode repealed --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

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
  legislation_status?: string
  act_type?: string
  act_status?: string
  act_classification?: string
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

interface ModeConfig {
  ingestedBy: string
  pipeline: string
  topicSlug: string
  topicName: string
  topicDomain: string
  apiParams: Record<string, string>
  dryRunFile: string
  legislationType: string
  externalIdPrefix: string
  buildSourceName: (year: string, num: string) => string
}

// ── Mode configs ───────────────────────────────────────────────────────────────

const MODES: Record<string, ModeConfig> = {
  'in-force': {
    ingestedBy: 'nz_legislation_v1',
    pipeline: 'Pipeline 27 — NZ Public Acts in Force',
    topicSlug: 'nz-parliament',
    topicName: 'NZ Parliament',
    topicDomain: 'government',
    apiParams: {
      legislation_type: 'act',
      act_type: 'public',
      act_status: 'in_force',
      act_classification: 'principal',
    },
    dryRunFile: 'pipeline-27-dry-run-sample.json',
    legislationType: 'act',
    // Preserved for backward compat — existing DB records use this prefix
    externalIdPrefix: 'nz_legislation',
    buildSourceName: (year, num) => `NZ Public Act ${year} No ${num}`,
  },
  repealed: {
    ingestedBy: 'nz_repealed_acts_v1',
    pipeline: 'Pipeline 27 — NZ Repealed Public Acts',
    topicSlug: 'nz-parliament-repealed',
    topicName: 'NZ Parliament — Repealed Acts',
    topicDomain: 'government',
    apiParams: {
      legislation_type: 'act',
      act_type: 'public',
      act_status: 'repealed',
      act_classification: 'principal',
    },
    dryRunFile: 'nz-repealed-dry-run-sample.json',
    legislationType: 'act',
    externalIdPrefix: 'nz_repealed_acts',
    buildSourceName: (year, num) => `NZ Repealed Public Act ${year} No ${num}`,
  },
  bills: {
    ingestedBy: 'nz_bills_v1',
    pipeline: 'Pipeline 27 — NZ Bills',
    topicSlug: 'nz-parliament-bills',
    topicName: 'NZ Parliament — Bills',
    topicDomain: 'government',
    apiParams: {
      legislation_type: 'bill',
    },
    dryRunFile: 'nz-bills-dry-run-sample.json',
    legislationType: 'bill',
    externalIdPrefix: 'nz_bills',
    buildSourceName: (year, num) => `NZ Bill ${year} No ${num}`,
  },
  local: {
    ingestedBy: 'nz_local_acts_v1',
    pipeline: 'Pipeline 27 — NZ Local Acts in Force',
    topicSlug: 'nz-parliament-local',
    topicName: 'NZ Parliament — Local Acts',
    topicDomain: 'government',
    apiParams: {
      legislation_type: 'act',
      act_type: 'local',
      act_status: 'in_force',
    },
    dryRunFile: 'nz-local-dry-run-sample.json',
    legislationType: 'act',
    externalIdPrefix: 'nz_local_acts',
    buildSourceName: (year, num) => `NZ Local Act ${year} No ${num}`,
  },
}

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const runMode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--mode in-force|repealed|bills|local] [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const mi = args.indexOf('--mode')
  const datasetMode = mi !== -1 ? (args[mi + 1] ?? 'in-force') : 'in-force'
  if (!MODES[datasetMode]) {
    console.error(`Unknown --mode "${datasetMode}". Valid: ${Object.keys(MODES).join(', ')}`)
    process.exit(1)
  }

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    runMode: runMode as 'dry-run' | 'sample' | 'full',
    datasetMode,
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

async function fetchPage(
  apiKey: string,
  page: number,
  apiParams: Record<string, string>,
  retries = 4,
): Promise<NzWorksResponse> {
  const url = new URL(`${API_BASE}/v0/works/`)
  for (const [k, v] of Object.entries(apiParams)) url.searchParams.set(k, v)
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

function buildCandidate(work: NzWork, cfg: ModeConfig, verbose: boolean): CandidateRecord | null {
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

  // work_id format: {type}_{subtype}_{year}_{number[_suffix]}
  const parts = work_id.split('_')
  if (parts.length < 4) {
    if (verbose) console.log(`  Skip ${work_id}: unexpected work_id format`)
    return null
  }

  const year = parts[2]
  const actNumber = parts.slice(3).join('_')
  if (!year || !actNumber) {
    if (verbose) console.log(`  Skip ${work_id}: cannot extract year/number`)
    return null
  }

  const subtype = parts[1]
  const urlSuffix = cfg.legislationType === 'bill' ? 'versions/' : 'en/latest/'
  const sourceUrl = `https://www.legislation.govt.nz/${cfg.legislationType}/${subtype}/${year}/${actNumber}/${urlSuffix}`

  const externalId = `${cfg.externalIdPrefix}_${year}_${actNumber}`
  const sourceExternalId = `${cfg.externalIdPrefix}_source_${year}_${actNumber}`

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
    sourceName: cfg.buildSourceName(year, actNumber),
  }
}

// ── Fetch all works ────────────────────────────────────────────────────────────

async function fetchAllWorks(
  apiKey: string,
  cfg: ModeConfig,
  hardLimit: number,
  verbose: boolean,
): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedMalformed = 0
  let page = 1
  let totalFromApi = 0

  while (true) {
    const data = await fetchPage(apiKey, page, cfg.apiParams)
    if (page === 1) {
      totalFromApi = data.total
      console.log(`  API reports ${totalFromApi} total records`)
    }

    const results = data.results ?? []
    if (results.length === 0) break

    let newOnPage = 0
    for (const work of results) {
      const rec = buildCandidate(work, cfg, verbose)
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

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicId: string,
  ingestedBy: string,
): Promise<IngestResult> {
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
        ingestedBy,
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
        ingestedBy,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: ingestedBy,
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
        ingestedBy,
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
  const { runMode, datasetMode, limit, sampleN, verbose } = parseArgs()
  const cfg = MODES[datasetMode]

  console.log(`\n── ${cfg.pipeline} ─────────────────────────────────────────────────────────`)
  console.log(`Run mode: ${runMode} | Dataset: ${datasetMode} | Limit: ${limit || 'all'}`)

  const apiKey = getApiKey()

  let topicId = ''
  if (runMode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic(cfg.topicSlug, cfg.topicName, cfg.topicDomain)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log(`\nStep 2: Fetching from PCO API (${cfg.ingestedBy})...`)
  const candidates = await fetchAllWorks(apiKey, cfg, limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (runMode === 'dry-run') {
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
      ingestedBy: cfg.ingestedBy,
    }))

    const apiParamStr = Object.entries(cfg.apiParams).map(([k, v]) => `${k}=${v}`).join('&')

    const output = {
      runDate: new Date().toISOString(),
      pipeline: cfg.pipeline,
      ingestedBy: cfg.ingestedBy,
      apiEndpoint: `${API_BASE}/v0/works/?${apiParamStr}`,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync(cfg.dryRunFile, JSON.stringify(output, null, 2))
    console.log(`  Written: ${cfg.dryRunFile}`)

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
  const rows = runMode === 'sample'
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
          const result = await writeRow(tx, row, topicId, cfg.ingestedBy)
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
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: cfg.ingestedBy } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: cfg.ingestedBy } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: cfg.ingestedBy } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (runMode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
