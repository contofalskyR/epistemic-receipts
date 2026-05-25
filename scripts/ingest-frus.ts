// Pipeline 125 — Foreign Relations of the United States (FRUS)
// Dataset: history.state.gov OPDS REST API (Atom/XML feed) — no auth required
// Scope: All FRUS volumes (~550) from 1861 to present
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-frus.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-frus.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'frus_v1'
const OPDS_ALL_URL = 'https://history.state.gov/api/v1/catalog/all'
const FRUS_DOC_BASE = 'https://history.state.gov/historicaldocuments/'
const THROTTLE_MS = 300
const DRY_RUN_SAMPLE_COUNT = 20

// ── Types ─────────────────────────────────────────────────────────────────────

interface FrusVolume {
  volId: string
  title: string
  updatedRaw: string
  epubUrl: string | null
  sourceUrl: string
  externalId: string
  claimText: string
  date: Date | null
  datePrecision: string | null
  startYear: number | null
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

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

async function frusFetch(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'application/atom+xml,application/xml,*/*',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`FRUS API ${res.status} at ${url}`)
    return res.text()
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── XML parsing (regex — Atom feed is simple and well-structured) ─────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
}

function parseVolYear(volId: string): { year: number | null; date: Date | null; precision: string | null } {
  // frus1861 → 1861, frus1969-76v01 → 1969, frus1945MaltaYalta → 1945
  const m = volId.match(/frus(\d{4})/)
  if (!m) return { year: null, date: null, precision: null }
  const year = parseInt(m[1], 10)
  const date = new Date(`${year}-01-01T00:00:00Z`)
  return { year, date, precision: 'YEAR' }
}

function extractVolumes(xml: string): FrusVolume[] {
  const volumes: FrusVolume[] = []
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  let match: RegExpExecArray | null

  while ((match = entryRegex.exec(xml)) !== null) {
    const block = match[1]

    // <id xml:id="frus1861"/>
    const idMatch = block.match(/<id\b[^>]*xml:id="([^"]+)"/)
    if (!idMatch) continue
    const volId = idMatch[1].trim()
    if (!volId.startsWith('frus')) continue

    // <title>...</title>
    const titleMatch = block.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    if (!titleMatch) continue
    const title = decodeEntities(titleMatch[1].trim())
    if (!title) continue

    // <updated>...</updated>
    const updatedMatch = block.match(/<updated>([\s\S]*?)<\/updated>/)
    const updatedRaw = updatedMatch ? updatedMatch[1].trim() : ''

    // EPUB acquisition link
    const epubMatch = block.match(/type="application\/epub\+zip"[^>]*href="([^"]+)"/)
    const epubUrl = epubMatch ? epubMatch[1] : null

    const sourceUrl = `${FRUS_DOC_BASE}${volId}`
    const externalId = `frus_${volId}`
    const { year, date, precision } = parseVolYear(volId)

    // Titles can be very long for 19th-century volumes — truncate for claim text
    const claimText = title.length > 255 ? title.slice(0, 252) + '...' : title

    volumes.push({
      volId,
      title,
      updatedRaw,
      epubUrl,
      sourceUrl,
      externalId,
      claimText,
      date,
      datePrecision: precision,
      startYear: year,
    })
  }

  return volumes
}

// ── Fetch all volumes from OPDS catalog ───────────────────────────────────────

async function fetchAllVolumes(maxRecords = 0): Promise<{
  volumes: FrusVolume[]
  totalParsed: number
}> {
  console.log(`  Fetching OPDS catalog: ${OPDS_ALL_URL}`)
  const xml = await frusFetch(OPDS_ALL_URL)

  const all = extractVolumes(xml)
  const volumes = maxRecords > 0 ? all.slice(0, maxRecords) : all

  return { volumes, totalParsed: all.length }
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
  vol: FrusVolume,
  topicIds: string[],
): Promise<IngestResult> {
  const existingClaim = await tx.claim.findUnique({
    where: { externalId: vol.externalId },
    select: { id: true },
  })
  if (existingClaim) return 'skipped'

  const existingSource = await tx.source.findFirst({
    where: { url: vol.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: vol.claimText.slice(0, 255),
      url: vol.sourceUrl,
      publishedAt: vol.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `frus_source_${vol.volId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: vol.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: vol.date ?? null,
      claimEmergedPrecision: vol.datePrecision ?? null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: vol.externalId,
      metadata: {
        dataset: INGESTED_BY,
        volId: vol.volId,
        startYear: vol.startYear,
        epubUrl: vol.epubUrl,
        updatedRaw: vol.updatedRaw,
        fullTitle: vol.title,
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
      newScore: 90,
      reason: 'FRUS — U.S. State Department official diplomatic record series, HARD_FACT',
      changedAt: vol.date ?? new Date(),
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

  console.log(`\n── Pipeline 125: Foreign Relations of the United States (FRUS) ──────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing OPDS catalog and sampling volumes (no DB writes)...')

    const { volumes, totalParsed } = await fetchAllVolumes(DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  Total catalog volumes parsed: ${totalParsed}`)
    console.log(`  Sample size: ${volumes.length}`)

    const sample = volumes.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const v of sample) {
      console.log(`  [${v.volId}] year=${v.startYear ?? 'unknown'}`)
      console.log(`    ${v.claimText.slice(0, 120)}`)
      console.log(`    → ${v.sourceUrl}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: 'P125 — frus_v1',
      apiEndpoint: OPDS_ALL_URL,
      totalParsed,
      sampleCount: sample.length,
      sample: sample.map(v => ({
        volId: v.volId,
        claimText: v.claimText,
        externalId: v.externalId,
        sourceUrl: v.sourceUrl,
        epubUrl: v.epubUrl,
        startYear: v.startYear,
        datePrecision: v.datePrecision,
        updatedRaw: v.updatedRaw,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-125-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-125-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'frus',
    'Foreign Relations of the United States',
    'archives',
  )

  console.log('\nStep 2: Fetching FRUS volume catalog...')
  const maxFetch = limit > 0 ? limit : 0
  const { volumes, totalParsed } = await fetchAllVolumes(maxFetch)

  console.log(`\nTotal catalog entries: ${totalParsed} | Proceeding with: ${volumes.length}`)

  console.log(`\nStep 3: Ingesting ${volumes.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const vol of volumes) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, vol, [rootTopicId]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 50 === 0) {
        console.log(`  Progress: ${counts.ingested}/${volumes.length} — ${vol.volId}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${vol.externalId} — ${msg}`)
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
    console.error(`  WARNING: DB count (${dbClaims}) != ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
