// OpenSky Network airspace avoidance event ingestion
// Each claim = a documented airspace closure/avoidance incident (geopolitical event)
// Plus flight-density drop claims sampled during the event window vs baseline
// Pipeline ID: opensky_v1
// Docs: https://openskynetwork.github.io/opensky-api/rest.html
// Run: npx tsx scripts/ingest-opensky-airspace-events.ts [--event <id>] [--dry-run]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import eventsRaw from './data/opensky-events.json'

const prisma = new PrismaClient()

const OPENSKY_BASE = 'https://opensky-network.org/api'
const PIPELINE_ID  = 'opensky_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface EventConfig {
  id:          string
  label:       string
  startDate:   string
  endDate:     string
  bbox:        { minLat: number; maxLat: number; minLon: number; maxLon: number }
  description: string
}

interface OpenSkyStatesResponse {
  time:   number
  states: unknown[][] | null
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { eventId: string | null; dryRun: boolean } {
  const args      = process.argv.slice(2)
  const eventIdx  = args.indexOf('--event')
  const eventId   = eventIdx !== -1 ? (args[eventIdx + 1] ?? null) : null
  const dryRun    = args.includes('--dry-run')
  return { eventId, dryRun }
}

// ── Rate limiting ─────────────────────────────────────────────────────────────
// Anonymous: ~100 req / 10 min = ~1 req/6 sec; use 7s to stay comfortably under

let lastReqAt = 0
const MIN_INTERVAL = 7000

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP with exponential backoff on 429/5xx ─────────────────────────────────

async function fetchWithRetry(url: string, retries = 4): Promise<Response> {
  let delay = 10000  // start at 10s for OpenSky 429s
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url)
    if (res.status === 429 && attempt < retries) {
      console.warn(`  HTTP 429 (rate limited) — backing off ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if ([502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── OpenSky API ───────────────────────────────────────────────────────────────

async function fetchFlightCount(
  bbox: EventConfig['bbox'],
  atUnix: number,
): Promise<number | null> {
  const { minLat, maxLat, minLon, maxLon } = bbox
  const url = `${OPENSKY_BASE}/states/all?lamin=${minLat}&lomin=${minLon}&lamax=${maxLat}&lomax=${maxLon}&time=${atUnix}`

  let res: Response
  try {
    res = await fetchWithRetry(url)
  } catch (err) {
    console.warn(`  Fetch error: ${err instanceof Error ? err.message : String(err)}`)
    return null
  }

  if (res.status === 404 || res.status === 400) {
    // OpenSky returns 404 for time windows too far in the past on the free tier
    console.warn(`  OpenSky HTTP ${res.status} — skipping timestamp ${atUnix}`)
    return null
  }
  if (!res.ok) {
    console.warn(`  OpenSky HTTP ${res.status} for timestamp ${atUnix}`)
    return null
  }

  const data = await res.json() as OpenSkyStatesResponse
  return data.states ? data.states.length : 0
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function toUnixMidnight(dateStr: string): number {
  return Math.floor(new Date(`${dateStr}T12:00:00Z`).getTime() / 1000)
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
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

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Core: ingest event anchor claim ──────────────────────────────────────────

async function ingestEventClaim(
  event: EventConfig,
  topicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const externalId = `opensky_event_${event.id}`
  const startDate  = new Date(`${event.startDate}T00:00:00Z`)

  const centerLat = (event.bbox.minLat + event.bbox.maxLat) / 2
  const centerLon = (event.bbox.minLon + event.bbox.maxLon) / 2

  const claimText = `${event.label}: ${event.description}. Event date: ${event.startDate}${event.endDate !== event.startDate ? ` – ${event.endDate}` : ''}.`

  if (dryRun) {
    console.log(`  [DRY RUN] Would ingest event: ${event.id}`)
    return 'ingested'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) {
    console.log(`  Skipped (exists): ${event.id}`)
    return 'skipped'
  }

  try {
    const claimId = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: `OpenSky Network — ${event.label}`,
          url:  `https://opensky-network.org`,
          publishedAt:     startDate,
          methodologyType: 'primary',
          ingestedBy:      PIPELINE_ID,
          humanReviewed:   false,
          autoApproved:    true,
          externalId:      `opensky_src_${event.id}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text:                  claimText,
          claimType:             'EMPIRICAL',
          currentStatus:         'HARD_FACT',
          epistemicAxis:         'RECORDED',
          claimEmergedAt:        startDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy:            PIPELINE_ID,
          humanReviewed:         false,
          autoApproved:          true,
          externalId,
          metadata: {
            eventId:     event.id,
            bbox:        event.bbox,
            centerLat,
            centerLon,
            startDate:   event.startDate,
            endDate:     event.endDate,
          },
        },
      })

      await tx.edge.create({
        data: {
          sourceId:     source.id,
          claimId:      claim.id,
          type:         'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy:   PIPELINE_ID,
          humanReviewed: false,
          autoApproved:  true,
        },
      })

      await tx.claimLocation.create({
        data: {
          claimId:     claim.id,
          lat:         centerLat,
          lon:         centerLon,
          source:      'opensky_event',
          precision:   'CITY',
          externalRef: event.id,
        },
      })

      return claim.id
    }, { timeout: 30000 })

    await tagClaim(claimId, topicIds)
    console.log(`  Ingested event: ${event.id}`)
    return 'ingested'
  } catch (err) {
    console.error(`  Failed event ${event.id}: ${err instanceof Error ? err.message : String(err)}`)
    return 'failed'
  }
}

// ── Core: ingest flight-density drop claim ────────────────────────────────────

async function ingestDensityDropClaim(
  event: EventConfig,
  sampleDate: string,
  sampleCount: number,
  baselineCount: number,
  topicIds: string[],
  dryRun: boolean,
): Promise<IngestResult> {
  const dropPct    = Math.round((1 - sampleCount / baselineCount) * 100)
  const externalId = `opensky_drop_${event.id}_${sampleDate}`
  const claimDate  = new Date(`${sampleDate}T00:00:00Z`)

  const centerLat = (event.bbox.minLat + event.bbox.maxLat) / 2
  const centerLon = (event.bbox.minLon + event.bbox.maxLon) / 2

  const claimText = `Flight density over ${event.label} region dropped ~${dropPct}% on ${sampleDate} vs 7-day pre-event baseline (${sampleCount} vs ${baselineCount} tracked aircraft), consistent with airspace avoidance.`

  if (dryRun) {
    console.log(`  [DRY RUN] Would ingest density drop: ${event.id} @ ${sampleDate} (${dropPct}% drop)`)
    return 'ingested'
  }

  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) {
    console.log(`  Skipped (exists): density drop ${event.id} @ ${sampleDate}`)
    return 'skipped'
  }

  try {
    const claimId = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name:            `OpenSky Network ADS-B snapshot — ${event.label} @ ${sampleDate}`,
          url:             `https://opensky-network.org`,
          publishedAt:     claimDate,
          methodologyType: 'primary',
          ingestedBy:      PIPELINE_ID,
          humanReviewed:   false,
          autoApproved:    true,
          externalId:      `opensky_src_drop_${event.id}_${sampleDate}`,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text:                  claimText,
          claimType:             'EMPIRICAL',
          currentStatus:         'HARD_FACT',
          epistemicAxis:         'RECORDED',
          claimEmergedAt:        claimDate,
          claimEmergedPrecision: 'DAY',
          ingestedBy:            PIPELINE_ID,
          humanReviewed:         false,
          autoApproved:          true,
          externalId,
          metadata: {
            eventId:        event.id,
            sampleDate,
            sampleCount,
            baselineCount,
            dropPercent:    dropPct,
            bbox:           event.bbox,
            centerLat,
            centerLon,
          },
        },
      })

      await tx.edge.create({
        data: {
          sourceId:      source.id,
          claimId:       claim.id,
          type:          'FOR',
          evidenceType:  'EVIDENTIARY',
          ingestedBy:    PIPELINE_ID,
          humanReviewed: false,
          autoApproved:  true,
        },
      })

      await tx.claimLocation.create({
        data: {
          claimId:     claim.id,
          lat:         centerLat,
          lon:         centerLon,
          source:      'opensky_event',
          precision:   'CITY',
          externalRef: event.id,
        },
      })

      return claim.id
    }, { timeout: 30000 })

    await tagClaim(claimId, topicIds)
    console.log(`  Ingested density drop: ${event.id} @ ${sampleDate} (${dropPct}% drop, ${sampleCount} vs ${baselineCount})`)
    return 'ingested'
  } catch (err) {
    console.error(`  Failed density drop ${event.id} @ ${sampleDate}: ${err instanceof Error ? err.message : String(err)}`)
    return 'failed'
  }
}

