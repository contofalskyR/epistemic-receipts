// Pipeline 69 — Romania Legislation (romania_legislation_v1)
// Dataset: Portal Legislativ (legislatie.just.ro) — Ministry of Justice Romania
// Scope:   Laws (LEGE, tipdoc=1)            ~12,490 records 1863–present
//          Government Ordinances (OG, tipdoc=13) ~1,820 records 1992–present
//          Decree-Laws (DECRET-LEGE, tipdoc=4)   ~190 records 1887–present
//          Total: ~14,500 acts across all types.
// Run:     npx tsx scripts/ingest-romania-legislation.ts --dry-run
//          npx tsx scripts/ingest-romania-legislation.ts --sample 5
//          npx tsx scripts/ingest-romania-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'romania_legislation_v1'
const PIPELINE = 'Pipeline 69'
const RESULTS_URL = 'https://legislatie.just.ro/Public/RezultateCautare'
const DETAIL_BASE = 'https://legislatie.just.ro/Public/DetaliiDocument'
const PAGE_DELAY_MS = 600
const TELEGRAM_TARGET = '7688025079'
// In dry-run mode, only scan this many pages per doc type (enough for a good sample)
const DRY_RUN_MAX_PAGES = 3

// Document types to ingest, in priority order
const DOC_TYPES = [
  { tipdoc: 1, abbr: 'LEGE', formal: 'LEGE' },
  { tipdoc: 13, abbr: 'OG', formal: 'ORDONANȚĂ' },
  { tipdoc: 4, abbr: 'DECRET-LEGE', formal: 'DECRET-LEGE' },
] as const

// Abbreviations that appear in the search list anchor text
const TYPE_NORMALIZE: Record<string, string> = {
  OG: 'ORDONANȚĂ',
  ORDONANTA: 'ORDONANȚĂ',
  'ORDONAN?': 'ORDONANȚĂ',
}

const RO_MONTHS: Record<number, string> = {
  1: 'ianuarie', 2: 'februarie', 3: 'martie', 4: 'aprilie',
  5: 'mai', 6: 'iunie', 7: 'iulie', 8: 'august',
  9: 'septembrie', 10: 'octombrie', 11: 'noiembrie', 12: 'decembrie',
}

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  docId: string
  docType: string
  docNumber: string
  claimText: string
  enactedDate: Date
  dateStr: string
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

