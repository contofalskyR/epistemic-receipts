// DOJ FARA Foreign Agent Registrations ingester (doj_fara_v1)
// Source: efile.fara.gov bulk CSV (FARA_All_ForeignPrincipals.csv.zip)
// Scope: Active foreign-agent registrations from the DOJ FARA e-filing system.
//        One claim per registrant–foreign-principal pair.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-doj-fara.ts --dry-run
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-doj-fara.ts --full [--limit N] [--all]
//
// Flags:
//   --dry-run   Parse and preview without writing to DB
//   --full      Write to DB (requires ALLOW_EDITS=true)
//   --limit N   Cap records processed (default: all)
//   --all       Include terminated registrations (default: active only)

import { execSync } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const PIPELINE = 'doj_fara_v1'
const BULK_URL = 'https://efile.fara.gov/bulk/zip/FARA_All_ForeignPrincipals.csv.zip'
const TX_TIMEOUT_MS = 30_000
const TAGS = ['foreign-lobbying', 'doj', 'fara']

// ── Arg parsing ───────────────────────────────────────────────────────────────

interface Args {
  dryRun: boolean
  limit: number
  activeOnly: boolean
}

function parseArgs(): Args {
  const argv = process.argv.slice(2)
  let dryRun = false
  let limit = Number.MAX_SAFE_INTEGER
  let activeOnly = true
  let hasMode = false

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') {
      dryRun = true
      hasMode = true
    } else if (a === '--full') {
      hasMode = true
    } else if (a === '--limit' && argv[i + 1]) {
      const n = parseInt(argv[++i], 10)
      if (!isNaN(n) && n > 0) limit = n
    } else if (a === '--all') {
      activeOnly = false
    }
  }

  if (!hasMode) {
    console.error('Usage: --dry-run | --full [--limit N] [--all]')
    process.exit(1)
  }

  if (!dryRun && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true in environment')
    process.exit(1)
  }

  return { dryRun, limit, activeOnly }
}

// ── Data download & parse ─────────────────────────────────────────────────────

interface FaraRow {
  termDate: string
  fpName: string
  fpRegDate: string
  country: string
  regNumber: string
  regDate: string
  registrantName: string
  address1: string
  address2: string
  city: string
  state: string
  zip: string
}

async function downloadAndParseCSV(): Promise<FaraRow[]> {
  const zipPath = '/tmp/doj-fara-fp.zip'
  const extractDir = '/tmp/doj-fara-extract'

  if (!fs.existsSync(zipPath)) {
    console.log(`  Downloading bulk CSV from ${BULK_URL} ...`)
    const res = await fetch(BULK_URL)
    if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`)
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(zipPath, buf)
    console.log(`  Downloaded ${(buf.length / 1024).toFixed(0)} KB`)
  } else {
    console.log(`  Using cached zip at ${zipPath}`)
  }

  console.log('  Extracting zip ...')
  fs.mkdirSync(extractDir, { recursive: true })
  execSync(`unzip -o "${zipPath}" -d "${extractDir}"`, { stdio: 'pipe' })

  const csvPath = path.join(extractDir, 'FARA_All_ForeignPrincipals.csv')
  if (!fs.existsSync(csvPath)) {
    throw new Error(`CSV not found at ${csvPath} — zip contents may have changed`)
  }

  // FARA CSV is iso-8859-1 encoded with malformed inner quotes — use Python's
  // lenient csv module (which handles unescaped embedded quotes correctly) to
  // convert to JSON, then parse the JSON in Node.
  const jsonPath = '/tmp/doj-fara-fp.json'
  execSync(
    `python3 -c "
import csv, json, sys
rows = []
with open('${csvPath}', encoding='latin1') as f:
    for r in csv.DictReader(f):
        rows.append({k.strip(): (v.strip() if v else '') for k, v in r.items() if k})
with open('${jsonPath}', 'w') as out:
    json.dump(rows, out)
"`,
    { stdio: 'pipe' }
  )
  const records = JSON.parse(fs.readFileSync(jsonPath, 'utf8')) as Record<string, string>[]

  return records.map(r => ({
    termDate: r['Foreign Principal Termination Date'] ?? '',
    fpName: r['Foreign Principal'] ?? '',
    fpRegDate: r['Foreign Principal Registration Date'] ?? '',
    country: r['Country/Location Represented'] ?? '',
    regNumber: r['Registration Number'] ?? '',
    regDate: r['Registrant Date'] ?? '',
    registrantName: r['Registrant Name'] ?? '',
    address1: r['Address 1'] ?? '',
    address2: r['Address 2'] ?? '',
    city: r['City'] ?? '',
    state: r['State'] ?? '',
    zip: r['Zip'] ?? '',
  }))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}

