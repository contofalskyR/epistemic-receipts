// Pipeline: FRED Economic Indicators (fred_v1)
// Source: Federal Reserve Bank of St. Louis FRED API
// API docs: https://fred.stlouisfed.org/docs/api/fred/
// Registration: https://fred.stlouisfed.org/docs/api/api_key.html
// Rate limit: 120 req/min; we space at 600ms between requests.
//
// Series ingested: UNRATE, GDP, CPIAUCSL, FEDFUNDS, M2SL, CSUSHPINSA
// Each observation becomes one MEASUREMENT claim (Source → Claim → Edge → EdgeRevision).
//
// Run:
//   FRED_API_KEY=<key> npx tsx scripts/ingest-fred.ts --dry-run [--limit N]
//   ALLOW_EDITS=true FRED_API_KEY=<key> npx tsx scripts/ingest-fred.ts [--limit N]
//   ALLOW_EDITS=true FRED_API_KEY=<key> npx tsx scripts/ingest-fred.ts          (full)

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const FRED_BASE = 'https://api.stlouisfed.org/fred'
const INGESTED_BY = 'fred_v1'

// ── Series definitions ────────────────────────────────────────────────────────

interface SeriesDef {
  id: string
  title: string
  units: string
  frequency: 'monthly' | 'quarterly'
}

