// Pipeline S5 — Major Volcanic Eruptions (NOAA NGDC / Smithsonian GVP)
// Primary source: NOAA NGDC Significant Volcanic Eruptions
//   https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanoes
// Fallback: Smithsonian GVP eruption JSON
//   https://volcano.si.edu/api/GVPEruption_json.cfm
// Filter: year >= 1500 AND (vei >= 2 OR deaths > 0)
// Run: npx tsx scripts/ingest-volcanic-eruptions.ts --dry-run [--limit N]
//      ALLOW_EDITS=true npx tsx scripts/ingest-volcanic-eruptions.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'volcanic_eruptions_v1'
const NOAA_BASE = 'https://www.ngdc.noaa.gov/hazel/hazard-service/api/v1/volcanoes'
const GVP_URL = 'https://volcano.si.edu/api/GVPEruption_json.cfm'
const MIN_YEAR = 1500

// ── Types ─────────────────────────────────────────────────────────────────────

interface NOAAVolcanoItem {
  id: number
  year: number | null
  month: number | null
  day: number | null
  name: string
  location: string | null
  country: string | null
  latitude: number | null
  longitude: number | null
  elevation: number | null
  morphology: string | null
  agent: string | null
  deathsTotal: number | null
  deathsAmountOrderTotal: number | null
  damageAmountOrderTotal: number | null
  significant: boolean | null
  eruption: boolean | null
  status: string | null
  timeErupt: string | null
  volcanoLocationNewNum: number | null
  volcanoLocationNum: string | null
}

interface NOAAResponse {
  items: NOAAVolcanoItem[]
  page: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
}

interface GVPEruption {
  Volcano_Number?: string
  Volcano_Name?: string
  Subregion?: string
  Country?: string
  Latitude?: string | number
  Longitude?: string | number
  Primary_Volcano_Type?: string
  Eruption_Number?: string
  VEI?: string | number
  VEI_Modifier?: string
  Evidence_Category?: string
  Start_Year?: string | number
  Start_Month?: string | number
  Start_Day?: string | number
}

interface EruptionRecord {
  externalId: string
  sourceExternalId: string
  name: string
  country: string
  location: string
  eruptionDate: Date
  datePrecision: 'DAY' | 'MONTH' | 'YEAR'
  vei: number | null
  deaths: number | null
  latitude: number | null
  longitude: number | null
  volcanoNumber: string | null
  sourceUrl: string
  claimText: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--full') ? 'full'
    : (() => {
      console.error('Usage: --dry-run [--limit N] | --full [--limit N] [--verbose]')
      process.exit(1) as never
    })()

