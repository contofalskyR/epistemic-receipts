// Pipeline: ucdp_v1
// Source: UCDP/PRIO Armed Conflict Dataset v25.1 (Uppsala Conflict Data Program + PRIO)
//   https://ucdp.uu.se/downloads/
//
// The public API now (Feb 2026) requires an access token, but the bulk CSV downloads
// remain open under CC BY 4.0. We use:
//   - Dyadic v25.1 — one row per (conflict, dyad, year) with intensity_level + sides + gwno
//   - Battle-Related Deaths (Dyadic) v25.1 — left-joined for bd_best / bd_low / bd_high
// One Claim per (conflict_id, dyad_id, year) — ~3,400 records.
//
// Run:
//   npx tsx scripts/ingest-ucdp.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-ucdp.ts
//   ALLOW_EDITS=true npx tsx scripts/ingest-ucdp.ts --limit 50

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import { execSync } from 'child_process'
import { parse as csvParse } from 'csv-parse/sync'

const prisma = new PrismaClient()

const INGESTED_BY = 'ucdp_v1'
const PIPELINE_URL = 'https://ucdp.uu.se/downloads/'
const DYADIC_ZIP = 'https://ucdp.uu.se/downloads/dyadic/ucdp-dyadic-251-csv.zip'
const BRD_ZIP = 'https://ucdp.uu.se/downloads/brd/ucdp-brd-dyadic-251-csv.zip'

// ── Maps ─────────────────────────────────────────────────────────────────────

// Gleditsch-Ward numbers → ISO 3166-1 alpha-2.
// Covers every gwno_loc value that appears in UCDP/PRIO Dyadic v25.1.
const GWNO_TO_ISO: Record<string, string> = {
  '2': 'US', '20': 'CA', '40': 'CU', '41': 'HT', '42': 'DO', '51': 'JM', '52': 'TT',
  '70': 'MX', '90': 'GT', '91': 'HN', '92': 'SV', '93': 'NI', '94': 'CR', '95': 'PA',
  '100': 'CO', '101': 'VE', '110': 'GY', '115': 'SR',
  '130': 'EC', '135': 'PE', '140': 'BR', '145': 'BO', '150': 'PY', '155': 'CL', '160': 'AR', '165': 'UY',
  '200': 'GB', '205': 'IE', '210': 'NL', '211': 'BE',
  '220': 'FR', '230': 'ES', '235': 'PT',
  '255': 'DE', '260': 'DE', '265': 'DE', '290': 'PL',
  '305': 'AT', '310': 'HU', '315': 'CZ', '316': 'CZ', '317': 'SK',
  '325': 'IT',
  '339': 'AL', '341': 'ME', '343': 'MK', '344': 'HR', '345': 'RS', '346': 'BA', '347': 'XK',
  '349': 'SI', '350': 'GR', '352': 'CY', '355': 'BG', '359': 'MD', '360': 'RO',
  '365': 'RU', '366': 'EE', '367': 'LV', '368': 'LT', '369': 'UA', '370': 'BY',
  '371': 'AM', '372': 'GE', '373': 'AZ',
  '375': 'FI', '380': 'SE', '385': 'NO', '390': 'DK',
  '402': 'CV', '404': 'GW', '411': 'GQ', '420': 'GM',
  '432': 'ML', '433': 'SN', '434': 'BJ', '435': 'MR', '436': 'NE',
  '437': 'CI', '438': 'GN', '439': 'BF', '450': 'LR', '451': 'SL', '452': 'GH',
  '461': 'TG', '471': 'CM', '475': 'NG', '481': 'GA', '482': 'CF', '483': 'TD',
  '484': 'CG', '490': 'CD',
  '500': 'UG', '501': 'KE', '510': 'TZ', '516': 'BI', '517': 'RW', '520': 'SO',
  '522': 'DJ', '530': 'ET', '531': 'ER', '540': 'AO', '541': 'MZ', '551': 'ZM',
  '552': 'ZW', '553': 'MW', '560': 'ZA', '565': 'NA', '570': 'LS',
  '580': 'MG', '581': 'KM', '590': 'MU',
  '600': 'MA', '615': 'DZ', '616': 'TN', '620': 'LY', '625': 'SD', '626': 'SS',
  '630': 'IR', '640': 'TR', '645': 'IQ', '651': 'EG', '652': 'SY', '660': 'LB',
  '663': 'JO', '666': 'IL', '670': 'SA', '678': 'YE', '680': 'YE',
  '690': 'KW', '692': 'BH', '694': 'QA', '696': 'AE', '698': 'OM',
  '700': 'AF', '701': 'TM', '702': 'TJ', '703': 'KG', '704': 'UZ', '705': 'KZ',
  '710': 'CN', '712': 'MN', '713': 'TW',
  '731': 'KP', '732': 'KR', '740': 'JP',
  '750': 'IN', '760': 'BT', '770': 'PK', '771': 'BD', '775': 'MM', '780': 'LK', '790': 'NP',
  '800': 'TH', '811': 'KH', '812': 'LA', '816': 'VN', '817': 'VN',
  '820': 'MY', '830': 'SG', '840': 'PH', '850': 'ID', '860': 'TL',
  '900': 'AU', '910': 'PG', '920': 'NZ',
}

