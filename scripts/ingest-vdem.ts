// Pipeline — V-Dem (Varieties of Democracy) Country-Year Core dataset
// Dataset: V-Dem v16 Country-Year Core (https://v-dem.net/data/the-v-dem-dataset/)
// Source CSV: V-Dem-CY-Core-v16.csv (212MB, 28k rows × 1908 columns), extracted from
//             https://v-dem.net/media/datasets/V-Dem-CY-Core-v16_csv.zip
// Pipeline tag: vdem_v1
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-vdem.ts --dry-run
//   ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-vdem.ts --full
//   Optional: --csv <path> to use a pre-extracted CSV; --year-min 1900 (default); --limit N
// After ingestion the script links each V-Dem claim to overlapping Polity rows
// (countryCode + year-in-range). Skip the linker step with --no-link.

import 'dotenv/config'
import { PrismaClient, Prisma } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'
import { execFileSync } from 'child_process'
import { parse as csvParse } from 'csv-parse'

const prisma = new PrismaClient()

const INGESTED_BY = 'vdem_v1'
const DATASET_URL = 'https://v-dem.net/media/datasets/V-Dem-CY-Core-v16_csv.zip'
const DATASET_PAGE_URL = 'https://v-dem.net/data/the-v-dem-dataset/country-year-v-dem-core-v16/'
const CACHE_DIR = path.join(process.cwd(), '.cache', 'vdem')
const DEFAULT_CSV_PATH = path.join(CACHE_DIR, 'V-Dem-CY-Core-v16.csv')
const DEFAULT_ZIP_PATH = path.join(CACHE_DIR, 'V-Dem-CY-Core-v16_csv.zip')
const SAMPLE_LIMIT = 15

// ── Args ──────────────────────────────────────────────────────────────────────

interface Args {
  mode: 'dry-run' | 'full'
  csvPath: string
  yearMin: number
  yearMax: number
  limit: number
  link: boolean
  verbose: boolean
}

function parseArgs(): Args {
  const a = process.argv.slice(2)
  const mode = a.includes('--full') ? 'full' : a.includes('--dry-run') ? 'dry-run' : null
  if (!mode) {
    console.error('Usage: --dry-run | --full [--csv path] [--year-min 1900] [--year-max <year>] [--limit N] [--no-link] [--verbose]')
    process.exit(1)
  }
  const csvIdx = a.indexOf('--csv')
  const yMinIdx = a.indexOf('--year-min')
  const yMaxIdx = a.indexOf('--year-max')
  const limIdx = a.indexOf('--limit')
  return {
    mode: mode as 'dry-run' | 'full',
    csvPath: csvIdx !== -1 ? a[csvIdx + 1] : DEFAULT_CSV_PATH,
    yearMin: yMinIdx !== -1 ? parseInt(a[yMinIdx + 1], 10) : 1900,
    yearMax: yMaxIdx !== -1 ? parseInt(a[yMaxIdx + 1], 10) : new Date().getUTCFullYear(),
    limit: limIdx !== -1 ? parseInt(a[limIdx + 1], 10) || 0 : 0,
    link: !a.includes('--no-link'),
    verbose: a.includes('--verbose'),
  }
}

// ── Download + extract ────────────────────────────────────────────────────────

async function ensureCsv(csvPath: string): Promise<void> {
  if (fs.existsSync(csvPath) && fs.statSync(csvPath).size > 1_000_000) return
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  if (!fs.existsSync(DEFAULT_ZIP_PATH) || fs.statSync(DEFAULT_ZIP_PATH).size < 1_000_000) {
    console.log(`  Downloading ${DATASET_URL}...`)
    const res = await fetch(DATASET_URL)
    if (!res.ok) throw new Error(`V-Dem zip download failed: ${res.status} ${res.statusText}`)
    const buf = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(DEFAULT_ZIP_PATH, buf)
    console.log(`  Saved ${(buf.length / 1e6).toFixed(1)} MB to ${DEFAULT_ZIP_PATH}`)
  }
  console.log(`  Extracting CSV via system unzip...`)
  execFileSync('unzip', ['-o', '-d', CACHE_DIR, DEFAULT_ZIP_PATH, 'V-Dem-CY-Core-v16.csv'], { stdio: 'inherit' })
  if (!fs.existsSync(csvPath)) throw new Error(`unzip succeeded but CSV missing at ${csvPath}`)
}

