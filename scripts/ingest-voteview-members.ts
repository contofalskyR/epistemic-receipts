// Pipeline — Voteview DW-NOMINATE Member Ideology Scores (voteview_members_v1)
// Source: https://voteview.com/static/data/out/members/HSall_members.csv
// One row per member per Congress per chamber; ~13,000 unique (icpsr, congress, chamber) tuples.
// Upserts into MemberIdeology by (icpsrId, congress, chamber).
// Records CSV source URL + SHA-256 file hash in metadata for reproducibility.
// Nokken-Poole dim1/dim2 stored in metadata but NOT surfaced in UI per B11 decision.
//
// Download the CSV first:
//   mkdir -p /tmp/voteview
//   curl -L https://voteview.com/static/data/out/members/HSall_members.csv \
//     -o /tmp/voteview/HSall_members.csv
//
// Run (dry-run default):
//   npx tsx scripts/ingest-voteview-members.ts --dry-run
//   npx tsx scripts/ingest-voteview-members.ts --execute
//   npx tsx scripts/ingest-voteview-members.ts --execute --congress 118

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as crypto from 'crypto'
import { parse as csvParse } from 'csv-parse/sync'

const prisma = new PrismaClient()

const CSV_URL = 'https://voteview.com/static/data/out/members/HSall_members.csv'
const CSV_PATH = '/tmp/voteview/HSall_members.csv'
const BATCH_SIZE = 500
const DATA_SOURCE = 'voteview_members_v1'

interface MemberRow {
  congress: string
  chamber: string
  icpsr: string
  state_icpsr: string
  district_code: string
  state_abbrev: string
  party_code: string
  occupancy: string
  last_means: string
  bioname: string
  bioguide_id: string
  born: string
  died: string
  nominate_dim1: string
  nominate_dim2: string
  nominate_geo_mean_probability: string
  nokken_poole_dim1: string
  nokken_poole_dim2: string
  [key: string]: string
}

function parseFloat_(s: string): number | null {
  if (!s || s.trim() === '' || s.trim() === 'NA') return null
  const v = parseFloat(s)
  return isNaN(v) ? null : v
}

function chamberFull(chamber: string): string {
  const c = chamber.trim().toUpperCase()
  if (c === 'Senate' || c === '2') return 'Senate'
  if (c === 'House' || c === '1') return 'House'
  // Voteview uses 'Senate' / 'House' text or numeric codes
  if (c.includes('SEN')) return 'Senate'
  return 'House'
}

function deterministicId(icpsrId: number, congress: number, chamber: string): string {
  // Deterministic cuid-compatible hex id: sha256 of composite key, prefixed
  const hash = crypto
    .createHash('sha256')
    .update(`${DATA_SOURCE}:${icpsrId}:${congress}:${chamber}`)
    .digest('hex')
    .slice(0, 24)
  return `mi_${hash}`
}

function fileSha256(path: string): string {
  const content = fs.readFileSync(path)
  return crypto.createHash('sha256').update(content).digest('hex')
}

async function run() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--execute')
  const congressFilter = (() => {
    const idx = args.indexOf('--congress')
    return idx >= 0 ? parseInt(args[idx + 1]) : null
  })()

  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}`)
    console.error(`Download it:`)
    console.error(`  mkdir -p /tmp/voteview`)
    console.error(`  curl -L ${CSV_URL} -o ${CSV_PATH}`)
    process.exit(1)
  }

  const sha256 = fileSha256(CSV_PATH)
  console.log(`CSV SHA-256: ${sha256}`)
  console.log(`Source URL: ${CSV_URL}`)
  if (dryRun) console.log(`DRY-RUN MODE — pass --execute to write`)

  const raw = fs.readFileSync(CSV_PATH, 'utf-8')
  const rows: MemberRow[] = csvParse(raw, { columns: true, skip_empty_lines: true })

  const filtered = congressFilter
    ? rows.filter(r => parseInt(r.congress) === congressFilter)
    : rows

  console.log(`Total rows in CSV: ${rows.length}`)
  console.log(`Rows after filter: ${filtered.length}`)

  let inserted = 0
  let updated = 0
  let skipped = 0

  for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
    const batch = filtered.slice(i, i + BATCH_SIZE)

    for (const row of batch) {
      const icpsrId = parseInt(row.icpsr)
      const congress = parseInt(row.congress)
      if (isNaN(icpsrId) || isNaN(congress)) { skipped++; continue }

      const chamber = chamberFull(row.chamber)
      const id = deterministicId(icpsrId, congress, chamber)
      const bioguideId = row.bioguide_id?.trim() || null

      const nominateDim1 = parseFloat_(row.nominate_dim1)
      const nominateDim2 = parseFloat_(row.nominate_dim2)
      const geoMeanProb = parseFloat_(row.nominate_geo_mean_probability)
      const nokkenPoole1 = parseFloat_(row.nokken_poole_dim1)
      const nokkenPoole2 = parseFloat_(row.nokken_poole_dim2)

      const metadata = {
        sourceUrl: CSV_URL,
        fileSha256: sha256,
        hasNokkenPoole: nokkenPoole1 !== null || nokkenPoole2 !== null,
        nokkenPoole1,
        nokkenPoole2,
      }

      if (dryRun) {
        if (i === 0 && inserted < 3) {
          console.log(`  SAMPLE: icpsr=${icpsrId} congress=${congress} chamber=${chamber} name=${row.bioname} dim1=${nominateDim1}`)
        }
        inserted++
        continue
      }

      const existing = await prisma.memberIdeology.findUnique({
        where: { icpsrId_congress_chamber: { icpsrId, congress, chamber } },
        select: { id: true },
      })

      if (existing) {
        await prisma.memberIdeology.update({
          where: { icpsrId_congress_chamber: { icpsrId, congress, chamber } },
          data: {
            bioguideId,
            memberName: row.bioname,
            party: row.party_code || null,
            stateAbbrev: row.state_abbrev || null,
            nominateDim1,
            nominateDim2,
            geoMeanProb,
            metadata,
            updatedAt: new Date(),
          },
        })
        updated++
      } else {
        await prisma.memberIdeology.create({
          data: {
            id,
            icpsrId,
            bioguideId,
            congress,
            chamber,
            memberName: row.bioname,
            party: row.party_code || null,
            stateAbbrev: row.state_abbrev || null,
            nominateDim1,
            nominateDim2,
            geoMeanProb,
            metadata,
            dataSource: DATA_SOURCE,
          },
        })
        inserted++
      }
    }

    if (!dryRun) {
      process.stdout.write(`\r  Progress: ${Math.min(i + BATCH_SIZE, filtered.length)}/${filtered.length}`)
    }
  }

  console.log(`\nDone.`)
  console.log(`  Inserted: ${inserted}`)
  if (!dryRun) {
    console.log(`  Updated:  ${updated}`)
    console.log(`  Skipped:  ${skipped}`)

    // DB-verified count
    const dbCount = await prisma.memberIdeology.count()
    console.log(`  MemberIdeology rows in DB: ${dbCount}`)
  } else {
    console.log(`  (dry-run: no writes)`)
  }

  await prisma.$disconnect()
}

run().catch(e => { console.error(e); process.exit(1) })
