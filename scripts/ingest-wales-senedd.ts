// Pipeline 58 — Welsh Parliament Enacted Legislation (wales_senedd_v1)
// Dataset: legislation.gov.uk (free, no API key required)
// Scope: All three categories of Welsh devolved primary legislation:
//   anaw — Acts of the National Assembly for Wales (2012–2020)
//   asc  — Acts of Senedd Cymru (2020–present)
//   mwa  — Measures of the National Assembly for Wales (2008–2012)
// Uses the data.csv endpoint which includes both English and Welsh titles.
// Run: npx tsx scripts/ingest-wales-senedd.ts --dry-run
//      npx tsx scripts/ingest-wales-senedd.ts --sample 10
//      npx tsx scripts/ingest-wales-senedd.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'wales_senedd_v1'
const PIPELINE = 'Pipeline 58'
const PAGE_DELAY_MS = 500
const LEG_BASE = 'https://www.legislation.gov.uk'

const ACT_TYPES = [
  { type: 'anaw', label: 'Acts of the National Assembly for Wales', shortType: 'ANAW' },
  { type: 'asc',  label: 'Acts of Senedd Cymru',                    shortType: 'ASC'  },
  { type: 'mwa',  label: 'Measures of the National Assembly for Wales', shortType: 'MWA' },
]

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  actType: string
  shortType: string
  year: string
  number: string
  title: string
  titleWelsh: string | null
  enactedDate: Date
  enactedDateStr: string
  externalId: string
  sourceExternalId: string
  sourceUrl: string
  sourceName: string
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
          'Accept': 'text/csv, */*',
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

