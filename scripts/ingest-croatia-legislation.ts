// Pipeline 107 — Croatia Official Gazette Laws (croatia_legislation_v1)
// Dataset: Narodne novine (narodne-novine.nn.hr) — Croatia's official gazette
// Scope: Documents whose title begins with "Zakon" (primary legislation / acts)
// Topic: hr-sabor (Croatian Parliament / Sabor, domain=government)
// Run: npx tsx scripts/ingest-croatia-legislation.ts --dry-run
//      npx tsx scripts/ingest-croatia-legislation.ts --sample 10
//      npx tsx scripts/ingest-croatia-legislation.ts --full [--limit N] [--verbose]
//
// Method: Paginate the Narodne novine full-text search API using keyword "Zakon",
// filter server results to titles starting with "Zakon" (laws), deduplicate by
// article ID, and parse year/month from URL slug (YEAR_MM_ISSUE_SERIAL).
// No authentication required.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'croatia_legislation_v1'
const PIPELINE = 'Pipeline 107'
const BASE_URL = 'https://narodne-novine.nn.hr'
const SEARCH_PATH = '/search.aspx'
const PAGE_DELAY_MS = 800
// rpp=200 only works for str=1; subsequent pages return 0 results server-side.
// rpp=50 paginates reliably across all 200 pages of the 10,000-result cap.
const RESULTS_PER_PAGE = 50

// ── Types ──────────────────────────────────────────────────────────────────────

interface ArticleRecord {
  articleId: string      // e.g. "2024_03_25_412"
  year: number
  month: number
  issue: number
  serial: number
  title: string
  publishedDate: Date
  publishedDateStr: string
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

function curlGet(url: string): string {
  try {
    return execSync(
      `curl -s --max-time 30 -A "Mozilla/5.0 (compatible; EpistemicReceipts/1.0)" "${url}"`,
      { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 }
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`curl failed for ${url}: ${msg}`)
  }
}

// ── HTML parsing ───────────────────────────────────────────────────────────────

// Article URL slug: YEAR_MM_ISSUE_SERIAL  (e.g. "2024_03_25_412")
const SLUG_RE = /\/clanci\/sluzbeni\/(\d{4}_\d{2}_(\d+)_(\d+))\.html/g

interface ParsedArticle {
  slug: string       // "2024_03_25_412"
  year: number
  month: number
  issue: number
  serial: number
  title: string
}

function parseSearchPage(html: string): ParsedArticle[] {
  const results: ParsedArticle[] = []
  const seen = new Set<string>()

  // Match each article link with its text content (non-greedy [\s\S]*? handles
  // embedded <b>/<span> highlight tags inserted by the search engine).
  const linkRe = /href="\/clanci\/sluzbeni\/(\d{4})_(\d{2})_(\d+)_(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null

  while ((m = linkRe.exec(html)) !== null) {
    const [, yearStr, monthStr, issueStr, serialStr, rawContent] = m
    const slug = `${yearStr}_${monthStr}_${issueStr}_${serialStr}`
    if (seen.has(slug)) continue
    seen.add(slug)

    const title = rawContent
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/\s+\d+$/, '') // strip trailing score annotation (e.g. " 0")
      .trim()

    if (!title) continue

    results.push({
      slug,
      year: parseInt(yearStr, 10),
      month: parseInt(monthStr, 10),
      issue: parseInt(issueStr, 10),
      serial: parseInt(serialStr, 10),
      title,
    })
  }

  return results
}

// ── Candidate building ─────────────────────────────────────────────────────────

