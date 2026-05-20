// Pipeline 52 — Russia State Duma Federal Laws (russia_legislation_v1)
// Dataset: kremlin.ru/acts/bank — Presidential acts bank (signed laws)
// URL:     http://kremlin.ru/acts/bank/page/{N} — 2,648 pages, 20 acts/page
// Scope:   All Федеральные законы (type pattern "Федеральный закон от ... г. № N-ФЗ")
//          Approx. 6,000–9,000 laws from 1994–present
// Topic:   ru-gosduma (Gosudarstvennaya Duma, domain=government)
// Run: npx tsx scripts/ingest-russia-legislation.ts --dry-run
//      npx tsx scripts/ingest-russia-legislation.ts --sample 10
//      npx tsx scripts/ingest-russia-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'russia_legislation_v1'
const PIPELINE = 'Pipeline 52'
const BASE_URL = 'http://kremlin.ru'
const BANK_PAGES = 2648
const PER_PAGE = 20
const CONCURRENCY = 1 // sequential to avoid kremlin.ru rate limiting

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  kremlinId: string
  lawNumber: string
  year: string
  title: string
  enactedDate: Date
  enactedDateStr: string
  sourceUrl: string
  externalId: string
  sourceExternalId: string
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

// ── Date parsing ───────────────────────────────────────────────────────────────

// Title format: "Федеральный закон от 01.02.2024 г. № 456-ФЗ"
function parseLawTitle(title: string): { date: Date; dateStr: string; year: string; number: string } | null {
  // Match date: DD.MM.YYYY
  const dateMatch = title.match(/от\s+(\d{2})\.(\d{2})\.(\d{4})\s+г/)
  if (!dateMatch) return null
  const [, dd, mm, yyyy] = dateMatch
  const dateStr = `${yyyy}-${mm}-${dd}`
  const date = new Date(`${dateStr}T00:00:00Z`)
  if (isNaN(date.getTime())) return null

  // Match law number: № N-ФЗ
  const numMatch = title.match(/№\s*(\d+)-ФЗ/i)
  if (!numMatch) return null
  const number = numMatch[1]

  return { date, dateStr, year: yyyy, number }
}

// ── Fetch a page of acts ───────────────────────────────────────────────────────

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8',
}

async function fetchPage(page: number): Promise<CandidateRecord[]> {
  const url = `${BASE_URL}/acts/bank/page/${page}`
  let res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
  if (res.status === 403) {
    // Back off and retry once
    await new Promise(r => setTimeout(r, 4000))
    res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20000) })
  }
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`)
  const html = await res.text()

  const results: CandidateRecord[] = []

  // Each act link contains nested <span> with date in Russian; strip span before extracting title
  const linkRe = /<a\s+href="\/acts\/bank\/(\d+)">([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    const kremlinId = m[1]
    const title = m[2]
      .replace(/<span[\s\S]*?<\/span>/gi, '')
      .replace(/<[^>]+>/g, '')
      .trim()
      .replace(/\s+/g, ' ')

    // Only process Федеральный закон (not Указ, Распоряжение, Кодекс, etc.)
    if (!title.startsWith('Федеральный закон от')) continue

    const parsed = parseLawTitle(title)
    if (!parsed) continue

    const externalId = `ru_fz_${parsed.year}_${parsed.number}`
    const sourceUrl = `${BASE_URL}/acts/bank/${kremlinId}`

    results.push({
      kremlinId,
      lawNumber: parsed.number,
      year: parsed.year,
      title,
      enactedDate: parsed.date,
      enactedDateStr: parsed.dateStr,
      sourceUrl,
      externalId,
      sourceExternalId: `ru_fz_source_${kremlinId}`,
    })
  }

  return results
}

// ── Fetch all pages with limited concurrency ───────────────────────────────────

async function fetchAllPages(totalPages: number, verbose: boolean): Promise<CandidateRecord[]> {
  const seen = new Set<string>()
  const all: CandidateRecord[] = []
  let pagesProcessed = 0

  // Process pages in parallel batches
  for (let start = 1; start <= totalPages; start += CONCURRENCY) {
    const batch = Array.from({ length: Math.min(CONCURRENCY, totalPages - start + 1) }, (_, i) => start + i)
    const results = await Promise.allSettled(batch.map(p => fetchPage(p)))

    let anyFailed = false
    for (let i = 0; i < results.length; i++) {
      const r = results[i]
      if (r.status === 'rejected') {
        anyFailed = true
        console.warn(`  Page ${batch[i]} failed: ${r.reason}`)
        continue
      }
      for (const rec of r.value) {
        if (!seen.has(rec.externalId)) {
          seen.add(rec.externalId)
          all.push(rec)
        }
      }
    }

    pagesProcessed += batch.length
    if (pagesProcessed % 100 === 0 || pagesProcessed === totalPages) {
      process.stdout.write(`  ...page ${pagesProcessed}/${totalPages}: ${all.length} laws found\n`)
    }
    // Polite delay to avoid kremlin.ru rate limiting (403 triggers after ~12 rapid requests)
    if (start + CONCURRENCY <= totalPages) await new Promise(r => setTimeout(r, 900))
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
        name: rec.title.slice(0, 255),
        url: rec.sourceUrl,
        publishedAt: rec.enactedDate,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claim = await tx.claim.create({
      data: {
        text: rec.title.slice(0, 1000),
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
          kremlinId: rec.kremlinId,
          lawNumber: rec.lawNumber,
          year: rec.year,
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

  console.log(`\n── ${PIPELINE}: Russia Gosudarstvennaya Duma Federal Laws ─────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)
  console.log(`Fetching from kremlin.ru/acts/bank (${BANK_PAGES} pages, concurrency ${CONCURRENCY})`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('ru-gosduma', 'Gosudarstvennaya Duma', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // Dry-run only scans first 60 pages (~1,200 recent acts) to validate without a full crawl
  const totalPages = mode === 'dry-run' ? 60
    : limit > 0 ? Math.min(BANK_PAGES, Math.ceil((limit * 10) / PER_PAGE))
    : BANK_PAGES
  console.log(`\nStep 2: Fetching federal laws from kremlin.ru (${totalPages} pages)...`)
  const allCandidates = await fetchAllPages(totalPages, verbose)
  console.log(`  Total Федеральный закон records found: ${allCandidates.length}`)

  const candidates = limit > 0 ? allCandidates.slice(0, limit) : allCandidates
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      kremlinId: r.kremlinId,
      lawNumber: r.lawNumber,
      year: r.year,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const { writeFileSync } = await import('fs')
    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: candidates.length,
      sample,
    }
    writeFileSync('pipeline-52-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-52-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nMost recent laws:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. ${r.title.slice(0, 100)}`)
      )
      console.log('Oldest laws:')
      candidates.slice(-3).forEach((r, i) =>
        console.log(`  ${candidates.length - 2 + i}. ${r.title.slice(0, 100)}`)
      )
    }

    console.log('\nDry-run complete.')
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