function parseFaraDate(s: string): Date | null {
  if (!s || !s.trim()) return null
  // Format: MM/DD/YYYY
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s.trim())
  if (!m) return null
  return new Date(Date.UTC(parseInt(m[3]), parseInt(m[1]) - 1, parseInt(m[2])))
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    topicCache.set(slug, existing.id)
    return existing.id
  }
  const created = await prisma.topic.create({ data: { slug, name, domain } })
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one claim ───────────────────────────────────────────────────────────

type WriteResult = 'ingested' | 'updated' | 'skipped' | 'failed'

async function writeRow(row: FaraRow, topicId: string): Promise<WriteResult> {
  if (!row.registrantName || !row.fpName || !row.regNumber) return 'skipped'

  const externalId = `doj_fara_${row.regNumber}_${slugify(row.fpName)}`
  const country = row.country ? ` (${row.country})` : ''
  const claimText = `${row.registrantName} is registered as a foreign agent for ${row.fpName}${country}`
  const sourceUrl = `https://efile.fara.gov/api/v1/RegDocs/html/${row.regNumber}`

  const publishedAt = parseFaraDate(row.fpRegDate) ?? parseFaraDate(row.regDate)

  const existingClaim = await prisma.claim.findUnique({ where: { externalId }, select: { id: true } })
  const action: WriteResult = existingClaim ? 'updated' : 'ingested'

  await prisma.$transaction(async tx => {
    const source = await tx.source.upsert({
      where: { externalId },
      update: {
        name: `DOJ FARA Registration — ${row.registrantName}`,
        url: sourceUrl,
        publishedAt,
      },
      create: {
        externalId,
        name: `DOJ FARA Registration — ${row.registrantName}`,
        url: sourceUrl,
        publishedAt,
        methodologyType: 'primary',
        ingestedBy: PIPELINE,
        humanReviewed: false,
        autoApproved: false,
      },
    })

    const claim = await tx.claim.upsert({
      where: { externalId },
      update: {
        text: claimText,
        claimEmergedAt: publishedAt ?? undefined,
        claimEmergedPrecision: publishedAt ? 'DAY' : undefined,
        metadata: {
          dataset: PIPELINE,
          tags: TAGS,
          registration_number: row.regNumber,
          registrant_name: row.registrantName,
          foreign_principal: row.fpName,
          country: row.country,
          fp_reg_date: row.fpRegDate,
          registrant_date: row.regDate,
          city: row.city || null,
          state: row.state || null,
          active: !row.termDate,
          termination_date: row.termDate || null,
        },
      },
      create: {
        externalId,
        text: claimText,
        claimType: 'EMPIRICAL',
        currentStatus: 'VERIFIED',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: publishedAt ?? undefined,
        claimEmergedPrecision: publishedAt ? 'DAY' : undefined,
        ingestedBy: PIPELINE,
        humanReviewed: false,
        autoApproved: false,
        metadata: {
          dataset: PIPELINE,
          tags: TAGS,
          registration_number: row.regNumber,
          registrant_name: row.registrantName,
          foreign_principal: row.fpName,
          country: row.country,
          fp_reg_date: row.fpRegDate,
          registrant_date: row.regDate,
          city: row.city || null,
          state: row.state || null,
          active: !row.termDate,
          termination_date: row.termDate || null,
        },
      },
    })

    const existingEdge = await tx.edge.findFirst({
      where: { claimId: claim.id, sourceId: source.id, type: 'FOR' },
      select: { id: true },
    })
    if (!existingEdge) {
      await tx.edge.create({
        data: {
          claimId: claim.id,
          sourceId: source.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: PIPELINE,
          humanReviewed: false,
          autoApproved: false,
        },
      })
    }

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }, { timeout: TX_TIMEOUT_MS })

  return action
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()
  console.log('\n=== DOJ FARA ingestion ===')
  console.log(`  Pipeline : ${PIPELINE}`)
  console.log(`  Mode     : ${args.dryRun ? 'dry-run' : 'full'}`)
  console.log(`  Scope    : ${args.activeOnly ? 'active only' : 'all (active + terminated)'}`)
  if (args.limit < Number.MAX_SAFE_INTEGER) console.log(`  Limit    : ${args.limit}`)

  console.log('\nFetching bulk data...')
  const allRows = await downloadAndParseCSV()
  console.log(`  Total rows in CSV: ${allRows.length}`)

  const activeRows = allRows.filter(r => !r.termDate)
  const terminatedRows = allRows.filter(r => r.termDate)
  console.log(`  Active: ${activeRows.length} | Terminated: ${terminatedRows.length}`)

  const pool = args.activeOnly ? activeRows : allRows
  const validPool = pool.filter(r => r.fpName && r.registrantName && r.regNumber)
  const batch = validPool.slice(0, args.limit)
  console.log(`  Processing: ${batch.length} valid records`)

  if (args.dryRun) {
    console.log('\n── Dry-run sample (first 10) ──')
    for (const row of batch.slice(0, 10)) {
      const country = row.country ? ` (${row.country})` : ''
      const externalId = `doj_fara_${row.regNumber}_${slugify(row.fpName)}`
      console.log(`  [${row.regNumber}] ${row.registrantName} → ${row.fpName}${country}`)
      console.log(`         externalId : ${externalId}`)
      console.log(`         date       : ${row.fpRegDate || row.regDate || 'n/a'}`)
    }
    console.log(`\nDry-run complete — ${batch.length} records would be ingested`)
    await prisma.$disconnect()
    return
  }

  // Full run
  const topicId = await ensureTopic('foreign-lobbying', 'Foreign Lobbying', 'government')

  let ingested = 0
  let updated = 0
  let skipped = 0
  let failed = 0
  let firstClaimText: string | null = null

  for (let i = 0; i < batch.length; i++) {
    const row = batch[i]
    try {
      const result = await writeRow(row, topicId)
      if (result === 'ingested') {
        ingested++
        if (!firstClaimText) {
          const country = row.country ? ` (${row.country})` : ''
          firstClaimText = `${row.registrantName} is registered as a foreign agent for ${row.fpName}${country}`
        }
      } else if (result === 'updated') {
        updated++
      } else if (result === 'skipped') {
        skipped++
      }
    } catch (err) {
      failed++
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed [${row.regNumber}] ${row.fpName}: ${msg}`)
    }

    if ((i + 1) % 50 === 0) {
      console.log(
        `  Progress: ${i + 1}/${batch.length}` +
        ` (ingested=${ingested} updated=${updated} skipped=${skipped} failed=${failed})`
      )
    }
  }

  const total = ingested + updated
  console.log('\n=== Summary ===')
  console.log(`  Ingested: ${ingested}`)
  console.log(`  Updated : ${updated}`)
  console.log(`  Skipped : ${skipped}`)
  console.log(`  Failed  : ${failed}`)
  if (firstClaimText) console.log(`  Sample  : "${firstClaimText}"`)

  // Verify against DB
  const dbCount = await prisma.claim.count({ where: { ingestedBy: PIPELINE, deleted: false } })
  console.log(`\n  DB count (${PIPELINE}): ${dbCount} claims`)

  await prisma.$disconnect()
  return { total, firstClaimText }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