const INTENSITY_LABEL: Record<string, string> = {
  '1': 'Minor armed conflict (25–999 battle-related deaths)',
  '2': 'War (≥1,000 battle-related deaths)',
}
const INTENSITY_SHORT: Record<string, string> = { '1': 'Minor armed conflict', '2': 'War' }

const TYPE_LABEL: Record<string, string> = {
  '1': 'Extrasystemic',
  '2': 'Interstate',
  '3': 'Internal',
  '4': 'Internationalized internal',
}

// ── Row types ────────────────────────────────────────────────────────────────

interface DyadicRow {
  dyad_id: string
  conflict_id: string
  location: string
  side_a: string
  side_b: string
  incompatibility: string
  territory_name: string
  year: string
  intensity_level: string
  type_of_conflict: string
  start_date: string
  gwno_a: string
  gwno_b: string
  gwno_loc: string
  region: string
}

interface BrdRow {
  conflict_id: string
  dyad_id: string
  year: string
  bd_best: string
  bd_low: string
  bd_high: string
}

interface ConflictYearRecord {
  conflictId: string
  dyadId: string
  year: number
  dyadName: string
  sideA: string
  sideB: string
  location: string
  intensityLevel: number
  intensityLabel: string
  typeOfConflict: number
  typeLabel: string
  incompatibility: string
  territoryName: string | null
  gwnoA: string
  gwnoLoc: string
  countryIso: string | null
  battleDeathsBest: number | null
  battleDeathsLow: number | null
  battleDeathsHigh: number | null
  externalId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)
  const limitIdx = args.indexOf('--limit')
  const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1] ?? '0', 10) || 0 : 0
  return { dryRun: args.includes('--dry-run'), limit }
}

// ── Fetch + extract ──────────────────────────────────────────────────────────