  const li = args.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchJSON<T>(url: string, retries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'EpistemicReceipts/1.0 (research; contact: robert.contofalsky@rutgers.edu)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay); delay *= 2; continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
      return res.json() as Promise<T>
    } catch (err) {
      if (attempt >= retries) throw err
      console.warn(`  Error (attempt ${attempt + 1}): ${err instanceof Error ? err.message : err}`)
      await sleep(delay); delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Fetch eruptions ───────────────────────────────────────────────────────────

async function fetchNOAAEruptions(): Promise<NOAAVolcanoItem[]> {
  const all: NOAAVolcanoItem[] = []
  let page = 1
  let totalPages = 1

  do {
    const url = `${NOAA_BASE}?page=${page}`
    console.log(`  Fetching NOAA page ${page}/${totalPages}: ${url}`)
    const data = await fetchJSON<NOAAResponse>(url)
    totalPages = data.totalPages ?? 1
    all.push(...(data.items ?? []))
    console.log(`  NOAA: ${all.length}/${data.totalItems ?? '?'} records`)
    page++
    if (page <= totalPages) await sleep(300)
  } while (page <= totalPages)

  return all
}

async function fetchGVPEruptions(): Promise<GVPEruption[]> {
  console.log(`  Fetching GVP eruption data from ${GVP_URL}`)
  const raw = await fetchJSON<Record<string, unknown>>(GVP_URL)
  // GVP returns { Eruption: [...] } or plain array
  const items = Array.isArray(raw) ? raw
    : Array.isArray(raw['Eruption']) ? raw['Eruption'] as GVPEruption[]
    : Array.isArray(raw['eruptions']) ? raw['eruptions'] as GVPEruption[]
    : []
  console.log(`  GVP: ${items.length} total eruption records`)
  return items
}

// ── Build candidates ──────────────────────────────────────────────────────────

function buildDate(
  year: number | string | null | undefined,
  month?: number | string | null,
  day?: number | string | null,
): { date: Date; precision: 'DAY' | 'MONTH' | 'YEAR' } | null {
  const y = typeof year === 'string' ? parseInt(year, 10) : year
  if (!y || isNaN(y) || y < MIN_YEAR || y > 2030) return null

  const m = typeof month === 'string' ? parseInt(month, 10) : (month ?? null)
  const d = typeof day === 'string' ? parseInt(day, 10) : (day ?? null)

  if (m && m >= 1 && m <= 12 && d && d >= 1 && d <= 31) {
    const mm = String(m).padStart(2, '0')
    const dd = String(d).padStart(2, '0')
    return { date: new Date(`${y}-${mm}-${dd}T00:00:00Z`), precision: 'DAY' }
  }
  if (m && m >= 1 && m <= 12) {
    const mm = String(m).padStart(2, '0')
    return { date: new Date(`${y}-${mm}-01T00:00:00Z`), precision: 'MONTH' }
  }
  return { date: new Date(`${y}-01-01T00:00:00Z`), precision: 'YEAR' }
}

function buildNOAACandidate(item: NOAAVolcanoItem): EruptionRecord | null {
  if (!item.year || item.year < MIN_YEAR) return null
  if (!item.eruption) return null
  if (!item.significant && !item.deathsTotal) return null

  const parsed = buildDate(item.year, item.month, item.day)
  if (!parsed) return null

  const volcanoNumber = item.volcanoLocationNewNum ? String(item.volcanoLocationNewNum) : null
  const sourceUrl = volcanoNumber
    ? `https://volcano.si.edu/volcano.cfm?vn=${volcanoNumber}`
    : NOAA_BASE

  const externalId = `volcanic_eruption_noaa_${item.id}`
  const sourceExternalId = `volcanic_eruption_source_noaa_${item.id}`

  const locationStr = item.location ? ` (${item.location})` : ''
  const countryStr = item.country ?? 'unknown country'
  const dateStr = parsed.date.toISOString().split('T')[0]!
  const sigStr = item.significant ? 'significant' : 'notable'
  const deathStr = item.deathsTotal ? `, with approximately ${item.deathsTotal.toLocaleString()} deaths recorded` : ''

  const claimText = `${item.name}${locationStr} in ${countryStr} experienced a ${sigStr} eruption on ${dateStr}${deathStr}.`

  return {
    externalId,
    sourceExternalId,
    name: item.name,
    country: countryStr,
    location: item.location ?? '',
    eruptionDate: parsed.date,
    datePrecision: parsed.precision,
    vei: null,
    deaths: item.deathsTotal,
    latitude: item.latitude,
    longitude: item.longitude,
    volcanoNumber,
    sourceUrl,
    claimText,
  }
}

function buildGVPCandidate(item: GVPEruption): EruptionRecord | null {
  const vei = item.VEI != null ? (typeof item.VEI === 'string' ? parseFloat(item.VEI) : item.VEI) : null
  if (vei == null && !item.Evidence_Category) return null
  if (vei != null && vei < 2) return null

  const parsed = buildDate(item.Start_Year, item.Start_Month, item.Start_Day)
  if (!parsed) return null

  const volcanoNumber = item.Volcano_Number ?? null
  const sourceUrl = volcanoNumber
    ? `https://volcano.si.edu/volcano.cfm?vn=${volcanoNumber}`
    : GVP_URL

  const eruptionNum = item.Eruption_Number ?? ''
  const externalId = `volcanic_eruption_gvp_${volcanoNumber ?? 'unk'}_${eruptionNum || parsed.date.getFullYear()}`
  const sourceExternalId = `volcanic_eruption_source_gvp_${volcanoNumber ?? 'unk'}_${eruptionNum || parsed.date.getFullYear()}`

  const name = item.Volcano_Name ?? 'Unknown Volcano'
  const countryStr = item.Country ?? 'unknown country'
  const locationStr = item.Subregion ? ` (${item.Subregion})` : ''
  const dateStr = parsed.date.toISOString().split('T')[0]!
  const veiStr = vei != null ? `VEI ${vei}` : 'unknown VEI'

  const claimText = `${name}${locationStr} in ${countryStr} erupted on ${dateStr}, reaching ${veiStr}.`

  return {
    externalId,
    sourceExternalId,
    name,
    country: countryStr,
    location: item.Subregion ?? '',
    eruptionDate: parsed.date,
    datePrecision: parsed.precision,
    vei,
    deaths: null,
    latitude: item.Latitude != null ? parseFloat(String(item.Latitude)) : null,
    longitude: item.Longitude != null ? parseFloat(String(item.Longitude)) : null,
    volcanoNumber,
    sourceUrl,
    claimText,
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

// ── Write one record ──────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: EruptionRecord, topicIds: string[]): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `GVP/NOAA: ${rec.name} eruption (${rec.eruptionDate.toISOString().split('T')[0]})`,
      url: rec.sourceUrl,
      publishedAt: rec.eruptionDate,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.sourceExternalId,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.eruptionDate,
      claimEmergedPrecision: rec.datePrecision,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        volcanoName: rec.name,
        country: rec.country,
        location: rec.location,
        vei: rec.vei,
        deaths: rec.deaths,
        latitude: rec.latitude,
        longitude: rec.longitude,
        volcanoNumber: rec.volcanoNumber,
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
      reason: 'NOAA NGDC / Smithsonian GVP — peer-reviewed volcanological record',
      changedAt: rec.eruptionDate,
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

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to run full ingestion.')
    process.exit(1)
  }

  console.log(`\n── Pipeline S5: Major Volcanic Eruptions (NOAA NGDC / GVP) ─────────────────`)
  console.log(`Mode: ${mode} | Min year: ${MIN_YEAR} | Filter: VEI ≥ 2 OR deaths > 0 | Limit: ${limit || 'all'}`)

  // Step 1: Topics (skipped in dry-run)
  let topicIds: string[] = []
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    const root = await ensureTopic('volcanic-eruptions', 'Volcanic Eruptions (GVP)', 'science')
    const highVEI = await ensureTopic('volcanic-eruptions-vei4plus', 'Major Volcanic Eruptions (VEI 4+)', 'science', 'volcanic-eruptions')
    topicIds = [root, highVEI]
  }

  // Step 2: Fetch eruption data
  console.log('\nStep 2: Fetching eruption data...')
  let candidates: EruptionRecord[] = []
  let source: 'noaa' | 'gvp' = 'noaa'

  try {
    const noaaItems = await fetchNOAAEruptions()
    console.log(`  NOAA returned ${noaaItems.length} total records`)

    const built = noaaItems.map(buildNOAACandidate).filter((r): r is EruptionRecord => r !== null)
    console.log(`  After filter (year ≥ ${MIN_YEAR}, VEI ≥ 2 OR deaths > 0): ${built.length} candidates`)

    if (built.length < 20) {
      console.warn(`  NOAA returned fewer than 20 candidates — falling back to GVP`)
      throw new Error('NOAA data insufficient')
    }

    candidates = built
    source = 'noaa'
  } catch (err) {
    console.warn(`  NOAA fetch failed or insufficient: ${err instanceof Error ? err.message : err}`)
    console.log('  Trying GVP fallback...')
    try {
      const gvpItems = await fetchGVPEruptions()
      const built = gvpItems.map(buildGVPCandidate).filter((r): r is EruptionRecord => r !== null)
      console.log(`  GVP after filter (year ≥ ${MIN_YEAR}, VEI ≥ 2): ${built.length} candidates`)
      candidates = built
      source = 'gvp'
    } catch (gvpErr) {
      console.error(`  GVP fallback also failed: ${gvpErr instanceof Error ? gvpErr.message : gvpErr}`)
      process.exit(1)
    }
  }

  // Deduplicate by externalId
  const seen = new Set<string>()
  candidates = candidates.filter(c => {
    if (seen.has(c.externalId)) return false
    seen.add(c.externalId); return true
  })

  // VEI breakdown (GVP has VEI; NOAA does not)
  const veiBreakdown: Record<string, number> = {}
  for (const c of candidates) {
    const key = c.vei != null ? `VEI ${c.vei}` : 'no VEI data'
    veiBreakdown[key] = (veiBreakdown[key] ?? 0) + 1
  }

  console.log(`\nCandidates: ${candidates.length} from ${source.toUpperCase()}`)
  if (source === 'gvp') {
    console.log('VEI breakdown:', Object.entries(veiBreakdown).sort().map(([k, v]) => `${k}: ${v}`).join(', '))
  } else {
    console.log('Note: NOAA source has no VEI field; filtered by significant/deaths flags instead')
  }

  const toProcess = limit > 0 ? candidates.slice(0, limit) : candidates

  // ── Dry-run ───────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Dry-run sample (no DB writes)...')

    const sample = toProcess.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      volcanoName: r.name,
      country: r.country,
      location: r.location,
      eruptionDate: r.eruptionDate.toISOString(),
      datePrecision: r.datePrecision,
      vei: r.vei,
      deaths: r.deaths,
      latitude: r.latitude,
      longitude: r.longitude,
      volcanoNumber: r.volcanoNumber,
      sourceUrl: r.sourceUrl,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      dataSource: source,
      minYear: MIN_YEAR,
      totalCandidates: candidates.length,
      veiBreakdown,
      sample,
    }

    fs.writeFileSync('volcanic-eruptions-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: volcanic-eruptions-dry-run-sample.json')
    console.log('\nDry-run complete. STOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ──────────────────────────────────────────────────────────────
  console.log(`\nFull ingestion: ${toProcess.length} rows...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of toProcess) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${toProcess.length} — ${rec.name} ${rec.eruptionDate.getFullYear()}`)
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