// ── Streaming CSV parse ──────────────────────────────────────────────────────

interface VdemRow {
  countryName: string
  countryCode: string  // alpha-3 (V-Dem country_text_id)
  year: number
  polyarchy: number | null
  libdem: number | null
  partipdem: number | null
  egaldem: number | null
  delibdem: number | null
}

function nullOrFloat(v: string | undefined): number | null {
  if (v === undefined || v === '' || v === 'NA') return null
  const f = parseFloat(v)
  return Number.isFinite(f) ? f : null
}

async function readVdemRows(csvPath: string, yearMin: number, yearMax: number): Promise<VdemRow[]> {
  console.log(`  Parsing ${csvPath} (yearMin=${yearMin}, yearMax=${yearMax})...`)
  const rows: VdemRow[] = []
  const stream = fs.createReadStream(csvPath)
  const parser = stream.pipe(csvParse({
    columns: true,
    skip_empty_lines: true,
    relax_quotes: true,
    trim: true,
  }))
  let rawSeen = 0
  let droppedNullAll = 0
  let droppedYear = 0
  for await (const record of parser as AsyncIterable<Record<string, string>>) {
    rawSeen++
    const year = parseInt(record.year, 10)
    if (!Number.isFinite(year) || year < yearMin || year > yearMax) { droppedYear++; continue }
    const polyarchy = nullOrFloat(record.v2x_polyarchy)
    const libdem = nullOrFloat(record.v2x_libdem)
    const partipdem = nullOrFloat(record.v2x_partipdem)
    const egaldem = nullOrFloat(record.v2x_egaldem)
    const delibdem = nullOrFloat(record.v2x_delibdem)
    if (polyarchy === null && libdem === null && partipdem === null && egaldem === null && delibdem === null) {
      droppedNullAll++
      continue
    }
    const countryCode = (record.country_text_id || '').trim()
    const countryName = (record.country_name || '').trim()
    if (!countryCode || !countryName) continue
    rows.push({ countryName, countryCode, year, polyarchy, libdem, partipdem, egaldem, delibdem })
  }
  console.log(`  Raw rows: ${rawSeen} | dropped (year window): ${droppedYear} | dropped (all-null): ${droppedNullAll} | kept: ${rows.length}`)
  return rows
}

// ── Build candidate records ──────────────────────────────────────────────────

function fmt(v: number | null): string {
  return v === null ? 'NA' : v.toFixed(3)
}

interface Candidate {
  externalId: string
  text: string
  countryCode: string
  countryName: string
  year: number
  claimDate: Date
  metadata: Record<string, unknown>
}

function buildCandidates(rows: VdemRow[]): Candidate[] {
  return rows.map(r => {
    const title = `${r.countryName} electoral democracy score: ${fmt(r.polyarchy)} (${r.year})`
    const body = `V-Dem electoral democracy index: ${fmt(r.polyarchy)}. Liberal democracy: ${fmt(r.libdem)}. Participatory: ${fmt(r.partipdem)}.`
    return {
      externalId: `vdem_${r.countryCode}_${r.year}`,
      text: `${title}. ${body}`,
      countryCode: r.countryCode,
      countryName: r.countryName,
      year: r.year,
      claimDate: new Date(Date.UTC(r.year, 0, 1)),
      metadata: {
        dataset: INGESTED_BY,
        polyarchy: r.polyarchy,
        libdem: r.libdem,
        partipdem: r.partipdem,
        egaldem: r.egaldem,
        delibdem: r.delibdem,
        year: r.year,
        countryCode: r.countryCode,
        countryName: r.countryName,
      },
    }
  })
}

// ── Topic + Source bootstrap ─────────────────────────────────────────────────

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  const existing = await prisma.topic.findUnique({ where: { slug }, select: { id: true } })
  if (existing) return existing.id
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug }, select: { id: true } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  return created.id
}

async function ensureVdemSource(): Promise<string> {
  const externalId = `vdem_source_v16`
  const existing = await prisma.source.findUnique({ where: { externalId }, select: { id: true } })
  if (existing) return existing.id
  const source = await prisma.source.create({
    data: {
      name: 'V-Dem Country-Year Core v16',
      url: DATASET_PAGE_URL,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId,
    },
  })
  console.log(`  Created source: ${source.id}`)
  return source.id
}