const FRED_SERIES: SeriesDef[] = [
  {
    id: 'UNRATE',
    title: 'Unemployment Rate',
    units: 'percent',
    frequency: 'monthly',
  },
  {
    id: 'GDP',
    title: 'Gross Domestic Product',
    units: 'billions of dollars (seasonally adjusted annual rate)',
    frequency: 'quarterly',
  },
  {
    id: 'CPIAUCSL',
    title: 'Consumer Price Index for All Urban Consumers: All Items',
    units: 'index (1982-1984=100, seasonally adjusted)',
    frequency: 'monthly',
  },
  {
    id: 'FEDFUNDS',
    title: 'Federal Funds Effective Rate',
    units: 'percent per annum',
    frequency: 'monthly',
  },
  {
    id: 'M2SL',
    title: 'M2 Money Stock',
    units: 'billions of dollars (seasonally adjusted)',
    frequency: 'monthly',
  },
  {
    id: 'CSUSHPINSA',
    title: 'S&P/Case-Shiller U.S. National Home Price Index',
    units: 'index (January 2000=100, not seasonally adjusted)',
    frequency: 'monthly',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface FredObservation {
  date: string   // YYYY-MM-DD
  value: string  // numeric string, or "." for missing
}

interface FredObsResponse {
  observations: FredObservation[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { dryRun: boolean; limit: number } {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const limitRaw = li !== -1 ? parseInt(args[li + 1] ?? '0', 10) : 0
  return {
    dryRun: args.includes('--dry-run'),
    limit: Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 0,
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 600

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function fetchJson<T>(url: string, retries = 3): Promise<T> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (res.ok) return res.json() as Promise<T>
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    throw new Error(`FRED API ${res.status} ${res.statusText} — ${url}`)
  }
  throw new Error(`Exhausted retries: ${url}`)
}

// ── Fetch all observations for a series ───────────────────────────────────────

async function fetchObservations(
  seriesId: string,
  apiKey: string,
): Promise<FredObservation[]> {
  const url =
    `${FRED_BASE}/series/observations?series_id=${seriesId}` +
    `&api_key=${encodeURIComponent(apiKey)}&file_type=json` +
    `&observation_start=1900-01-01&limit=100000&sort_order=asc`
  const data = await fetchJson<FredObsResponse>(url)
  return (data.observations ?? []).filter(o => o.value !== '.' && o.value.trim() !== '')
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function parseObsDate(dateStr: string): Date | null {
  const d = new Date(`${dateStr}T00:00:00Z`)
  return isNaN(d.getTime()) ? null : d
}

function formatDateLabel(dateStr: string, freq: 'monthly' | 'quarterly'): string {
  const [yearStr, monthStr] = dateStr.split('-')
  const year = yearStr ?? ''
  const month = parseInt(monthStr ?? '1', 10)
  if (freq === 'quarterly') {
    const q = Math.ceil(month / 3)
    return `Q${q} ${year}`
  }
  const months = ['January','February','March','April','May','June',
                  'July','August','September','October','November','December']
  return `${months[month - 1] ?? monthStr} ${year}`
}

function freqToPrecision(freq: 'monthly' | 'quarterly'): 'MONTH' | 'QUARTER' {
  return freq === 'quarterly' ? 'QUARTER' : 'MONTH'
}

// ── Claim text ────────────────────────────────────────────────────────────────

function buildClaimText(series: SeriesDef, obs: FredObservation): string {
  const label = formatDateLabel(obs.date, series.frequency)
  return `${series.title} (FRED series ${series.id}) was ${obs.value} ${series.units} in ${label}.`
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Ingest one observation ─────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeObservation(
  tx: TxClient,
  series: SeriesDef,
  obs: FredObservation,
  topicId: string,
): Promise<IngestResult> {
  const externalId = `fred_${series.id}_${obs.date}`

  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const date = parseObsDate(obs.date)
  if (!date) return 'skipped'

  const claimText = buildClaimText(series, obs)
  const sourceUrl = `https://fred.stlouisfed.org/series/${series.id}`

  const source = await tx.source.create({
    data: {
      name: `FRED — ${series.title} (${series.id}), ${formatDateLabel(obs.date, series.frequency)}`,
      url: sourceUrl,
      publishedAt: date,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `fred_source_${series.id}_${obs.date}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: claimText,
      claimType: 'MEASUREMENT',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: date,
      claimEmergedPrecision: freqToPrecision(series.frequency),
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
      metadata: {
        dataset: 'fred_v1',
        seriesId: series.id,
        seriesTitle: series.title,
        date: obs.date,
        value: obs.value,
        units: series.units,
        frequency: series.frequency,
        sourceUrl,
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
      reason: 'FRED Federal Reserve economic measurement — HARD_FACT data point',
      changedAt: date,
    },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()

  const apiKey = process.env.FRED_API_KEY
  if (!apiKey) {
    if (dryRun) {
      // Offline preview — show what would be ingested without API calls.
      console.log(`\n── Pipeline: FRED Economic Indicators (fred_v1) ────────────────────`)
      console.log(`Mode: dry-run (offline — no FRED_API_KEY) | Limit: ${limit || 'all'}`)
      console.log(`Series to ingest: ${FRED_SERIES.map(s => s.id).join(', ')}\n`)
      for (const s of FRED_SERIES) {
        const sampleObs = [
          { date: '2024-01-01', value: '<live_value>' },
          { date: '2024-02-01', value: '<live_value>' },
        ]
        console.log(`── ${s.id}: ${s.title}`)
        console.log(`   URL: https://fred.stlouisfed.org/series/${s.id}`)
        console.log(`   Units: ${s.units}`)
        for (const obs of sampleObs.slice(0, limit || 2)) {
          console.log(`   [dry-run] ${buildClaimText(s, obs)}`)
        }
      }
      console.log(
        '\nNOTE: Set FRED_API_KEY to fetch real observations.\n' +
        'Register at: https://fred.stlouisfed.org/docs/api/api_key.html',
      )
      await prisma.$disconnect()
      return
    }
    console.error(
      'ERROR: FRED_API_KEY environment variable is not set.\n' +
      'Register for a free API key at: https://fred.stlouisfed.org/docs/api/api_key.html',
    )
    process.exit(1)
  }

  const allowEdits = process.env.ALLOW_EDITS === 'true'
  if (!dryRun && !allowEdits) {
    console.error('ERROR: Set ALLOW_EDITS=true to run in non-dry-run mode.')
    process.exit(1)
  }

  console.log(`\n── Pipeline: FRED Economic Indicators (fred_v1) ────────────────────`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'} | Limit: ${limit || 'all'} | Series: ${FRED_SERIES.map(s => s.id).join(', ')}`)

  // Ensure topics (skip in dry-run)
  let fredTopicId = ''
  if (!dryRun) {
    console.log('\nEnsuring topics...')
    fredTopicId = await ensureTopic('fred-economic-indicators', 'FRED Economic Indicators', 'economics')
  }

  // Fetch + ingest each series
  const totals: Counts = { ingested: 0, skipped: 0, errors: 0 }
  let totalObsCount = 0

  for (const series of FRED_SERIES) {
    console.log(`\n── ${series.id}: ${series.title} ──`)
    console.log(`  Fetching observations from FRED API...`)

    let observations: FredObservation[]
    try {
      observations = await fetchObservations(series.id, apiKey)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed to fetch ${series.id}: ${msg}`)
      totals.errors++
      continue
    }

    console.log(`  Fetched ${observations.length} valid observations`)

    if (dryRun) {
      const sample = limit > 0 ? observations.slice(0, limit) : observations.slice(0, 5)
      for (const obs of sample) {
        console.log(`  [dry-run] ${buildClaimText(series, obs)}`)
      }
      if (!limit) console.log(`  ... (${observations.length - 5} more)`)
      totalObsCount += observations.length
      continue
    }

    // Determine pool to ingest (limit applies across all series combined)
    const remaining = limit > 0 ? Math.max(0, limit - totals.ingested - totals.skipped) : Infinity
    const pool = limit > 0 ? observations.slice(0, remaining) : observations

    const seriesCounts: Counts = { ingested: 0, skipped: 0, errors: 0 }

    for (const obs of pool) {
      try {
        const result = await prisma.$transaction(
          async tx => writeObservation(tx, series, obs, fredTopicId),
          { timeout: 30000 },
        )
        if (result === 'ingested') seriesCounts.ingested++
        else if (result === 'skipped') seriesCounts.skipped++
        else seriesCounts.errors++

        if ((seriesCounts.ingested + seriesCounts.skipped) % 100 === 0) {
          console.log(
            `  Progress: ${seriesCounts.ingested} ingested, ${seriesCounts.skipped} skipped, ${seriesCounts.errors} errors`,
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: ${series.id} ${obs.date} — ${msg}`)
        seriesCounts.errors++
      }
    }

    console.log(
      `  Done: ${seriesCounts.ingested} ingested, ${seriesCounts.skipped} skipped, ${seriesCounts.errors} errors`,
    )
    totals.ingested += seriesCounts.ingested
    totals.skipped += seriesCounts.skipped
    totals.errors += seriesCounts.errors
    totalObsCount += observations.length

    if (limit > 0 && totals.ingested + totals.skipped >= limit) {
      console.log(`\nReached limit of ${limit}. Stopping.`)
      break
    }
  }

  if (dryRun) {
    console.log(`\n=== Dry-run complete ===`)
    console.log(`  Total observations available: ${totalObsCount}`)
    console.log(`  Would ingest (up to limit): ${limit || totalObsCount}`)
    console.log('\nSTOP — awaiting ALLOW_EDITS=true to run.')
    await prisma.$disconnect()
    return
  }

  // Summary
  console.log(`\n=== Ingestion summary ===`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}`)

  // Verify against DB state — per AGENTS.md, don't trust in-script counters.
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`\nDB verification:`)
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  if (dbClaims !== totals.ingested) {
    console.warn(`  WARNING: DB count (${dbClaims}) differs from ingested counter (${totals.ingested})`)
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
