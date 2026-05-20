// Pipeline 61 — WTO Dispute Settlements (wto_disputes_v1)
// Source: WTO dispute_arrays_e.js (the authoritative JS data file powering the WTO
//         dispute pages at wto.org/english/tratop_e/dispu_e/cases_e/dsN_e.htm)
// Run: npx tsx scripts/ingest-wto-disputes.ts --dry-run
//      npx tsx scripts/ingest-wto-disputes.ts --sample 10
//      npx tsx scripts/ingest-wto-disputes.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'wto_disputes_v1'
const PIPELINE = 'Pipeline 61'
const WTO_CASE_BASE = 'https://www.wto.org/english/tratop_e/dispu_e/cases_e'
const WTO_DATA_URL = 'https://www.wto.org/library/disputes/dispute_arrays_e.js'
const REQUEST_DELAY_MS = 800

// ── Country code → WTO official name ──────────────────────────────────────────
// 71 codes used across all 645 WTO disputes as of 2026-05

const COUNTRY_NAMES: Record<string, string> = {
  ARE: 'United Arab Emirates',
  ARG: 'Argentina',
  ARM: 'Armenia',
  ATG: 'Antigua and Barbuda',
  AUS: 'Australia',
  BEL: 'Belgium',
  BGD: 'Bangladesh',
  BHR: 'Bahrain',
  BRA: 'Brazil',
  CAN: 'Canada',
  CHE: 'Switzerland',
  CHL: 'Chile',
  CHN: 'China',
  CHT: 'Chinese Taipei',
  COL: 'Colombia',
  CRI: 'Costa Rica',
  CUB: 'Cuba',
  CZE: 'Czech Republic',
  DNK: 'Denmark',
  DOM: 'Dominican Republic',
  ECU: 'Ecuador',
  EEC: 'European Communities',
  EGY: 'Egypt',
  FRA: 'France',
  GBR: 'United Kingdom',
  GRC: 'Greece',
  GTM: 'Guatemala',
  HKG: 'Hong Kong, China',
  HND: 'Honduras',
  HRV: 'Croatia',
  HUN: 'Hungary',
  IDN: 'Indonesia',
  IND: 'India',
  IRL: 'Ireland',
  JPN: 'Japan',
  KAZ: 'Kazakhstan',
  KGZ: 'Kyrgyz Republic',
  KOR: 'Korea, Republic of',
  LKA: 'Sri Lanka',
  MAR: 'Morocco',
  MDA: 'Moldova, Republic of',
  MEX: 'Mexico',
  MYS: 'Malaysia',
  NIC: 'Nicaragua',
  NLD: 'Netherlands',
  NOR: 'Norway',
  NZL: 'New Zealand',
  PAK: 'Pakistan',
  PAN: 'Panama',
  PER: 'Peru',
  PHL: 'Philippines',
  POL: 'Poland',
  PRT: 'Portugal',
  QAT: 'Qatar',
  ROM: 'Romania',
  RUS: 'Russian Federation',
  SAU: 'Saudi Arabia, Kingdom of',
  SGP: 'Singapore',
  SLV: 'El Salvador',
  SVK: 'Slovak Republic',
  SWE: 'Sweden',
  THA: 'Thailand',
  TTO: 'Trinidad and Tobago',
  TUN: 'Tunisia',
  TUR: 'Türkiye',
  UKR: 'Ukraine',
  URY: 'Uruguay',
  USA: 'United States',
  VEN: 'Venezuela',
  VNM: 'Viet Nam',
  ZAF: 'South Africa',
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  dsNumber: number
  title: string      // full title: "Respondent — Subject"
  complainant: string
  respondent: string
  subject: string
  date: string       // human-readable, e.g. "10 January 1995"
  consultationDate: Date
  externalId: string
  sourceExternalId: string
  sourceUrl: string
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ────────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const mode = args.includes('--dry-run') ? 'dry-run'
    : args.includes('--sample') ? 'sample'
    : args.includes('--full') ? 'full'
    : (() => {
        console.error('Usage: --dry-run | --sample N | --full  [--limit N] [--verbose]')
        process.exit(1) as never
      })()

  const li = args.indexOf('--limit')
  const sai = args.indexOf('--sample')

  return {
    mode: mode as 'dry-run' | 'sample' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '10', 10) || 10) : 10,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function httpsGet(url: string, timeoutMs: number): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url)
    const req = https.get(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        port: 443,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept': '*/*',
        },
        timeout: timeoutMs,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : `https://${parsed.hostname}${res.headers.location}`
          res.resume()
          httpsGet(nextUrl, timeoutMs).then(resolve).catch(reject)
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf-8') }))
        res.on('error', reject)
      }
    )
    req.on('error', reject)
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')) })
  })
}

// ── HTML entity decode (minimal, for short_title fields) ───────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&mdash;/gi, '—')
    .replace(/&#8212;/g, '—')
    .replace(/&rsquo;/gi, "'")
    .replace(/&lsquo;/gi, "'")
    .replace(/&rdquo;/gi, '"')
    .replace(/&ldquo;/gi, '"')
    .replace(/&amp;/gi, '&')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&uuml;/gi, 'ü')
    .replace(/&ouml;/gi, 'ö')
    .replace(/&auml;/gi, 'ä')
    .replace(/&eacute;/gi, 'é')
    .replace(/&egrave;/gi, 'è')
    .replace(/&ntilde;/gi, 'ñ')
    .replace(/&#\d+;/g, (m) => {
      const code = parseInt(m.slice(2, -1))
      return isNaN(code) ? m : String.fromCharCode(code)
    })
}

// ── Date formatting ────────────────────────────────────────────────────────────

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function parseIsoDate(dateStr: string): { date: Date; humanReadable: string } | null {
  // dateStr format: "YYYY/MM/DD"
  const m = dateStr.match(/^(\d{4})\/(\d{2})\/(\d{2})$/)
  if (!m) return null
  const year = parseInt(m[1])
  const month = parseInt(m[2]) - 1
  const day = parseInt(m[3])
  if (month < 0 || month > 11 || day < 1 || day > 31) return null
  const d = new Date(Date.UTC(year, month, day))
  if (isNaN(d.getTime())) return null
  return {
    date: d,
    humanReadable: `${day} ${MONTH_NAMES[month]} ${year}`,
  }
}

// ── Parse dispute_arrays_e.js ──────────────────────────────────────────────────

interface RawEntry {
  dsNumber: number
  title: string
  origin: string
  destination: string
  startDate: string
  shortTitle: string
}

function parseJsArray(js: string): RawEntry[] {
  const entries: RawEntry[] = []
  const entryRe = /ds_array\[(\d+)\]\s*=\s*\{([^}]+)\}/g
  let m: RegExpExecArray | null

  while ((m = entryRe.exec(js)) !== null) {
    const dsNumber = parseInt(m[1])
    const body = m[2]

    const field = (name: string) => {
      const fm = body.match(new RegExp(`${name}:\\s*"([^"]*)"`) )
      return fm ? fm[1] : ''
    }

    entries.push({
      dsNumber,
      title: field('title'),
      origin: field('origin'),
      destination: field('destination'),
      startDate: field('start_date'),
      shortTitle: field('short_title'),
    })
  }

  return entries.sort((a, b) => a.dsNumber - b.dsNumber)
}

function toCandidate(raw: RawEntry): CandidateRecord | null {
  if (!raw.origin || !raw.destination || !raw.startDate) return null
  if (!raw.title) return null

  const parsed = parseIsoDate(raw.startDate)
  if (!parsed) return null

  const complainant = COUNTRY_NAMES[raw.origin] ?? raw.origin
  const respondent = COUNTRY_NAMES[raw.destination] ?? raw.destination
  const subject = decodeEntities(raw.title).trim()
  if (!subject) return null

  // Build canonical title: "Respondent — Subject"
  // Prefer short_title if it clearly contains an em dash (use as the display title)
  // but always derive respondent/subject from the data fields
  const title = `${respondent} — ${subject}`

  return {
    dsNumber: raw.dsNumber,
    title,
    complainant,
    respondent,
    subject,
    date: parsed.humanReadable,
    consultationDate: parsed.date,
    externalId: `wto_ds_${raw.dsNumber}`,
    sourceExternalId: `src_wto_ds_${raw.dsNumber}`,
    sourceUrl: `${WTO_CASE_BASE}/ds${raw.dsNumber}_e.htm`,
  }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  console.log(`  Fetching ${WTO_DATA_URL}...`)
  let res: { status: number; body: string }
  let delay = 2000
  for (let attempt = 0; attempt <= 4; attempt++) {
    try {
      res = await httpsGet(WTO_DATA_URL, 60_000)
      if ([429, 502, 503, 504].includes(res.status) && attempt < 4) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      break
    } catch (err) {
      if (attempt >= 4) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }

  const rawEntries = parseJsArray(res!.body)
  console.log(`  Parsed ${rawEntries.length} entries from JS array`)

  const candidates: CandidateRecord[] = []
  let dropped = 0

  for (const raw of rawEntries) {
    if (limit > 0 && candidates.length >= limit) break
    const rec = toCandidate(raw)
    if (!rec) {
      dropped++
      if (verbose) console.log(`  DS${raw.dsNumber}: dropped (missing origin=${raw.origin} destination=${raw.destination} date=${raw.startDate} title=${!!raw.title})`)
    } else {
      candidates.push(rec)
      if (verbose) console.log(`  DS${raw.dsNumber}: ${rec.complainant} v ${rec.respondent} (${rec.date})`)
    }
  }

  console.log(`    ${candidates.length} valid | ${dropped} dropped (missing required fields)`)
  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }

  let parentTopicId: string | undefined
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    if (parent) parentTopicId = parent.id
    else console.warn(`  Parent topic ${parentSlug} not found — creating ${slug} without parent`)
  }

  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}${parentTopicId ? ` (parent: ${parentSlug})` : ''}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Write one record ───────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(tx: TxClient, rec: CandidateRecord, topicId: string): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  try {
    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: `WTO DS${rec.dsNumber}: ${rec.title.slice(0, 100)}`,
        url: rec.sourceUrl,
        publishedAt: rec.consultationDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    const claimText = `${rec.complainant} filed WTO dispute DS${rec.dsNumber} against ${rec.respondent} regarding ${rec.subject} on ${rec.date}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.consultationDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dsNumber: rec.dsNumber,
          title: rec.title,
          complainant: rec.complainant,
          respondent: rec.respondent,
          date: rec.date,
          pipeline: INGESTED_BY,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'FOR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })

    return 'ingested'
  } catch (err) {
    console.error(`  Error writing ${rec.externalId}: ${err}`)
    return 'failed'
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: WTO Dispute Settlements ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('wto-dispute-settlement', 'WTO Dispute Settlement', 'international', 'gov-region-international')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching WTO disputes from dispute_arrays_e.js...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 5).map(r => ({
      externalId: r.externalId,
      claimText: `${r.complainant} filed WTO dispute DS${r.dsNumber} against ${r.respondent} regarding ${r.subject} on ${r.date}.`,
      dsNumber: r.dsNumber,
      title: r.title,
      complainant: r.complainant,
      respondent: r.respondent,
      date: r.date,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byYear: Record<string, number> = {}
    for (const r of allCandidates) {
      const year = r.consultationDate.getUTCFullYear().toString()
      byYear[year] = (byYear[year] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byYear },
      sampleFirst5: sample,
    }

    fs.writeFileSync('pipeline-61-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-61-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by year:')
      for (const [k, v] of Object.entries(byYear).sort()) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nFirst 5 disputes:')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. DS${r.dsNumber} [${r.date}] ${r.complainant} v ${r.respondent}: ${r.subject.slice(0, 60)}${r.subject.length > 60 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample' ? allCandidates.slice(0, sampleN) : allCandidates

  console.log(`\nStep 3: Writing ${rows.length} rows to DB (batches of 50, txn timeout 30s)...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const BATCH = 50

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    try {
      await prisma.$transaction(async (tx) => {
        for (const row of batch) {
          const result = await writeRow(tx, row, topicId)
          if (result === 'ingested') counts.ingested++
          else if (result === 'skipped') counts.skipped++
          else counts.errors++
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 70)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}-${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }

    if (!verbose) {
      const done = Math.min(i + BATCH, rows.length)
      process.stdout.write(`  ${done}/${rows.length} processed...\r`)
    }

    if (i + BATCH < rows.length) await sleep(REQUEST_DELAY_MS)
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

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
