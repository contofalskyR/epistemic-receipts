// Pipeline S4 — Orbital Space Missions (GCAT)
// Source: Jonathan McDowell's General Catalog of Artificial Space Objects
//   https://planet4589.org/space/gcat/data/derived/launchlog.tsv  (primary)
//   https://planet4589.org/space/gcat/data/tables/launch.tsv       (fallback)
// Target: ~6,000+ orbital launches since Sputnik (1957)
// Run: npx tsx scripts/ingest-space-missions.ts --dry-run [--limit N]
//      ALLOW_EDITS=true npx tsx scripts/ingest-space-missions.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'space_missions_v1'
const GCAT_URLS = [
  'https://planet4589.org/space/gcat/tsv/launch/launch.tsv',
]
const DATASET_SOURCE_URL = 'https://planet4589.org/space/gcat/'
const DATASET_SOURCE_EXTID = 'gcat_launch_catalog_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SpaceMissionRecord {
  externalId: string
  launchTag: string
  cospar: string
  payloadName: string
  launchDate: Date
  datePrecision: 'DAY' | 'MONTH' | 'YEAR'
  country: string
  launchSite: string
  orbitType: string
  lvType: string
  apogeeKm: number | null
  perigeeKm: number | null
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

// ── Fetch + parse GCAT TSV ────────────────────────────────────────────────────

async function fetchGCATText(): Promise<{ text: string; url: string }> {
  for (const url of GCAT_URLS) {
    try {
      console.log(`  Fetching: ${url}`)
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'EpistemicReceipts/1.0 (research; contact: robert.contofalsky@rutgers.edu)',
          Accept: 'text/plain, text/tab-separated-values, */*',
        },
        signal: AbortSignal.timeout(30000),
      })
      if (!res.ok) { console.warn(`  HTTP ${res.status} from ${url}`); continue }
      const text = await res.text()
      if (text.length < 200) { console.warn(`  Response too short (${text.length}b) from ${url}`); continue }
      console.log(`  Fetched ${(text.length / 1024).toFixed(1)} KB from ${url}`)
      return { text, url }
    } catch (err) {
      console.warn(`  Fetch error from ${url}: ${err instanceof Error ? err.message : err}`)
    }
  }
  throw new Error('Failed to fetch GCAT data from all URLs')
}

function parseGCATTSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split('\n')
  let headerLine = ''
  let dataStart = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const trimmed = line.trim()
    if (!trimmed) continue

    // GCAT header: starts with '#' and has tabs, or is the first non-comment line
    if (trimmed.startsWith('#') && trimmed.includes('\t')) {
      headerLine = trimmed.replace(/^#+\s*/, '')
      dataStart = i + 1
      break
    }
    if (!trimmed.startsWith('#')) {
      headerLine = trimmed
      dataStart = i + 1
      break
    }
  }

  if (!headerLine) throw new Error('GCAT TSV: could not find header line')

  const headers = headerLine.split('\t').map(h => h.trim())
  console.log(`  Columns (${headers.length}): ${headers.slice(0, 12).join(', ')}${headers.length > 12 ? ', ...' : ''}`)

  const rows: Record<string, string>[] = []
  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i]!
    if (!line.trim() || line.trim().startsWith('#')) continue
    const vals = line.split('\t')
    const row: Record<string, string> = {}
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = (vals[j] ?? '').trim()
    }
    rows.push(row)
  }
  return { headers, rows }
}

// Pick first non-empty, non-sentinel value from a list of column name candidates
function col(row: Record<string, string>, ...names: string[]): string {
  for (const name of names) {
    const v = row[name]
    if (v !== undefined && v !== '' && v !== '-' && v !== '?' && v !== 'N/A') return v
  }
  return ''
}

const MONTH_MAP: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
}

