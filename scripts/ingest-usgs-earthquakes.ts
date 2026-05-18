// Pipeline 12 — USGS Significant Earthquakes
// Dataset: USGS Earthquake Hazards Program FDSN API (earthquake.usgs.gov) — no auth required.
// Default scope: M6.5+ from 1900-01-01 to present (~4,700 events).
// Run: npx tsx scripts/ingest-usgs-earthquakes.ts --dry-run
//      npx tsx scripts/ingest-usgs-earthquakes.ts --sample 10
//      npx tsx scripts/ingest-usgs-earthquakes.ts --full [--minmag 7.0] [--since 1950-01-01] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'usgs_eq_v1'
const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1'
const PAGE_SIZE = 1000

// ── Types ─────────────────────────────────────────────────────────────────────

interface EqProperties {
  mag: number
  place: string
  time: number        // Unix ms
  updated: number
  url: string
  magType: string
  type: string
  title: string
  tsunami: number
  sig: number
  status: string
}

interface EqFeature {
  id: string
  type: 'Feature'
  properties: EqProperties
  geometry: { type: string; coordinates: [number, number, number] }
}

interface EqCollection {
  type: 'FeatureCollection'
  metadata: { count: number; limit: number; offset: number }
  features: EqFeature[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  id: string
  externalId: string
  mag: number
  magType: string
  place: string
  date: Date
  lon: number
  lat: number
  depthKm: number
  tsunami: boolean
  sig: number
  sourceUrl: string
  claimText: string
  magTier: 'major' | 'great' | 'exceptional'
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => { console.error('Usage: --dry-run | --sample N | --full  [--minmag N] [--since YYYY-MM-DD] [--limit N] [--verbose]'); process.exit(1) as never })()