async function fetchCsv(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, 30_000)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status} for ${url}`)
      return res.body
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── CSV parsing ────────────────────────────────────────────────────────────────
// Simple CSV parser that handles quoted fields with embedded commas/newlines.

function parseCsvRow(line: string): string[] {
  const fields: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++ }
      else inQuote = !inQuote
    } else if (ch === ',' && !inQuote) {
      fields.push(cur)
      cur = ''
    } else {
      cur += ch
    }
  }
  fields.push(cur)
  return fields
}

function parseCsvLines(csv: string): string[][] {
  const lines: string[][] = []
  const rawLines = csv.split('\n')
  let buf = ''
  let inQuote = false
  for (const raw of rawLines) {
    buf += (buf ? '\n' : '') + raw
    for (const ch of raw) {
      if (ch === '"') inQuote = !inQuote
    }
    if (!inQuote) {
      const trimmed = buf.trim()
      if (trimmed) lines.push(parseCsvRow(trimmed))
      buf = ''
    }
  }
  return lines
}

// ── Title splitting ────────────────────────────────────────────────────────────
// Wales Acts have bilingual titles: "English Title / Teitl Cymraeg"
// Some are English-only. Split on " / " and take the English part.

function splitBilingualTitle(raw: string): { en: string; cy: string | null } {
  const idx = raw.lastIndexOf(' / ')
  if (idx === -1) return { en: raw.trim(), cy: null }
  return {
    en: raw.slice(0, idx).trim(),
    cy: raw.slice(idx + 3).trim() || null,
  }
}

// ── Fetch candidates for one act type ─────────────────────────────────────────

async function fetchTypeRecords(
  actType: string,
  shortType: string,
  verbose: boolean,
): Promise<CandidateRecord[]> {
  // Paginate through all CSV pages (20 records per page)
  let page = 1
  let allCsv = ''
  let headerRow = ''
  while (true) {
    const url = page === 1
      ? `${LEG_BASE}/${actType}/data.csv`
      : `${LEG_BASE}/${actType}/data.csv?page=${page}`
    if (verbose) console.log(`  Fetching ${url}...`)
    const csv = await fetchCsv(url)
    const lines = csv.split('\n')
    if (page === 1) {
      headerRow = lines[0] ?? ''
      allCsv = csv
    } else {
      // Skip header row on subsequent pages
      const dataLines = lines.slice(1).join('\n')
      if (!dataLines.trim()) break
      allCsv += '\n' + dataLines
    }
    // Check if there are more pages: if this page returned only a header + no data rows, stop
    const dataCount = lines.slice(1).filter(l => l.trim()).length
    if (dataCount === 0) break
    // Check if this looks like a full page (20 rows) — if fewer, we're on the last page
    if (dataCount < 20) break
    page++
    await sleep(PAGE_DELAY_MS)
  }
  const csv = allCsv

  const lines = parseCsvLines(csv)
  if (lines.length < 2) {
    console.warn(`  No data rows for ${actType}`)
    return []
  }

  const headers = lines[0].map(h => h.trim())
  const idxId        = headers.indexOf('ID')
  const idxTitle     = headers.indexOf('TITLE')
  const idxYear      = headers.indexOf('YEAR')
  const idxNumber    = headers.indexOf('NUMBER')
  const idxCreation  = headers.indexOf('CreationDate')
  const idxPublished = headers.indexOf('PUBLISHED')

  const candidates: CandidateRecord[] = []
  let malformed = 0

  for (const row of lines.slice(1)) {
    if (row.length < 2) continue

    const rawId    = (idxId    >= 0 ? row[idxId]        : '') ?? ''
    const rawTitle = (idxTitle >= 0 ? row[idxTitle]     : '') ?? ''
    const year     = (idxYear  >= 0 ? row[idxYear]      : '') ?? ''
    const number   = (idxNumber >= 0 ? row[idxNumber]   : '') ?? ''
    const creation = (idxCreation >= 0 ? row[idxCreation] : '') ?? ''
    const published = (idxPublished >= 0 ? row[idxPublished] : '') ?? ''

    if (!rawTitle || !year || !number) { malformed++; continue }

    const { en: titleEn, cy: titleCy } = splitBilingualTitle(rawTitle)
    if (!titleEn) { malformed++; continue }

    const rawDate = creation?.slice(0, 10) || published?.slice(0, 10) || ''
    const dateStr = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : `${year}-01-01`
    const enactedDate = new Date(dateStr + 'T00:00:00Z')
    if (isNaN(enactedDate.getTime())) { malformed++; continue }

    // Extract canonical URL from ID: http://www.legislation.gov.uk/id/anaw/2020/3
    // → https://www.legislation.gov.uk/anaw/2020/3
    const sourceUrl = rawId
      ? rawId.replace('http://', 'https://').replace('/id/', '/') + '/enacted'
      : `${LEG_BASE}/${actType}/${year}/${number}/enacted`

    candidates.push({
      actType,
      shortType,
      year,
      number,
      title: titleEn,
      titleWelsh: titleCy,
      enactedDate,
      enactedDateStr: dateStr,
      externalId: `wales_${actType}_${year}_${number}`,
      sourceExternalId: `wales_src_${actType}_${year}_${number}`,
      sourceUrl,
      sourceName: `${shortType} ${year}/${number} — ${titleEn.slice(0, 60)}`,
    })
  }

  if (verbose) console.log(`    ${candidates.length} candidates (${malformed} malformed dropped)`)
  return candidates
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const all: CandidateRecord[] = []
  for (let i = 0; i < ACT_TYPES.length; i++) {
    const { type, shortType } = ACT_TYPES[i]
    console.log(`  Fetching ${type}...`)
    const recs = await fetchTypeRecords(type, shortType, verbose)
    console.log(`    ${recs.length} records for ${type}`)
    all.push(...recs)
    if (i < ACT_TYPES.length - 1) await sleep(PAGE_DELAY_MS)
    if (limit > 0 && all.length >= limit) break
  }
  all.sort((a, b) => b.enactedDateStr.localeCompare(a.enactedDateStr))
  return limit > 0 ? all.slice(0, limit) : all
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
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: rec.enactedDateStr.endsWith('-01-01') ? 'YEAR' : 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          actType: rec.actType,
          actTypeLabel: rec.shortType,
          year: rec.year,
          number: rec.number,
          titleWelsh: rec.titleWelsh,
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
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

  console.log(`\n── ${PIPELINE}: Welsh Parliament Enacted Legislation ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('wales-senedd', 'Welsh Parliament (Senedd)', 'government', 'gov-region-europe')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Wales legislation from legislation.gov.uk...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      title: r.title,
      titleWelsh: r.titleWelsh,
      externalId: r.externalId,
      actType: r.actType,
      year: r.year,
      number: r.number,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byType: Record<string, number> = {}
    const byYear: Record<string, number> = {}
    for (const r of allCandidates) {
      byType[r.actType] = (byType[r.actType] ?? 0) + 1
      byYear[r.year] = (byYear[r.year] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byActType: byType, byYear: byYear },
      sample,
    }

    fs.writeFileSync('pipeline-58-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-58-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by act type:')
      for (const [k, v] of Object.entries(byType)) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nSample titles (newest first):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
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
