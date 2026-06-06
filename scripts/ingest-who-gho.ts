// Pipeline 112 — WHO Global Health Observatory
// Dataset: WHO GHO OData API (ghoapi.azureedge.net) — no auth required
// Scope: 5 high-value indicators per country, most recent year: life expectancy, U5MR, PM2.5, alcohol, obesity
// Pipeline tag: who_gho_v1
// Run: npx tsx scripts/ingest-who-gho.ts --dry-run
//      npx tsx scripts/ingest-who-gho.ts --full [--indicator WHOSIS_000001] [--limit N] [--verbose]
//      Full run requires ALLOW_EDITS=true

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()
const INGESTED_BY = 'who_gho_v1'
const GHO_BASE = 'https://ghoapi.azureedge.net/api'

// ── Indicator config ──────────────────────────────────────────────────────────

interface IndicatorDef {
  code: string
  name: string
  unit: string
  dim1Filter: string | null  // 'BTSX' for both-sexes combined; null = no Dim1 filter
  topicSlug: string
  topicName: string
  detailSlug: string  // WHO restructured detail URLs to title-derived slugs (2026 onward)
}

const INDICATORS: IndicatorDef[] = [
  {
    code: 'WHOSIS_000001',
    name: 'Life expectancy at birth',
    unit: 'years',
    dim1Filter: 'SEX_BTSX',
    topicSlug: 'who-gho-life-expectancy',
    topicName: 'WHO GHO — Life Expectancy',
    detailSlug: 'life-expectancy-at-birth-(years)',
  },
  {
    code: 'MDG_0000000001',
    name: 'Under-5 mortality rate',
    unit: 'per 1,000 live births',
    dim1Filter: 'SEX_BTSX',
    topicSlug: 'who-gho-under5-mortality',
    topicName: 'WHO GHO — Under-5 Mortality Rate',
    detailSlug: 'under-five-mortality-rate-(probability-of-dying-by-age-5-per-1000-live-births)',
  },
  {
    code: 'SDGPM25',
    name: 'Annual mean concentration of fine particulate matter (PM2.5)',
    unit: 'μg/m³',
    dim1Filter: 'RESIDENCEAREATYPE_TOTL',
    topicSlug: 'who-gho-pm25',
    topicName: 'WHO GHO — PM2.5 Air Pollution',
    detailSlug: 'concentrations-of-fine-particulate-matter-(pm2-5)',
  },
  {
    code: 'SA_0000001462',
    name: 'Total alcohol per capita consumption (age 15+)',
    unit: 'litres of pure alcohol',
    dim1Filter: 'SEX_BTSX',
    topicSlug: 'who-gho-alcohol',
    topicName: 'WHO GHO — Alcohol Consumption Per Capita',
    detailSlug: 'total-(recorded-unrecorded)-alcohol-per-capita-(15-)-consumption',
  },
  {
    code: 'NCD_BMI_30A',
    name: 'Prevalence of obesity among adults (BMI ≥ 30)',
    unit: '%',
    dim1Filter: 'SEX_BTSX',
    topicSlug: 'who-gho-obesity',
    topicName: 'WHO GHO — Adult Obesity Prevalence',
    detailSlug: 'prevalence-of-obesity-among-adults-bmi--30-(age-standardized-estimate)-(-)',
  },
]

const INDICATOR_BY_CODE = new Map(INDICATORS.map(i => [i.code, i]))

// ── Types ─────────────────────────────────────────────────────────────────────

interface GhoDataValue {
  Id: number
  IndicatorCode: string
  SpatialDimType: string
  SpatialDim: string
  TimeDimType: string
  TimeDim: number
  Dim1Type: string | null
  Dim1: string | null
  NumericValue: number | null
  Low: number | null
  High: number | null
  Value: string | null
}

interface GhoDataResponse {
  value: GhoDataValue[]
  '@odata.nextLink'?: string
}

interface GhoDimensionValue {
  Code: string
  Title: string
}