async function fetchPage(url: string, retries = 4): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'ro,en;q=0.5',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`Portal Legislativ ${res.status} at ${url}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error at ${url}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function formatRoDate(dd: number, mm: number, yyyy: number): string {
  return `${dd} ${RO_MONTHS[mm]} ${yyyy}`
}

function buildClaimText(docType: string, docNumber: string, dd: number, mm: number, yyyy: number): string {
  const type = TYPE_NORMALIZE[docType] ?? docType
  const dateFormatted = formatRoDate(dd, mm, yyyy)
  if (docNumber) {
    return `${type} nr. ${docNumber} din ${dateFormatted}`
  }
  return `${type} din ${dateFormatted}`
}

// Parse anchor text like:
//   "1. LEGE                1251 15/12/1863"
//   "21. LEGE                     24/03/1904"   ← no number
//   "1. OG          1 13/03/1992"
//   "1. DECRET-LEGE         1233 16/04/1887"
function parseAnchorText(raw: string): { docType: string; docNumber: string; dateStr: string } | null {
  // Strip position prefix "N. "
  const withoutPos = raw.replace(/^\d+\.\s+/, '').trim()
  if (!withoutPos) return null

  // Extract date from end (dd/mm/yyyy)
  const dateMatch = withoutPos.match(/(\d{2}\/\d{2}\/\d{4})$/)
  if (!dateMatch) return null
  const dateStr = dateMatch[1]

  // Everything before the date, trimmed
  const beforeDate = withoutPos.slice(0, -dateStr.length).trim()
  const parts = beforeDate.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null

  // If last token is all digits → it's the number; type is everything before
  const lastPart = parts[parts.length - 1]
  let docType: string
  let docNumber: string

  if (/^\d+$/.test(lastPart)) {
    docNumber = lastPart
    docType = parts.slice(0, -1).join(' ')
  } else {
    docNumber = ''
    docType = parts.join(' ')
  }

  if (!docType) return null
  return { docType, docNumber, dateStr }
}

// Extract all document candidates from one search result page
function parseCandidatesFromHtml(html: string): Array<{ docId: string; docType: string; docNumber: string; dateStr: string }> {
  const results: Array<{ docId: string; docType: string; docNumber: string; dateStr: string }> = []
  // Match anchor links to document detail pages
  const re = /<a href="\/Public\/DetaliiDocument\/(\d+)">([\d]+\.[^<]+)<\/a>/g
  let match: RegExpExecArray | null
  while ((match = re.exec(html)) !== null) {
    const docId = match[1]
    const anchorText = match[2].trim()
    const parsed = parseAnchorText(anchorText)
    if (parsed) {
      results.push({ docId, ...parsed })
    }
  }
  return results
}

function extractLastPage(html: string): number {
  const m = html.match(/PagedList-skipToLast[^>]*>.*?page=(\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(hardLimit: number, verbose: boolean, dryRun = false): Promise<CandidateRecord[]> {
  const all: CandidateRecord[] = []
  const seenIds = new Set<string>()

  for (const { tipdoc, formal } of DOC_TYPES) {
    console.log(`\n  Fetching type ${formal} (tipdoc=${tipdoc})...`)

    // Fetch page 1 to determine total pages
    const firstPageUrl = `${RESULTS_URL}?tipdoc=${tipdoc}&page=1`
    let firstHtml: string
    try {
      firstHtml = await fetchPage(firstPageUrl)
    } catch (err) {
      console.warn(`  Failed to fetch first page for tipdoc=${tipdoc}: ${err instanceof Error ? err.message : err}`)
      continue
    }

    const lastPage = extractLastPage(firstHtml)
    const effectiveLastPage = dryRun ? Math.min(lastPage, DRY_RUN_MAX_PAGES) : lastPage
    console.log(`    Total pages: ${lastPage} (~${lastPage * 10} records)${dryRun ? ` — scanning first ${effectiveLastPage} pages (dry-run)` : ''}`)

    let typeAdded = 0

    for (let page = 1; page <= effectiveLastPage; page++) {
      const url = page === 1 ? firstPageUrl : `${RESULTS_URL}?tipdoc=${tipdoc}&page=${page}`
      let html: string
      try {
        if (page > 1) {
          html = await fetchPage(url)
        } else {
          html = firstHtml
        }
      } catch (err) {
        console.warn(`  Failed page ${page} for tipdoc=${tipdoc}: ${err instanceof Error ? err.message : err}`)
        await sleep(PAGE_DELAY_MS)
        continue
      }

      const entries = parseCandidatesFromHtml(html)

      for (const entry of entries) {
        const externalId = `${INGESTED_BY}:${entry.docId}`
        if (seenIds.has(externalId)) continue
        seenIds.add(externalId)

        // Parse date
        const [dd, mm, yyyy] = entry.dateStr.split('/').map(Number)
        if (!dd || !mm || !yyyy) continue
        const enactedDate = new Date(Date.UTC(yyyy, mm - 1, dd))
        if (isNaN(enactedDate.getTime())) continue

        const dateStr = `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`
        const claimText = buildClaimText(entry.docType, entry.docNumber, dd, mm, yyyy)
        const sourceUrl = `${DETAIL_BASE}/${entry.docId}`
        const sourceName = `${claimText} — Portal Legislativ`

        all.push({
          docId: entry.docId,
          docType: entry.docType,
          docNumber: entry.docNumber,
          claimText,
          enactedDate,
          dateStr,
          sourceUrl,
          externalId,
          sourceExternalId: `${INGESTED_BY}:src:${entry.docId}`,
          sourceName,
        })
        typeAdded++

        if (hardLimit > 0 && all.length >= hardLimit) break
      }

      if (verbose) {
        console.log(`    Page ${page}/${effectiveLastPage}: ${entries.length} entries, ${typeAdded} added for this type`)
      } else {
        process.stdout.write(`    ${formal} page ${page}/${effectiveLastPage} (total: ${all.length})        \r`)
      }

      if (hardLimit > 0 && all.length >= hardLimit) break
      if (page < effectiveLastPage) await sleep(PAGE_DELAY_MS)
    }

    process.stdout.write('\n')
    console.log(`    ${formal}: ${typeAdded} records added`)

    if (hardLimit > 0 && all.length >= hardLimit) break
  }

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
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          docId: rec.docId,
          docType: TYPE_NORMALIZE[rec.docType] ?? rec.docType,
          docNumber: rec.docNumber || null,
          enactedDate: rec.dateStr,
          source: 'legislatie.just.ro',
        },
      },
    })

    await tx.edge.create({
      data: {
        claimId: claim.id,
        sourceId: source.id,
        type: 'CITES',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
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

// ── Notification ───────────────────────────────────────────────────────────────

function notify(message: string) {
  try {
    execSync(`openclaw message send --channel telegram --target "${TELEGRAM_TARGET}" --message "${message.replace(/"/g, '\\"')}"`, { stdio: 'ignore' })
  } catch {
    // notification failure is non-fatal
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Romania Legislation (Portal Legislativ) ──────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Source: legislatie.just.ro`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('ro-parlament', 'Romanian Parliament & Government', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // In sample mode, cap fetching at sampleN so we don't scan all 14k records just for 5
  const fetchLimit = mode === 'sample' ? sampleN : limit

  console.log('\nStep 2: Fetching Romanian legislation from Portal Legislativ...')
  let candidates: CandidateRecord[]
  try {
    candidates = await fetchAllCandidates(fetchLimit, verbose, mode === 'dry-run')
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    notify(`Romania pipeline failed: ${reason}`)
    throw err
  }
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      docId: r.docId,
      docType: TYPE_NORMALIZE[r.docType] ?? r.docType,
      docNumber: r.docNumber || null,
      enactedDate: r.dateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: false,
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

    const outFile = 'pipeline-69-dry-run-sample.json'
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2))
    console.log(`  Written: ${outFile}`)

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.dateStr}] ${r.claimText}`)
      )
    }

    const summary = candidates.slice(0, 5).map(r => r.claimText).join('; ')
    notify(`Romania pipeline done. Found ${candidates.length} records. Sample: ${summary}`)

    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before sample/full run.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  const rows = mode === 'sample'
    ? candidates.slice(0, sampleN)
    : candidates

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.claimText}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
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

  const summary = candidates.slice(0, 3).map(r => r.claimText).join('; ')
  notify(`Romania pipeline done. Ingested ${counts.ingested} records. Sample: ${summary}`)

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  const reason = err instanceof Error ? err.message : String(err)
  notify(`Romania pipeline failed: ${reason}`)
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