function parseLaunchDate(raw: string): { date: Date; precision: 'DAY' | 'MONTH' | 'YEAR' } | null {
  if (!raw) return null
  const s = raw.trim()

  // GCAT format: "1957 Oct  4 1928" or "1957 Oct  4" (year Mon day [time])
  const m1 = s.match(/^(\d{4})\s+([A-Za-z]{3})\s+(\d{1,2})/)
  if (m1) {
    const y = m1[1]!, mon = MONTH_MAP[m1[2]!], dd = m1[3]!.padStart(2, '0')
    if (mon) {
      const d = new Date(`${y}-${mon}-${dd}T00:00:00Z`)
      if (!isNaN(d.getTime())) return { date: d, precision: 'DAY' }
    }
  }

  // GCAT partial: "1957 Oct"
  const m2 = s.match(/^(\d{4})\s+([A-Za-z]{3})$/)
  if (m2) {
    const y = m2[1]!, mon = MONTH_MAP[m2[2]!]
    if (mon) {
      const d = new Date(`${y}-${mon}-01T00:00:00Z`)
      if (!isNaN(d.getTime())) return { date: d, precision: 'MONTH' }
    }
  }

  // Plain year: "1957"
  const m3 = s.match(/^(\d{4})$/)
  if (m3) {
    const y = parseInt(m3[1]!, 10)
    if (y >= 1942 && y <= 2030) return { date: new Date(`${y}-01-01T00:00:00Z`), precision: 'YEAR' }
  }

  return null
}

function safeid(s: string): string {
  return s.replace(/[^A-Za-z0-9_\-]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '')
}