interface GhoDimensionResponse {
  value: GhoDimensionValue[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  externalId: string
  claimText: string
  indicatorCode: string
  countryIso: string
  countryName: string
  year: number
  value: number
  low: number | null
  high: number | null
  unit: string
  claimDate: Date
  metadata: Record<string, unknown>
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --full [--indicator CODE] [--limit N] [--verbose]'); process.exit(1) as never })()

  const ii = args.indexOf('--indicator')
  const li = args.indexOf('--limit')

  let indicatorsToRun = INDICATORS
  if (ii !== -1) {
    const code = args[ii + 1] ?? ''
    const ind = INDICATOR_BY_CODE.get(code)
    if (!ind) {
      console.error(`Unknown indicator: ${code}. Valid: ${INDICATORS.map(i => i.code).join(', ')}`)
      process.exit(1)
    }
    indicatorsToRun = [ind]
  }

  return {
    mode: mode as 'dry-run' | 'full',
    indicators: indicatorsToRun,
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

async function ghoFetch<T>(url: string, retries = 3): Promise<T> {
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
    if (!res.ok) throw new Error(`WHO GHO API ${res.status} at ${url}`)
    return res.json() as Promise<T>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Country lookup ────────────────────────────────────────────────────────────

async function loadCountryNames(): Promise<Map<string, string>> {
  const url = `${GHO_BASE}/DIMENSION/COUNTRY/DimensionValues`
  const data = await ghoFetch<GhoDimensionResponse>(url)
  const map = new Map<string, string>()
  for (const v of data.value ?? []) {
    if (v.Code && v.Title) map.set(v.Code, v.Title)
  }
  console.log(`  Loaded ${map.size} country names`)
  return map
}

// ── Fetch one indicator (all pages) ──────────────────────────────────────────

async function fetchIndicatorData(ind: IndicatorDef): Promise<GhoDataValue[]> {
  // Fetch without $top — the API returns all records at once (no pagination needed).
  // $top with large values (>1000) returns 400. Without $top, returns full dataset.
  // Client-side filtering is applied in buildCandidates.
  const url = `${GHO_BASE}/${ind.code}`
  const data: GhoDataResponse = await ghoFetch<GhoDataResponse>(url)
  return data.value ?? []
}

// ── Build candidates: most recent year per country ────────────────────────────

function buildCandidates(
  records: GhoDataValue[],
  ind: IndicatorDef,
  countryNames: Map<string, string>,
): CandidateRecord[] {
  // Filter to country-level records, matching the Dim1 filter if specified, then keep most recent year per country
  const best = new Map<string, { record: GhoDataValue; numVal: number }>()
  for (const r of records) {
    if (r.SpatialDimType !== 'COUNTRY') continue
    if (!r.SpatialDim || !r.TimeDim || r.TimeDimType !== 'YEAR') continue
    if (ind.dim1Filter !== null && r.Dim1 !== ind.dim1Filter) continue
    // NumericValue may be null for some indicators — fall back to parsing the Value string
    const numVal = r.NumericValue ?? (r.Value !== null ? parseFloat(r.Value ?? '') : null)
    if (numVal === null || numVal === undefined || isNaN(numVal)) continue
    const existing = best.get(r.SpatialDim)
    if (!existing || r.TimeDim > existing.record.TimeDim) best.set(r.SpatialDim, { record: r, numVal })
  }

  const candidates: CandidateRecord[] = []
  for (const [iso, { record: r, numVal }] of best) {
    const countryName = countryNames.get(iso) ?? iso
    const claimText = `${ind.name} in ${countryName}: ${numVal.toFixed(1)} ${ind.unit} (${r.TimeDim})`
    const claimDate = new Date(`${r.TimeDim}-01-01T00:00:00Z`)

    candidates.push({
      externalId: `who_gho_${ind.code}_${iso}_${r.TimeDim}`,
      claimText,
      indicatorCode: ind.code,
      countryIso: iso,
      countryName,
      year: r.TimeDim,
      value: numVal,
      low: r.Low ?? null,
      high: r.High ?? null,
      unit: ind.unit,
      claimDate,
      metadata: {
        dataset: INGESTED_BY,
        indicatorCode: ind.code,
        indicatorName: ind.name,
        country: iso,
        countryName,
        year: r.TimeDim,
        value: numVal,
        low: r.Low ?? null,
        high: r.High ?? null,
        unit: ind.unit,
      },
    })
  }

  return candidates
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug }, select: { id: true } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug }, select: { id: true } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  sourceId: string,
  topicIds: string[],
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.claimDate,
      claimEmergedPrecision: 'YEAR',
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
      newScore: 90,
      reason: 'WHO GHO OData API — country-level health indicator, most recent year',
      changedAt: rec.claimDate,
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

// ── Pre-create one Source per indicator ───────────────────────────────────────

async function ensureIndicatorSource(ind: IndicatorDef): Promise<string> {
  const externalId = `who_gho_source_${ind.code}`
  const existing = await prisma.source.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return existing.id
  const source = await prisma.source.create({
    data: {
      name: `WHO GHO: ${ind.name}`,
      url: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${ind.detailSlug}`,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
    },
  })
  return source.id
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, indicators, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 112: WHO Global Health Observatory ────────────────────────`)
  console.log(`Mode: ${mode} | Indicators: ${indicators.map(i => i.code).join(', ')} | Limit: ${limit || 'all'} | Tag: ${INGESTED_BY}`)

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true environment variable')
    process.exit(1)
  }

  // Step 1: Country names
  console.log('\nStep 1: Loading country name lookup...')
  const countryNames = await loadCountryNames()

  // Step 2: Topics (full run only)
  const topicMap = new Map<string, { rootId: string; indicatorId: string; sourceId: string }>()
  if (mode === 'full') {
    console.log('\nStep 2: Ensuring topics and sources...')
    const rootId = await ensureTopic('who-gho', 'WHO Global Health Observatory', 'medicine')
    for (const ind of indicators) {
      const indicatorId = await ensureTopic(ind.topicSlug, ind.topicName, 'medicine', 'who-gho')
      const sourceId = await ensureIndicatorSource(ind)
      topicMap.set(ind.code, { rootId, indicatorId, sourceId })
    }
    console.log('  Topics and sources ready.')
  } else {
    console.log('\nStep 2: Skipping topic/source DB writes (dry-run mode).')
  }

  // Step 3: Fetch and build candidates
  console.log('\nStep 3: Fetching indicator data from WHO GHO API...')
  const allCandidates: CandidateRecord[] = []
  const indicatorBreakdown = new Map<string, number>()

  for (const ind of indicators) {
    console.log(`  Fetching ${ind.code} (${ind.name})...`)
    const raw = await fetchIndicatorData(ind)
    console.log(`    Raw records: ${raw.length}`)
    const candidates = buildCandidates(raw, ind, countryNames)
    console.log(`    Candidates (most recent year per country): ${candidates.length}`)
    allCandidates.push(...candidates)
    indicatorBreakdown.set(ind.code, candidates.length)
  }

  const candidates = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${candidates.length}`)
  console.log('Per-indicator breakdown:')
  for (const [code, count] of indicatorBreakdown) {
    console.log(`  ${code}: ${count}`)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')
    const sample = candidates.slice(0, 15).map(r => {
      const slug = INDICATOR_BY_CODE.get(r.indicatorCode)?.detailSlug ?? r.indicatorCode
      return {
        claimText: r.claimText,
        externalId: r.externalId,
        indicatorCode: r.indicatorCode,
        countryIso: r.countryIso,
        countryName: r.countryName,
        year: r.year,
        value: r.value,
        low: r.low,
        high: r.high,
        unit: r.unit,
        claimType: 'EMPIRICAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        ingestedBy: INGESTED_BY,
        source: {
          url: `https://www.who.int/data/gho/data/indicators/indicator-details/GHO/${slug}`,
          methodologyType: 'primary',
        },
        metadata: r.metadata,
      }
    })
    const output = {
      runDate: new Date().toISOString(),
      indicators: indicators.map(i => i.code),
      totalCandidates: candidates.length,
      indicatorBreakdown: Object.fromEntries(indicatorBreakdown),
      note: 'Dry-run: no DB writes. Run --full with ALLOW_EDITS=true to ingest.',
      sample,
    }
    fs.writeFileSync('pipeline-112-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-112-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log(`\nStep 4: Full ingestion of ${candidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    const topicEntry = topicMap.get(rec.indicatorCode)
    if (!topicEntry) {
      console.error(`  No topic entry for indicator ${rec.indicatorCode} — skipping`)
      counts.errors++
      continue
    }
    const { rootId, indicatorId, sourceId } = topicEntry
    const topicIds = [rootId, indicatorId]

    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, sourceId, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 200 === 0) {
        console.log(`  Progress: ${counts.ingested} ingested — ${rec.indicatorCode} ${rec.countryIso} ${rec.year}`)
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
