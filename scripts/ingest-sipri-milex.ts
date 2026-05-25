// Pipeline: sipri_milex_v1
// Source: SIPRI Military Expenditure Database 1949-2025 (v1.2)
//   https://www.sipri.org/databases/milex
//   XLSX: https://www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx
//
// Note: SIPRI Arms Transfers database (S13 in roadmap) was auth-walled at
// atbackend.sipri.org/trades/* — no public unauthenticated endpoint.
// Military Expenditure remains a freely-downloadable Excel; treated as the
// SIPRI defence-spending substrate.
// Run:
//   npx tsx scripts/ingest-sipri-milex.ts --dry-run
//   ALLOW_EDITS=true npx tsx scripts/ingest-sipri-milex.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as X from 'xlsx'

const prisma = new PrismaClient()

const INGESTED_BY = 'sipri_milex_v1'
const SOURCE_URL = 'https://www.sipri.org/databases/milex'
const DATA_URL = 'https://www.sipri.org/sites/default/files/SIPRI-Milex-data-1949-2025_v1.2.xlsx'

interface MilexRecord {
  country: string
  year: number
  valueMillionsUsd: number
  externalId: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

// Regional header rows in the SIPRI sheet — skip these (they're not countries).
const REGION_HEADERS = new Set([
  'Africa', 'North Africa', 'sub-Saharan Africa',
  'Americas', 'Central America and the Caribbean', 'North America', 'South America',
  'Asia and Oceania', 'Central Asia', 'East Asia', 'Oceania', 'South Asia', 'South East Asia',
  'Europe', 'Central and Western Europe', 'Eastern Europe',
  'Middle East',
])

function parseArgs() {
  const args = process.argv.slice(2)
  return { dryRun: args.includes('--dry-run') }
}

async function fetchXlsx(): Promise<Buffer> {
  const res = await fetch(DATA_URL, { headers: { 'User-Agent': 'epistemic-receipts/1.0 (research)' } })
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  return Buffer.from(await res.arrayBuffer())
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60)
}

function parseSheet(wb: X.WorkBook): MilexRecord[] {
  const sheet = wb.Sheets['Constant (2024) US$']
  if (!sheet) throw new Error('Sheet "Constant (2024) US$" not found')
  const rows = X.utils.sheet_to_json<(string | number | null)[]>(sheet, { header: 1, defval: null })

  // Header is row 5 (0-indexed): ["Country", "", "Notes", 1949, 1950, ..., 2025]
  const header = rows[5]
  if (!header || header[0] !== 'Country') throw new Error('Header row 5 not as expected')
  const yearCols: { col: number; year: number }[] = []
  for (let i = 0; i < header.length; i++) {
    const v = header[i]
    if (typeof v === 'number' && v >= 1900 && v <= 2100) yearCols.push({ col: i, year: v })
  }

  const records: MilexRecord[] = []
  for (let r = 6; r < rows.length; r++) {
    const row = rows[r]
    if (!row || !row[0]) continue
    const country = String(row[0]).trim()
    if (!country || REGION_HEADERS.has(country)) continue
    // skip pure-section continuation rows where col[0] is empty
    for (const { col, year } of yearCols) {
      const raw = row[col]
      if (raw == null) continue
      if (typeof raw === 'string') {
        const s = raw.trim()
        if (!s || s === '...' || s === 'xxx') continue
        const num = parseFloat(s.replace(/[,\s]/g, ''))
        if (!Number.isFinite(num)) continue
        records.push({
          country,
          year,
          valueMillionsUsd: num,
          externalId: `sipri_milex_${slugify(country)}_${year}`,
        })
      } else if (typeof raw === 'number' && Number.isFinite(raw)) {
        records.push({
          country,
          year,
          valueMillionsUsd: raw,
          externalId: `sipri_milex_${slugify(country)}_${year}`,
        })
      }
    }
  }
  return records
}

function buildClaimText(rec: MilexRecord): string {
  const fmt = '$' + Math.round(rec.valueMillionsUsd).toLocaleString('en-US') + ' million'
  return `${rec.country} military expenditure in ${rec.year} was ${fmt} (constant 2024 US dollars), per SIPRI.`
}

const topicCache = new Map<string, string>()
async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  topicCache.set(slug, created.id)
  return created.id
}

async function writeRecord(tx: TxClient, rec: MilexRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: `SIPRI Military Expenditure — ${rec.country} (${rec.year})`,
      url: SOURCE_URL,
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `sipri_milex_source_${slugify(rec.country)}_${rec.year}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: buildClaimText(rec),
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: new Date(`${rec.year}-12-31T00:00:00Z`),
      claimEmergedPrecision: 'YEAR',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        country: rec.country,
        year: rec.year,
        valueMillionsUsd: rec.valueMillionsUsd,
        priceBasis: 'constant 2024 US$',
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
    data: { edgeId: edge.id, priorScore: null, newScore: 95, reason: 'SIPRI Military Expenditure Database — country-year spending as HARD_FACT', changedAt: new Date() },
  })

  await tx.claimTopic.upsert({
    where: { claimId_topicId: { claimId: claim.id, topicId } },
    update: {},
    create: { claimId: claim.id, topicId },
  })

  return 'ingested'
}

async function main() {
  const { dryRun } = parseArgs()
  console.log(`\n── Pipeline: SIPRI Military Expenditure (${INGESTED_BY}) ──`)
  console.log(`Mode: ${dryRun ? 'dry-run' : 'full'}`)
  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to enable DB writes.')
    process.exit(1)
  }

  console.log(`\nFetching: ${DATA_URL}`)
  const buf = await fetchXlsx()
  console.log(`  ${buf.length} bytes`)
  const wb = X.read(buf, { type: 'buffer' })
  const records = parseSheet(wb)
  console.log(`  Parsed ${records.length} country-year records`)

  if (dryRun) {
    const sample = records.slice(0, 15)
    const outFile = 'sipri-milex-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify({ total: records.length, sample }, null, 2))
    for (const r of sample) console.log(`  ${r.country} ${r.year}: $${Math.round(r.valueMillionsUsd)}m`)
    console.log(`\n  Written: ${outFile}`)
    await prisma.$disconnect()
    return
  }

  const topicId = await ensureTopic('military-expenditure', 'Military Expenditure', 'defense')
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  let n = 0
  for (const rec of records) {
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
    if (n % 500 === 0) console.log(`  Progress: ${n}/${records.length} — ingested=${counts.ingested}`)
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
