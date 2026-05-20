// Pipeline 36 — Belgium Legislation Enacted Laws (belgium_legislation_v1)
// Dataset: Belgian Official Gazette (Belgisch Staatsblad / ejustice.just.fgov.be)
//          via ELI (European Legislation Identifier) system.
// Scope:   Federal laws (Wetten/Lois) promulgated 1997–present. One record per
//          enacted law as identified by its 10-digit NUMAC number.
// Topic:   be-dekamer (Belgian Chamber — De Kamer, domain=government)
// Run:     npx tsx scripts/ingest-belgium-legislation.ts --dry-run
//          npx tsx scripts/ingest-belgium-legislation.ts --sample 10
//          npx tsx scripts/ingest-belgium-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'belgium_legislation_v1'
const PIPELINE = 'Pipeline 36'
const ELI_BASE = 'https://www.ejustice.just.fgov.be/eli/wet'
const FIRST_YEAR = 1997
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  numac: string
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

async function fetchHtmlPage(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'Accept': 'text/html,application/xhtml+xml', 'Accept-Language': 'nl,fr' },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`EJustice API ${res.status} at ${url}`)
      const buf = await res.arrayBuffer()
      return new TextDecoder('iso-8859-1').decode(buf)
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error at ${url}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at ${url}`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

// Matches either /moniteur or /justel suffix; prefer moniteur when both exist
const ENTRY_RE = /size=2>\s*\n?(.*?)\s*<br><br>.*?Gepubliceerd.{1,60}?#0077A9>\s*(\d{2}-\d{2}-\d{4}).*?(http:\/\/www\.ejustice[^"]+\/(?:moniteur|justel))/gds

function parseYear(html: string, year: number, verbose: boolean): CandidateRecord[] {
  const candidates: CandidateRecord[] = []
  const seenNumac = new Set<string>()

  let match: RegExpExecArray | null
  ENTRY_RE.lastIndex = 0

  while ((match = ENTRY_RE.exec(html)) !== null) {
    const rawTitle = match[1] ?? ''
    const eliLink = match[3] ?? ''

    // Extract enacted date and NUMAC from ELI URL: .../wet/YYYY/MM/DD/NUMAC/(moniteur|justel)
    const dateMatch = eliLink.match(/\/wet\/(\d{4})\/(\d{2})\/(\d{2})\/(\d{10,})\//)
    if (!dateMatch) {
      if (verbose) console.log(`  Skip entry: no ELI date in ${eliLink}`)
      continue
    }
    const [, yr, mo, dd, numac] = dateMatch
    // Use moniteur URL as canonical; fall back to justel if that's all we have
    const monitorLink = eliLink.endsWith('/moniteur') ? eliLink : eliLink.replace(/\/justel$/, '/moniteur')
    const enactedDateStr = `${yr}-${mo}-${dd}`
    const enactedDate = new Date(`${enactedDateStr}T00:00:00Z`)
    if (isNaN(enactedDate.getTime())) {
      if (verbose) console.log(`  Skip NUMAC ${numac}: invalid date ${enactedDateStr}`)
      continue
    }

    // Clean title: strip leading "<B>N</B>" number, strip HTML tags, strip footnote markers
    let title = rawTitle
      .replace(/^<[^>]+>\s*\d+\s*<\/[^>]+>\s*/, '')  // leading bold number
      .replace(/<[^>]+>/g, '')                          // all HTML tags
      .replace(/\s*\(\d+\)\s*/g, ' ')                  // footnote markers like (1)(2)
      .replace(/\s+/g, ' ')
      .trim()

    if (!title) {
      if (verbose) console.log(`  Skip NUMAC ${numac}: empty title`)
      continue
    }

    if (seenNumac.has(numac)) continue
    seenNumac.add(numac)

    const externalId = `belgium_loi_${numac}`
    const sourceExternalId = `belgium_loi_src_${numac}`

    candidates.push({
      numac,
      claimText: title,
      enactedDate,
      enactedDateStr,
      sourceUrl: monitorLink,
      externalId,
      sourceExternalId,
      sourceName: `Belgian Law ${numac} (${enactedDateStr})`,
    })
  }

  return candidates
}

// ── Fetch all laws ─────────────────────────────────────────────────────────────

async function fetchAllLaws(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)
  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()
  let skippedMalformed = 0

  console.log(`  Fetching ${years.length} years (${FIRST_YEAR}–${currentYear})...`)

  for (const year of years) {
    const url = `${ELI_BASE}/${year}`
    let html: string
    try {
      html = await fetchHtmlPage(url)
    } catch (err) {
      console.warn(`  Failed year ${year}: ${err instanceof Error ? err.message : err}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }

    const yearCandidates = parseYear(html, year, verbose)
    let addedThisYear = 0

    for (const rec of yearCandidates) {
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      all.push(rec)
      addedThisYear++
      if (hardLimit > 0 && all.length >= hardLimit) break
    }

    if (verbose) console.log(`  Year ${year}: ${addedThisYear} new / ${yearCandidates.length} parsed`)
    else process.stdout.write(`  Year ${year}: ${addedThisYear} laws (total: ${all.length})        \r`)

    if (hardLimit > 0 && all.length >= hardLimit) break
    await sleep(PAGE_DELAY_MS)
  }

  process.stdout.write('\n')
  if (skippedMalformed > 0) console.log(`  Skipped ${skippedMalformed} malformed records`)
  return all
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
          numac: rec.numac,
          eli_url: rec.sourceUrl,
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

  console.log(`\n── ${PIPELINE}: Belgium Enacted Laws (Wetten/Lois) ───────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('be-dekamer', 'Belgian Chamber (De Kamer)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Belgian laws from ejustice.just.fgov.be ELI system...')
  const candidates = await fetchAllLaws(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      numac: r.numac,
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

    fs.writeFileSync('pipeline-36-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-36-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedDateStr}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
      )
    }

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
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