// ── Write one Claim + Edge + EdgeRevision + ClaimTopic rows ──────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
type IngestResult = 'ingested' | 'skipped'

async function writeRow(tx: TxClient, c: Candidate, sourceId: string, topicIds: string[]): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: c.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const claim = await tx.claim.create({
    data: {
      text: c.text,
      claimType: 'EMPIRICAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: c.claimDate,
      claimEmergedPrecision: 'YEAR',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: c.externalId,
      metadata: c.metadata as Prisma.InputJsonValue,
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId,
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
      newScore: 85,
      reason: 'V-Dem v16 Country-Year Core — expert-coded democracy indicators',
      changedAt: c.claimDate,
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

// ── Polity linker ────────────────────────────────────────────────────────────
// PolityClaim is the schema-native Polity↔Claim bridge. We use matchMethod
// "auto_country_year_vdem" so this run is distinguishable from the legislative
// linker that uses "auto_country_date".

interface PolityIndex {
  byCountry: Map<string, { id: string; startYear: number | null; endYear: number | null }[]>
}

async function loadPolityIndex(): Promise<PolityIndex> {
  const polities = await prisma.polity.findMany({
    where: { countryCode: { not: null } },
    select: { id: true, countryCode: true, startYear: true, endYear: true },
  })
  const byCountry = new Map<string, { id: string; startYear: number | null; endYear: number | null }[]>()
  for (const p of polities) {
    if (!p.countryCode) continue
    const arr = byCountry.get(p.countryCode) ?? []
    arr.push({ id: p.id, startYear: p.startYear, endYear: p.endYear })
    byCountry.set(p.countryCode, arr)
  }
  return { byCountry }
}

function polityCovers(p: { startYear: number | null; endYear: number | null }, year: number): boolean {
  if (p.startYear !== null && year < p.startYear) return false
  if (p.endYear !== null && year > p.endYear) return false
  return true
}

async function linkVdemToPolities(verbose: boolean): Promise<{ checked: number; created: number; alreadyLinked: number; noPolity: number }> {
  console.log('\nLinker: V-Dem claims → Polity records (matchMethod=auto_country_year_vdem)')
  const index = await loadPolityIndex()
  console.log(`  Loaded ${[...index.byCountry.values()].reduce((s, a) => s + a.length, 0)} polities across ${index.byCountry.size} country codes`)

  const counts = { checked: 0, created: 0, alreadyLinked: 0, noPolity: 0 }
  const BATCH = 1000
  let cursor: string | undefined = undefined
  while (true) {
    const findArgs: Prisma.ClaimFindManyArgs = {
      where: { ingestedBy: INGESTED_BY, deleted: false },
      select: { id: true, metadata: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }
    const claims = await prisma.claim.findMany(findArgs) as { id: string; metadata: Prisma.JsonValue }[]
    if (claims.length === 0) break
    cursor = claims[claims.length - 1].id

    for (const claim of claims) {
      counts.checked++
      const meta = claim.metadata as { countryCode?: string; year?: number } | null
      const countryCode = meta?.countryCode
      const year = meta?.year
      if (!countryCode || typeof year !== 'number') continue
      const polities = index.byCountry.get(countryCode)
      if (!polities || polities.length === 0) { counts.noPolity++; continue }
      const matches = polities.filter(p => polityCovers(p, year))
      if (matches.length === 0) { counts.noPolity++; continue }

      for (const p of matches) {
        try {
          await prisma.polityClaim.upsert({
            where: { polityId_claimId: { polityId: p.id, claimId: claim.id } },
            update: {},
            create: { polityId: p.id, claimId: claim.id, matchMethod: 'auto_country_year_vdem' },
          })
          counts.created++
        } catch {
          counts.alreadyLinked++
        }
      }
    }
    if (verbose || counts.checked % 5000 === 0) {
      console.log(`  Linker progress: ${counts.checked} claims | ${counts.created} links | ${counts.noPolity} unmatched`)
    }
  }
  return counts
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs()
  console.log(`\n── V-Dem Country-Year Core v16 ingester ───────────────────────────────`)
  console.log(`Mode: ${args.mode} | Tag: ${INGESTED_BY} | CSV: ${args.csvPath}`)
  console.log(`Window: ${args.yearMin}–${args.yearMax} | Limit: ${args.limit || 'all'} | Linker: ${args.link ? 'yes' : 'no'}`)

  if (args.mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  console.log('\nStep 1: Ensure CSV available...')
  await ensureCsv(args.csvPath)

  console.log('\nStep 2: Parse + filter rows...')
  const rows = await readVdemRows(args.csvPath, args.yearMin, args.yearMax)
  const allCandidates = buildCandidates(rows)
  const candidates = args.limit > 0 ? allCandidates.slice(0, args.limit) : allCandidates
  console.log(`  Candidate claims: ${candidates.length}`)

  // Top countries by row count
  const byCountry = new Map<string, number>()
  for (const c of candidates) byCountry.set(c.countryCode, (byCountry.get(c.countryCode) ?? 0) + 1)
  const topCountries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  console.log(`  Distinct countries: ${byCountry.size}`)
  console.log(`  Top 10 by row count: ${topCountries.map(([c, n]) => `${c}=${n}`).join(', ')}`)

  if (args.mode === 'dry-run') {
    const sample = candidates.slice(0, SAMPLE_LIMIT)
    console.log(`\nSample (first ${SAMPLE_LIMIT}):`)
    for (const c of sample) console.log(`  [${c.countryCode} ${c.year}] ${c.text}`)
    const out = {
      runDate: new Date().toISOString(),
      window: { yearMin: args.yearMin, yearMax: args.yearMax },
      totalCandidates: candidates.length,
      distinctCountries: byCountry.size,
      topCountries: Object.fromEntries(topCountries),
      sample: sample.map(s => ({ externalId: s.externalId, text: s.text, metadata: s.metadata })),
    }
    const outPath = path.join(CACHE_DIR, 'vdem-dry-run-sample.json')
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2))
    console.log(`\n  Written: ${outPath}`)
    console.log('\nDry-run complete.')
    return
  }

  console.log('\nStep 3: Ensure topic + source rows...')
  const rootTopicId = await ensureTopic('vdem', 'V-Dem (Varieties of Democracy)', 'government')
  const childTopicId = await ensureTopic('democracy-indicators', 'Democracy Indicators', 'government', 'vdem')
  const sourceId = await ensureVdemSource()
  const topicIds = [rootTopicId, childTopicId]

  console.log(`\nStep 4: Ingest ${candidates.length} claims...`)
  const startTime = Date.now()
  const counts = { ingested: 0, skipped: 0, errors: 0 }
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]
    try {
      const result = await prisma.$transaction(
        async tx => writeRow(tx, c, sourceId, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else counts.skipped++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed ${c.externalId}: ${msg}`)
      counts.errors++
    }
    if (args.verbose || (i + 1) % 500 === 0) {
      const pct = (((i + 1) / candidates.length) * 100).toFixed(1)
      console.log(`  Progress ${i + 1}/${candidates.length} (${pct}%) — ingested:${counts.ingested} skipped:${counts.skipped} errors:${counts.errors}`)
    }
  }
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${counts.ingested} | Skipped: ${counts.skipped} | Errors: ${counts.errors}`)

  console.log('\nStep 5: Verify DB state...')
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbEdges = await prisma.edge.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Claims:  ${dbClaims}`)
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Edges:   ${dbEdges}`)

  let linkCount = 0
  if (args.link) {
    const linkCounts = await linkVdemToPolities(args.verbose)
    console.log(`\nLinker complete`)
    console.log(`  Claims checked:  ${linkCounts.checked}`)
    console.log(`  Links created:   ${linkCounts.created}`)
    console.log(`  Already linked:  ${linkCounts.alreadyLinked}`)
    console.log(`  No matching polity: ${linkCounts.noPolity}`)
    const dbPolityClaims = await prisma.polityClaim.count({ where: { matchMethod: 'auto_country_year_vdem' } })
    console.log(`  DB PolityClaim (vdem matchMethod): ${dbPolityClaims}`)
    linkCount = dbPolityClaims
  }

  console.log('\nDone.')
  console.log(`SUMMARY: ${dbClaims} claims, ${linkCount} polity links`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