function buildRecord(parsed: ParsedArticle): ArticleRecord {
  const { slug, year, month, issue, serial, title } = parsed
  const publishedDate = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`)
  const publishedDateStr = publishedDate.toISOString().slice(0, 7) // YYYY-MM (day unknown)

  const articlePath = `/clanci/sluzbeni/${slug}.html`
  const sourceUrl = `${BASE_URL}${articlePath}`
  const externalId = `croatia_legislation_${slug}`
  const sourceExternalId = `croatia_legislation_source_${slug}`
  const sourceName = `Narodne novine ${year}/${issue}/${serial}`

  return {
    articleId: slug,
    year,
    month,
    issue,
    serial,
    title,
    publishedDate,
    publishedDateStr,
    externalId,
    sourceExternalId,
    sourceUrl,
    sourceName,
  }
}

// ── Fetch all law articles ─────────────────────────────────────────────────────

async function fetchAllLaws(hardLimit: number, maxPages: number, verbose: boolean): Promise<ArticleRecord[]> {
  const records: ArticleRecord[] = []
  const seenIds = new Set<string>()
  let pageStart = 1
  let pageNum = 0
  let consecutiveEmpty = 0

  console.log(`  Paginating Narodne novine search (keyword: Zakon, rpp=${RESULTS_PER_PAGE})...`)

  while (true) {
    pageNum++
    if (maxPages > 0 && pageNum > maxPages) break
    const url = `${BASE_URL}${SEARCH_PATH}?sortiraj=4&kategorija=1&rpp=${RESULTS_PER_PAGE}&qtype=1&pretraga=da&tekst=Zakon&str=${pageStart}`

    let html: string
    try {
      html = curlGet(url)
    } catch (err) {
      console.warn(`  Page ${pageNum} (str=${pageStart}) failed: ${err}`)
      break
    }

    const parsed = parseSearchPage(html)
    let newOnPage = 0

    for (const p of parsed) {
      // Only ingest primary legislation (titles starting with "Zakon")
      if (!p.title.startsWith('Zakon')) continue

      const rec = buildRecord(p)
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      records.push(rec)
      newOnPage++

      if (hardLimit > 0 && records.length >= hardLimit) break
    }

    if (verbose) {
      console.log(`  Page ${pageNum} (str=${pageStart}): ${parsed.length} results, ${newOnPage} new laws (cumulative: ${records.length})`)
    } else if (pageNum % 10 === 0) {
      process.stdout.write(`  Fetched ${records.length} laws (page ${pageNum})...\r`)
    }

    if (hardLimit > 0 && records.length >= hardLimit) break

    // Stop if this page returned no results at all (end of search index)
    if (parsed.length === 0) {
      consecutiveEmpty++
      if (consecutiveEmpty >= 2) break
    } else {
      consecutiveEmpty = 0
    }

    // The search caps at 10,000 results (str up to ~10000)
    if (pageStart + RESULTS_PER_PAGE > 10000) break

    pageStart += RESULTS_PER_PAGE
    await sleep(PAGE_DELAY_MS)
  }

  if (!verbose) process.stdout.write('\n')
  return records
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

async function writeRow(tx: TxClient, rec: ArticleRecord, topicId: string): Promise<IngestResult> {
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
        publishedAt: rec.publishedDate,
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
        claimEmergedAt: rec.publishedDate,
        claimEmergedPrecision: 'MONTH',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          articleId: rec.articleId,
          year: rec.year,
          month: rec.month,
          issue: rec.issue,
          serial: rec.serial,
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

  console.log(`\n── ${PIPELINE}: Croatia Official Gazette Laws ──────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  if (mode === 'full' && !process.env.ALLOW_EDITS) {
    console.error('Set ALLOW_EDITS=true to run full ingestion.')
    process.exit(1)
  }

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('hr-sabor', 'Croatian Parliament (Sabor)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching laws from Narodne novine search...')
  // dry-run scans first 20 pages (1,000 results) for a quick sample (~40 laws)
  const candidates = await fetchAllLaws(
    limit > 0 ? limit : 0,
    mode === 'dry-run' ? 20 : 0,
    verbose
  )
  console.log(`\nTotal law candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const byYear = new Map<number, number>()
    for (const r of candidates) {
      byYear.set(r.year, (byYear.get(r.year) ?? 0) + 1)
    }
    const topYears = [...byYear.entries()].sort((a, b) => b[0] - a[0]).slice(0, 10)

    const sample = candidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      articleId: r.articleId,
      year: r.year,
      month: r.month,
      issue: r.issue,
      serial: r.serial,
      publishedDate: r.publishedDateStr,
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
      distributionByYear: Object.fromEntries(topYears),
      sample,
    }

    fs.writeFileSync('pipeline-107-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-107-dry-run-sample.json')

    console.log('\nDistribution by year (newest):')
    topYears.forEach(([y, c]) => console.log(`  ${y}: ${c}`))

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year}-${String(r.month).padStart(2, '0')}] ${r.title.slice(0, 100)}${r.title.length > 100 ? '…' : ''}`)
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