  const mi = args.indexOf('--minmag')
  const si = args.indexOf('--since')
  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    minMag: mi !== -1 ? (parseFloat(args[mi + 1] ?? '6.5') || 6.5) : 6.5,
    since: si !== -1 ? (args[si + 1] ?? '1900-01-01') : '1900-01-01',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 500

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function usgsFetch(url: string, retries = 3): Promise<EqCollection> {
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
    if (!res.ok) throw new Error(`USGS API ${res.status} at ${url}`)
    return res.json() as Promise<EqCollection>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch all events (paginated) ──────────────────────────────────────────────

async function fetchAllEvents(minMag: number, since: string): Promise<EqFeature[]> {
  const all: EqFeature[] = []
  let offset = 1

  for (;;) {
    const url = `${USGS_BASE}/query?format=geojson&minmagnitude=${minMag}&starttime=${since}&endtime=now&orderby=time-asc&limit=${PAGE_SIZE}&offset=${offset}`
    const data = await usgsFetch(url)
    const page = data.features ?? []
    all.push(...page)
    console.log(`  Fetched ${all.length} events...`)
    if (page.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }

  return all
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function magTier(mag: number): 'major' | 'great' | 'exceptional' {
  if (mag >= 8.5) return 'exceptional'
  if (mag >= 7.0) return 'great'
  return 'major'
}

function formatDate(ms: number): string {
  return new Date(ms).toISOString().split('T')[0]!
}

function buildClaimText(mag: number, magType: string, place: string, date: Date, tsunami: boolean): string {
  const dateStr = date.toISOString().split('T')[0]
  const tsunamiNote = tsunami ? ', triggering a tsunami' : ''
  return `A magnitude ${mag.toFixed(1)} ${magType.toUpperCase()} earthquake struck ${place} on ${dateStr}${tsunamiNote}.`
}

function buildCandidate(f: EqFeature): CandidateRecord | null {
  const p = f.properties
  if (p.type !== 'earthquake' || !p.place || !p.url || !p.mag || !p.time) return null

  const date = new Date(p.time)
  const [lon, lat, depth] = f.geometry.coordinates

  return {
    id: f.id,
    externalId: `usgs_eq_${f.id}`,
    mag: p.mag,
    magType: p.magType ?? 'mw',
    place: p.place,
    date,
    lon: lon ?? 0,
    lat: lat ?? 0,
    depthKm: depth ?? 0,
    tsunami: p.tsunami === 1,
    sig: p.sig ?? 0,
    sourceUrl: p.url,
    claimText: buildClaimText(p.mag, p.magType ?? 'mw', p.place, date, p.tsunami === 1),
    magTier: magTier(p.mag),
  }
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
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

async function ensureTopics(): Promise<{ root: string; major: string; great: string; exceptional: string }> {
  const root = await ensureTopic('usgs-earthquakes', 'USGS Significant Earthquakes', 'science')
  const major = await ensureTopic('usgs-eq-major', 'Major Earthquakes (M6.5–6.9)', 'science', 'usgs-earthquakes')
  const great = await ensureTopic('usgs-eq-great', 'Great Earthquakes (M7.0–8.4)', 'science', 'usgs-earthquakes')
  const exceptional = await ensureTopic('usgs-eq-exceptional', 'Exceptional Earthquakes (M8.5+)', 'science', 'usgs-earthquakes')
  return { root, major, great, exceptional }
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `USGS: M${rec.mag.toFixed(1)} ${rec.place} (${formatDate(rec.date.getTime())})`,
      url: rec.sourceUrl,
      publishedAt: rec.date,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `usgs_eq_source_${rec.id}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.date,
      claimEmergedPrecision: 'DAY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        eventId: rec.id,
        magnitude: rec.mag,
        magType: rec.magType,
        place: rec.place,
        lon: rec.lon,
        lat: rec.lat,
        depthKm: rec.depthKm,
        tsunami: rec.tsunami,
        sig: rec.sig,
        magTier: rec.magTier,
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
      reason: 'USGS seismological record — earthquake event as HARD_FACT',
      changedAt: rec.date,
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
  const { mode, minMag, since, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── Pipeline 12: USGS Significant Earthquakes ─────────────────────────`)
  console.log(`Mode: ${mode} | Min magnitude: M${minMag} | Since: ${since} | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let topics = { root: '', major: '', great: '', exceptional: '' }
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring earthquake topics...')
    topics = await ensureTopics()
    console.log(`  Root topic (usgs-earthquakes): ${topics.root}`)
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Step 2: Fetch events from USGS API
  console.log('\nStep 2: Fetching events from USGS FDSN API...')
  const features = await fetchAllEvents(minMag, since)
  console.log(`  Retrieved ${features.length} raw events`)

  // Step 3: Build candidates
  const candidates: CandidateRecord[] = []
  const tierBreakdown: Record<string, number> = { major: 0, great: 0, exceptional: 0 }
  let skippedMalformed = 0

  for (const f of features) {
    const rec = buildCandidate(f)
    if (!rec) { skippedMalformed++; continue }
    candidates.push(rec)
    tierBreakdown[rec.magTier]++
  }

  console.log(`\nCandidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
  console.log('Magnitude tier breakdown:')
  console.log(`  Exceptional (M8.5+): ${tierBreakdown.exceptional}`)
  console.log(`  Great (M7.0–8.4):    ${tierBreakdown.great}`)
  console.log(`  Major (M6.5–6.9):    ${tierBreakdown.major}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      magnitude: r.mag,
      magType: r.magType,
      place: r.place,
      date: r.date.toISOString(),
      magTier: r.magTier,
      tsunami: r.tsunami,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary' },
    }))

    const output = {
      runDate: new Date().toISOString(),
      minMagnitude: minMag,
      since,
      totalCandidates: candidates.length,
      tierBreakdown,
      sample,
    }

    fs.writeFileSync('pipeline-12-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-12-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample run.')
    return
  }

  // ── Sample run ─────────────────────────────────────────────────────────────
  if (mode === 'sample') {
    const rows = candidates.slice(0, sampleN)
    console.log(`\nSample run: ${rows.length} rows in rolled-back transaction...`)
    let ingested = 0, skipped = 0, errors = 0

    try {
      await prisma.$transaction(async (tx) => {
        for (const row of rows) {
          const tierTopicId = topics[row.magTier]
          const result = await writeRow(tx, row, [topics.root, tierTopicId])
          if (result === 'ingested') ingested++
          else if (result === 'skipped') skipped++
          else errors++
          if (verbose) console.log(`  [${result}] M${row.mag} — ${row.place} (${row.date.toISOString().split('T')[0]})`)
        }
        throw new Error('INTENTIONAL_ROLLBACK_SAMPLE_RUN')
      }, { timeout: 30000 })
    } catch (e) {
      if (e instanceof Error && e.message === 'INTENTIONAL_ROLLBACK_SAMPLE_RUN') {
        console.log(`\nRolled back. Would have ingested: ${ingested}, skipped: ${skipped}, errors: ${errors}`)
      } else {
        throw e
      }
    }

    const afterCount = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
    console.log(`  Post-rollback DB count for ${INGESTED_BY}: ${afterCount} (expected 0)`)
    console.log('\nAwaiting explicit go-ahead before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  const rows = limit > 0 ? candidates.slice(0, limit) : candidates
  console.log(`\nFull ingestion: ${rows.length} rows (per-row transactions)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const row of rows) {
    try {
      const tierTopicId = topics[row.magTier]
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, row, [topics.root, tierTopicId]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 200 === 0) {
        console.log(`  Progress: ${counts.ingested}/${rows.length} — M${row.mag} ${row.place}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${row.externalId} — ${msg}`)
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