function buildCandidate(row: Record<string, string>): SpaceMissionRecord | null {
  // GCAT launch.tsv column names (from header):
  // Launch_Tag, Launch_JD, Launch_Date, LV_Type, Variant, Flight_ID, Flight, Mission,
  // FlightCode, Platform, Launch_Site, Launch_Pad, Ascent_Site, Ascent_Pad, Apogee,
  // Apoflag, Range, RangeFlag, Dest, OrbPay, Agency, LaunchCode, FailCode, Group,
  // Category, LTCite, Cite, Notes
  const dateRaw = col(row, 'Launch_Date')
  const launchTag = col(row, 'Launch_Tag')
  const lvType = col(row, 'LV_Type')
  const launchSite = col(row, 'Launch_Site', 'Launch_Pad')
  const apogeeRaw = col(row, 'Apogee')
  const orbPayRaw = col(row, 'OrbPay')
  const agency = col(row, 'Agency')
  const dest = col(row, 'Dest')
  const mission = col(row, 'Mission', 'Flight')
  const failCode = col(row, 'FailCode')

  if (!dateRaw || !launchTag) return null

  const parsed = parseLaunchDate(dateRaw)
  if (!parsed) return null
  if (parsed.date.getFullYear() < 1957) return null

  const apogeeKm = apogeeRaw ? parseFloat(apogeeRaw) || null : null
  const orbPay = orbPayRaw ? parseFloat(orbPayRaw) || 0 : 0

  // OrbPay > 0 means an orbital payload was carried — primary filter for orbital missions
  // Suborbital ballistic missiles, ICBM tests, and sounding rockets have OrbPay = 0
  if (orbPay <= 0) return null

  const externalId = `space_mission_${safeid(launchTag)}`

  const payloadName = mission !== '-' && mission ? mission : launchTag
  const orbitType = dest !== '-' && dest ? dest : (apogeeKm && apogeeKm > 35000 ? 'GEO/HEO' : 'LEO')

  const dateLabel = parsed.date.toISOString().split('T')[0]!
  const siteLabel = launchSite ? ` from ${launchSite}` : ''
  const agencyLabel = agency || 'unknown agency'
  const vehicleLabel = lvType ? ` on ${lvType}` : ''
  const failNote = failCode && failCode !== '-' && failCode !== 'S' ? ` (outcome: ${failCode})` : ''

  const claimText = `Launch ${launchTag}${siteLabel} on ${dateLabel} by ${agencyLabel}${vehicleLabel} carried ${orbPay > 0 ? `${orbPay.toFixed(3)}t orbital payload` : 'payload'} to ${orbitType}${failNote}.`

  return {
    externalId,
    launchTag,
    cospar: '',
    payloadName,
    launchDate: parsed.date,
    datePrecision: parsed.precision,
    country: agency,
    launchSite,
    orbitType,
    lvType,
    apogeeKm,
    perigeeKm: null,
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

async function writeRow(
  tx: TxClient,
  rec: SpaceMissionRecord,
  sharedSourceId: string,
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
      claimEmergedAt: rec.launchDate,
      claimEmergedPrecision: rec.datePrecision,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        launchTag: rec.launchTag,
        cospar: rec.cospar,
        payloadName: rec.payloadName,
        country: rec.country,
        launchSite: rec.launchSite,
        orbitType: rec.orbitType,
        lvType: rec.lvType,
        apogeeKm: rec.apogeeKm,
        perigeeKm: rec.perigeeKm,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: sharedSourceId,
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
      reason: 'GCAT — Jonathan McDowell orbital launch catalog, authoritative astrodynamics record',
      changedAt: rec.launchDate,
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

  console.log(`\n── Pipeline S4: Orbital Space Missions (GCAT) ─────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // Step 1: Topics + shared source (skipped in dry-run)
  let topicIds: string[] = []
  let sharedSourceId = ''

  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics + shared source...')
    const root = await ensureTopic('space-missions', 'Orbital Space Missions (GCAT)', 'science')
    topicIds = [root]

    const existing = await prisma.source.findUnique({ where: { externalId: DATASET_SOURCE_EXTID } })
    if (existing) {
      sharedSourceId = existing.id
      console.log(`  Shared source exists: ${existing.id}`)
    } else {
      const created = await prisma.source.create({
        data: {
          name: 'GCAT: General Catalog of Artificial Space Objects (Jonathan McDowell)',
          url: DATASET_SOURCE_URL,
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: DATASET_SOURCE_EXTID,
        },
      })
      sharedSourceId = created.id
      console.log(`  Created shared source: ${created.id}`)
    }
  }

  // Step 2: Fetch and parse TSV
  console.log('\nStep 2: Fetching GCAT launch log...')
  const { text } = await fetchGCATText()
  const { rows } = parseGCATTSV(text)
  console.log(`  Parsed ${rows.length} raw rows`)

  // Step 3: Build candidates
  console.log('\nStep 3: Building candidates...')
  const seen = new Set<string>()
  const candidates: SpaceMissionRecord[] = []
  let skipped = 0

  for (const row of rows) {
    const rec = buildCandidate(row)
    if (!rec) { skipped++; continue }
    if (seen.has(rec.externalId)) { skipped++; continue }
    seen.add(rec.externalId)
    candidates.push(rec)
  }

  console.log(`  Candidates: ${candidates.length} (skipped malformed/suborbital/duplicate: ${skipped})`)

  // Year breakdown (sample)
  const decadeBreakdown: Record<string, number> = {}
  for (const c of candidates) {
    const decade = `${Math.floor(c.launchDate.getFullYear() / 10) * 10}s`
    decadeBreakdown[decade] = (decadeBreakdown[decade] ?? 0) + 1
  }
  console.log('Decade breakdown:', Object.entries(decadeBreakdown).sort().map(([k, v]) => `${k}: ${v}`).join(', '))

  const toProcess = limit > 0 ? candidates.slice(0, limit) : candidates

  // ── Dry-run ───────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 4: Dry-run sample (no DB writes)...')

    const sample = toProcess.slice(0, 10).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      cospar: r.cospar,
      launchTag: r.launchTag,
      payloadName: r.payloadName,
      launchDate: r.launchDate.toISOString(),
      datePrecision: r.datePrecision,
      country: r.country,
      launchSite: r.launchSite,
      orbitType: r.orbitType,
      lvType: r.lvType,
      apogeeKm: r.apogeeKm,
      perigeeKm: r.perigeeKm,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      sourceUrl: GCAT_URLS[0],
      totalCandidates: candidates.length,
      decadeBreakdown,
      sample,
    }

    fs.writeFileSync('space-missions-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: space-missions-dry-run-sample.json')
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
        async (tx) => writeRow(tx, rec, sharedSourceId, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++
      if (verbose || counts.ingested % 500 === 0) {
        console.log(`  Progress: ${counts.ingested}/${toProcess.length} — ${rec.payloadName} (${rec.launchDate.toISOString().split('T')[0]})`)
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