async function fetchToFile(url: string, dest: string) {
  const res = await fetch(url, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`)
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function readCsvFromZip(zipPath: string, expectedFileSuffix: string): string {
  const extractDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ucdp-'))
  execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' })
  const entries = fs.readdirSync(extractDir).filter(f => f.toLowerCase().endsWith(expectedFileSuffix))
  if (entries.length === 0) throw new Error(`No ${expectedFileSuffix} file found in ${zipPath}`)
  return fs.readFileSync(path.join(extractDir, entries[0]), 'utf-8')
}

// ── Parse ────────────────────────────────────────────────────────────────────

function buildDyadName(sideA: string, sideB: string): string {
  return `${sideA} – ${sideB}`
}

// gwno_loc / gwno_a can be comma-separated lists (interstate or shared-location
// conflicts). Return the first GWNO with a known ISO mapping.
function resolveIso(...candidates: string[]): string | null {
  for (const raw of candidates) {
    if (!raw) continue
    const parts = raw.split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
    for (const p of parts) {
      const iso = GWNO_TO_ISO[p]
      if (iso) return iso
    }
  }
  return null
}

function parseAll(dyadicZipPath: string, brdZipPath: string): ConflictYearRecord[] {
  const dyadicCsv = readCsvFromZip(dyadicZipPath, '.csv')
  const brdCsv = readCsvFromZip(brdZipPath, '.csv')

  const dyadicRows = csvParse(dyadicCsv, { columns: true, skip_empty_lines: true, trim: true }) as DyadicRow[]
  const brdRows = csvParse(brdCsv, { columns: true, skip_empty_lines: true, trim: true }) as BrdRow[]

  // index BRD by dyad_id|year
  const brdIndex = new Map<string, BrdRow>()
  for (const r of brdRows) brdIndex.set(`${r.dyad_id}|${r.year}`, r)

  const out: ConflictYearRecord[] = []
  for (const r of dyadicRows) {
    const year = parseInt(r.year, 10)
    if (!Number.isFinite(year)) continue
    const intensityLevel = parseInt(r.intensity_level, 10)
    const typeOfConflict = parseInt(r.type_of_conflict, 10)
    const brd = brdIndex.get(`${r.dyad_id}|${r.year}`)
    const bdBest = brd && brd.bd_best && brd.bd_best !== '-999' ? parseInt(brd.bd_best, 10) : null
    const bdLow = brd && brd.bd_low && brd.bd_low !== '-999' ? parseInt(brd.bd_low, 10) : null
    const bdHigh = brd && brd.bd_high && brd.bd_high !== '-999' ? parseInt(brd.bd_high, 10) : null

    out.push({
      conflictId: r.conflict_id,
      dyadId: r.dyad_id,
      year,
      dyadName: buildDyadName(r.side_a, r.side_b),
      sideA: r.side_a,
      sideB: r.side_b,
      location: r.location,
      intensityLevel,
      intensityLabel: INTENSITY_SHORT[r.intensity_level] ?? `Intensity ${r.intensity_level}`,
      typeOfConflict,
      typeLabel: TYPE_LABEL[r.type_of_conflict] ?? `Type ${r.type_of_conflict}`,
      incompatibility: r.incompatibility,
      territoryName: r.territory_name && r.territory_name !== '""' ? r.territory_name : null,
      gwnoA: r.gwno_a,
      gwnoLoc: r.gwno_loc,
      countryIso: resolveIso(r.gwno_loc, r.gwno_a),
      battleDeathsBest: Number.isFinite(bdBest as number) ? bdBest : null,
      battleDeathsLow: Number.isFinite(bdLow as number) ? bdLow : null,
      battleDeathsHigh: Number.isFinite(bdHigh as number) ? bdHigh : null,
      externalId: `ucdp_conflict_${r.conflict_id}_dyad_${r.dyad_id}_${r.year}`,
    })
  }
  return out
}

// ── Claim construction ──────────────────────────────────────────────────────

function buildTitle(rec: ConflictYearRecord): string {
  return `${rec.dyadName}: ${rec.intensityLabel} in ${rec.location} (${rec.year})`
}

function buildBody(rec: ConflictYearRecord): string {
  const lines: string[] = []
  lines.push(`Type: ${rec.typeLabel}.`)
  if (rec.battleDeathsBest !== null) {
    const rangeBits: string[] = []
    if (rec.battleDeathsLow !== null) rangeBits.push(rec.battleDeathsLow.toString())
    if (rec.battleDeathsHigh !== null) rangeBits.push(rec.battleDeathsHigh.toString())
    const range = rangeBits.length === 2 ? ` (range: ${rangeBits[0]}–${rangeBits[1]})` : ''
    lines.push(`Estimated battle-related deaths: ${rec.battleDeathsBest.toLocaleString('en-US')}${range}.`)
  } else {
    lines.push('Battle-related deaths: not estimated in BRD dataset.')
  }
  lines.push(`Intensity: ${INTENSITY_LABEL[String(rec.intensityLevel)] ?? rec.intensityLabel}.`)
  if (rec.territoryName) lines.push(`Territory in dispute: ${rec.territoryName}.`)
  return lines.join(' ')
}

// ── DB plumbing ─────────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()
async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  topicCache.set(slug, created.id)
  return created.id
}

async function writeRecord(tx: TxClient, rec: ConflictYearRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const sourceUrl = `https://ucdp.uu.se/conflict/${rec.conflictId}`
  const source = await tx.source.create({
    data: {
      name: `UCDP/PRIO Armed Conflict — ${rec.dyadName} (${rec.year})`,
      url: sourceUrl,
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `ucdp_source_${rec.conflictId}_${rec.dyadId}_${rec.year}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: `${buildTitle(rec)}. ${buildBody(rec)}`,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: new Date(`${rec.year}-01-01T00:00:00Z`),
      claimEmergedPrecision: 'YEAR',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        conflictId: rec.conflictId,
        dyadId: rec.dyadId,
        dyadName: rec.dyadName,
        sideA: rec.sideA,
        sideB: rec.sideB,
        location: rec.location,
        year: rec.year,
        intensityLevel: rec.intensityLevel,
        typeOfConflict: rec.typeOfConflict,
        battleDeathsBest: rec.battleDeathsBest,
        battleDeathsLow: rec.battleDeathsLow,
        battleDeathsHigh: rec.battleDeathsHigh,
        gwno: rec.gwnoA,
        gwnoLoc: rec.gwnoLoc,
        country: rec.countryIso,
        incompatibility: rec.incompatibility,
        territoryName: rec.territoryName,
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
    data: { edgeId: edge.id, priorScore: null, newScore: 95, reason: 'UCDP/PRIO Armed Conflict Dataset — conflict-dyad-year as HARD_FACT', changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, limit } = parseArgs()
  console.log(`\n── Pipeline: UCDP/PRIO Armed Conflict (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'}${limit ? ` · limit=${limit}` : ''}`)
  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  const dyadicZipPath = path.join(os.tmpdir(), 'ucdp-dyadic.zip')
  const brdZipPath = path.join(os.tmpdir(), 'ucdp-brd-dyadic.zip')

  console.log(`Fetching ${DYADIC_ZIP}`)
  await fetchToFile(DYADIC_ZIP, dyadicZipPath)
  console.log(`Fetching ${BRD_ZIP}`)
  await fetchToFile(BRD_ZIP, brdZipPath)

  const records = parseAll(dyadicZipPath, brdZipPath)
  console.log(`  Parsed ${records.length} conflict-dyad-year records`)
  const withBd = records.filter(r => r.battleDeathsBest !== null).length
  const withIso = records.filter(r => r.countryIso !== null).length
  console.log(`    with battle-death estimates: ${withBd}`)
  console.log(`    with country ISO mapped:     ${withIso}`)
  const missingIso = new Set<string>()
  for (const r of records) if (!r.countryIso) missingIso.add(r.gwnoLoc || r.gwnoA)
  if (missingIso.size > 0) console.log(`    GWNOs missing from ISO map: ${[...missingIso].join(', ')}`)

  if (dryRun) {
    const sample = records.slice(0, 10)
    const outFile = 'ucdp-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ total: records.length, withBattleDeaths: withBd, withIso, sample }, null, 2))
    for (const r of sample) {
      console.log(`  [${r.year}] ${r.dyadName} | ${r.location} (${r.countryIso ?? '??'}) | ${INTENSITY_SHORT[String(r.intensityLevel)]} | best=${r.battleDeathsBest ?? '—'}`)
    }
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicId = await ensureTopic('armed-conflict', 'Armed Conflict', 'security', 'security')
  const queue = limit > 0 ? records.slice(0, limit) : records
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  let n = 0
  for (const rec of queue) {
    try {
      const r = await prisma.$transaction(tx => writeRecord(tx, rec, topicId), { timeout: 30000 })
      if (r === 'ingested') counts.ingested++
      else if (r === 'skipped') counts.skipped++
      else counts.errors++
    } catch (err) {
      console.error(`  Failed ${rec.externalId}: ${err instanceof Error ? err.message : err}`)
      counts.errors++
    }
    n++
    if (n % 250 === 0) console.log(`  Progress: ${n}/${queue.length} — ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
  }
  console.log(`\nIngestion complete. Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)
  const db = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY, deleted: false } })
  console.log(`DB claims (${INGESTED_BY}): ${db}`)
  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