// ── Process one event ─────────────────────────────────────────────────────────

async function processEvent(
  event: EventConfig,
  topicIds: string[],
  dryRun: boolean,
): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  console.log(`\n--- Event: ${event.label} (${event.id}) ---`)

  // 1. Always ingest the anchor claim
  const anchorResult = await ingestEventClaim(event, topicIds, dryRun)
  if (anchorResult === 'ingested') counts.ingested++
  else if (anchorResult === 'skipped') counts.skipped++
  else counts.errors++

  // 2. Sample flight density: baseline (T-7) and during-event (T+7, T+30)
  const baselineDate = addDays(event.startDate, -7)
  const duringDate   = addDays(event.startDate, 7)
  const sustainDate  = addDays(event.startDate, 30)

  console.log(`  Sampling baseline @ ${baselineDate}...`)
  const baselineTs = toUnixMidnight(baselineDate)
  const baseline   = await fetchFlightCount(event.bbox, baselineTs)

  if (baseline === null || baseline === 0) {
    console.warn(`  No baseline data for ${event.id} — OpenSky historical data may not be available for this window. Skipping density claims.`)
    return counts
  }
  console.log(`  Baseline: ${baseline} aircraft`)

  const sampleDates = [
    { label: 'T+7',  date: duringDate  },
    { label: 'T+30', date: sustainDate },
  ]

  for (const sample of sampleDates) {
    // Skip if sample date is after event end (no point checking for ongoing events)
    if (event.endDate !== event.startDate && sample.date > event.endDate) continue

    console.log(`  Sampling ${sample.label} @ ${sample.date}...`)
    const ts    = toUnixMidnight(sample.date)
    const count = await fetchFlightCount(event.bbox, ts)

    if (count === null) {
      console.warn(`  No data for ${sample.label} — skipping`)
      continue
    }

    console.log(`  ${sample.label}: ${count} aircraft`)

    const dropRatio = baseline > 0 ? (baseline - count) / baseline : 0
    if (dropRatio > 0.5) {
      const result = await ingestDensityDropClaim(event, sample.date, count, baseline, topicIds, dryRun)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
    } else {
      console.log(`  ${sample.label}: drop ${Math.round(dropRatio * 100)}% — below 50% threshold, skipping density claim`)
    }
  }

  return counts
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { eventId, dryRun } = parseArgs()
  const events = eventsRaw as EventConfig[]

  const targets = eventId
    ? events.filter(e => e.id === eventId)
    : events

  if (targets.length === 0) {
    console.error(`No events matched${eventId ? ` id="${eventId}"` : ''}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`\n=== OpenSky Airspace Events Ingestion — ${targets.length} event(s)${dryRun ? ' [DRY RUN]' : ''} ===\n`)

  const topicIds: string[] = []
  topicIds.push(await ensureTopic('geopolitics',        'Geopolitics',                   'geopolitics'))
  topicIds.push(await ensureTopic('aviation',           'Aviation',                      'geopolitics'))
  topicIds.push(await ensureTopic('airspace-conflicts', 'Airspace Conflicts & Closures', 'geopolitics'))

  const totals: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const event of targets) {
    const result = await processEvent(event, topicIds, dryRun)
    totals.ingested += result.ingested
    totals.skipped  += result.skipped
    totals.errors   += result.errors
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
