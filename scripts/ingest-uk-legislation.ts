// Pipeline 23 — UK Acts of Parliament (uk_legislation_v1)
// Dataset: legislation.gov.uk (free, no API key required)
// Scope: UK Public General Acts (ukpga) — Acts of Parliament
// Topic: uk-parliament (UK Parliament, domain=government)
// Run: npx tsx scripts/ingest-uk-legislation.ts --dry-run
//      npx tsx scripts/ingest-uk-legislation.ts --sample 10
//      npx tsx scripts/ingest-uk-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'uk_legislation_v1'
const PIPELINE = 'Pipeline 23'
const API_BASE = 'https://www.legislation.gov.uk/ukpga/data.feed'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  year: string
  chapter: string
  claimText: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
  sourceName: string
}

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

function ensureHttps(url: string): string {
  if (url.startsWith('//')) return 'https:' + url
  if (url.startsWith('http://')) return 'https://' + url.slice('http://'.length)
  return url
}

async function fetchAtomPage(page: number, retries = 4): Promise<string> {
  const url = `${API_BASE}?results-count=${PAGE_SIZE}&page=${page}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: { Accept: 'application/atom+xml' } })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at page ${page} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`legislation.gov.uk API ${res.status} at page ${page}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error fetching page ${page}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at page ${page}`)
}

// ── XML parsing ────────────────────────────────────────────────────────────────

function xmlDecode(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

interface ParsedEntry {
  title: string
  year: string
  number: string
  creationDate: string
  published: string
  enactedLink: string
}

function parseAtomEntries(xml: string): ParsedEntry[] {
  const entries: ParsedEntry[] = []
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g
  let m: RegExpExecArray | null
  while ((m = entryRe.exec(xml)) !== null) {
    const e = m[1]

    const titleM = e.match(/<title[^>]*>([\s\S]*?)<\/title>/)
    const yearM = e.match(/ukm:Year[^/\n>]*Value="([^"]+)"/)
    const numberM = e.match(/ukm:Number[^/\n>]*Value="([^"]+)"/)
    const creationM = e.match(/ukm:CreationDate[^/\n>]*Date="([^"]+)"/)
    const publishedM = e.match(/<published[^>]*>([\s\S]*?)<\/published>/)
    // Match link with ONLY href attribute (no rel) — this is the enacted URL
    const linkM = e.match(/<link\s+href="([^"]+)"\s*\/>/)

    entries.push({
      title: titleM ? xmlDecode(titleM[1].trim()) : '',
      year: yearM ? yearM[1].trim() : '',
      number: numberM ? numberM[1].trim() : '',
      creationDate: creationM ? creationM[1].trim() : '',
      published: publishedM ? publishedM[1].trim().slice(0, 10) : '',
      enactedLink: linkM ? linkM[1] : '',
    })
  }
  return entries
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildCandidate(parsed: ParsedEntry, verbose: boolean): CandidateRecord | null {
  const { year, number: chapter, title, enactedLink, creationDate, published } = parsed

  if (!year || !chapter) {
    if (verbose) console.log(`  Skip: missing year/chapter (year=${year}, chapter=${chapter})`)
    return null
  }
  if (!title) {
    if (verbose) console.log(`  Skip ukpga/${year}/${chapter}: no title`)
    return null
  }
  if (!enactedLink) {
    if (verbose) console.log(`  Skip ukpga/${year}/${chapter}: no enacted link`)
    return null
  }

  const rawDate = creationDate || published
  let enactedDate: Date
  let enactedDateStr: string

  if (rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
    enactedDateStr = rawDate
    enactedDate = new Date(rawDate + 'T00:00:00Z')
  } else if (/^\d{4}$/.test(year)) {
    enactedDateStr = `${year}-01-01`
    enactedDate = new Date(enactedDateStr + 'T00:00:00Z')
  } else {
    if (verbose) console.log(`  Skip ukpga/${year}/${chapter}: cannot determine date`)
    return null
  }

  if (isNaN(enactedDate.getTime())) {
    if (verbose) console.log(`  Skip ukpga/${year}/${chapter}: invalid date=${rawDate}`)
    return null
  }

  const externalId = `uk_legislation_ukpga_${year}_${chapter}`
  const sourceExternalId = `uk_legislation_source_ukpga_${year}_${chapter}`
  const sourceUrl = ensureHttps(enactedLink)

  return {
    year,
    chapter,
    claimText: title,
    enactedDate,
    enactedDateStr,
    sourceUrl,
    externalId,
    sourceExternalId,
    sourceName: `UK Public General Act ${year} c.${chapter}`,
  }
}

// ── Fetch all acts ─────────────────────────────────────────────────────────────

async function fetchAllActs(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedMalformed = 0
  let page = 1
  let pagesFetched = 0

  while (true) {
    const xml = await fetchAtomPage(page)
    pagesFetched++

    const entries = parseAtomEntries(xml)
    if (entries.length === 0) break

    let newOnPage = 0
    for (const entry of entries) {
      const rec = buildCandidate(entry, verbose)
      if (!rec) { skippedMalformed++; continue }
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      newOnPage++
      if (hardLimit > 0 && candidates.length >= hardLimit) break
    }

    if (hardLimit > 0 && candidates.length >= hardLimit) break
    if (newOnPage === 0) break

    if (verbose) console.log(`  ...page ${pagesFetched}: cumulative ${candidates.length}`)
    page++
    await sleep(PAGE_DELAY_MS)
  }

  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed/incomplete records`)
  return candidates
}

// ── Topic management ───────────────────────────────────────────────────────────

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
        text: rec.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.enactedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          year: rec.year,
          chapter: rec.chapter,
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

  console.log(`\n── ${PIPELINE}: UK Acts of Parliament ────────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('uk-parliament', 'UK Parliament', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching UK Public General Acts from legislation.gov.uk...')
  const candidates = await fetchAllActs(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      year: r.year,
      chapter: r.chapter,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-23-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-23-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : (limit > 0 ? candidates.slice(0, limit) : candidates)

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText.slice(0, 70)}`)
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
