// Pipeline 73 — Thailand Legislation (thailand_legislation_v1)
// Source: ocs.go.th (Office of the Council of State — official Thai legislation portal)
// Note: Replaces the old krisdika.go.th domain (301 → ocs.go.th). krisdika redirects to ocs.go.th.
// Data: Law index at /searchlaw/law-index/ — 247 pages, 20 laws/page, ~4,940 total laws.
//       Titles are in Thai (official legislative language).
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-thailand-legislation.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-thailand-legislation.ts --sample 20
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-thailand-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'
import * as http from 'http'

const prisma = new PrismaClient()

const INGESTED_BY = 'thailand_legislation_v1'
const PIPELINE = 'Pipeline 73'
const BASE_URL = 'https://www.ocs.go.th'
const LAW_INDEX_BASE = `${BASE_URL}/searchlaw/law-index/`
// Pages confirmed: page 1–247 have 20 laws each; page 248+ is empty.
const MAX_PAGES = 247
const REQUEST_DELAY_MS = 1000

// ── Types ──────────────────────────────────────────────────────────────────────

interface CandidateRecord {
  itemId: string
  title: string
  year: number
  publishedAt: Date
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '20', 10) || 20) : 20,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const follow = (u: string, redirects = 0) => {
      if (redirects > 5) { reject(new Error('Too many redirects')); return }
      const parsed = new URL(u)
      const lib = parsed.protocol === 'https:' ? https : http
      lib.get(u, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0)',
          'Accept-Language': 'th,en;q=0.9',
          'Accept': 'text/html,application/xhtml+xml',
        },
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume()
          const next = res.headers.location.startsWith('http')
            ? res.headers.location
            : `${parsed.protocol}//${parsed.host}${res.headers.location}`
          follow(next, redirects + 1)
          return
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${u}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c: Buffer) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
        res.on('error', reject)
      }).on('error', reject)
    }
    follow(url)
  })
}

// ── Parse one law index page ───────────────────────────────────────────────────

function parseLawIndexPage(html: string): Array<{ itemId: string; title: string }> {
  const results: Array<{ itemId: string; title: string }> = []
  const seen = new Set<string>()

  // Structure: council-of-state link contains the actual title; law-index/item link contains only "หน้ากฎหมายนี้"
  // Match: title anchor → ... → item ID anchor (within ~800 chars)
  const blockPattern = /href="https?:\/\/searchlaw\.ocs\.go\.th\/council-of-state[^"]*"[^>]*>([^<]+)<\/a>[\s\S]{0,800}?href="https?:\/\/(?:www\.)?ocs\.go\.th\/searchlaw\/law-index\/item\/(\d+)"/g
  let m: RegExpExecArray | null
  while ((m = blockPattern.exec(html)) !== null) {
    const [, rawTitle, itemId] = m
    const title = rawTitle.replace(/\s+/g, ' ').trim()
    if (!title || title.length < 3) continue
    if (seen.has(itemId)) continue
    seen.add(itemId)
    results.push({ itemId, title })
  }

  return results
}

// Thai Buddhist Era (BE) year to CE year: BE = CE + 543
function thaiYearFromTitle(title: string): number {
  // Thai laws often have พ.ศ. XXXX or พ.ศ.XXXX (Buddhist Era year)
  const beMatch = title.match(/พ\.ศ\.\s*(\d{4})/)
  if (beMatch) {
    const beYear = parseInt(beMatch[1], 10)
    // BE years 2400-2600 → CE 1857-2057
    if (beYear >= 2400 && beYear <= 2700) return beYear - 543
  }
  // Also try just 4-digit numbers in range 2500-2600 (common BE range for modern laws)
  const numMatch = title.match(/\b(25\d{2})\b/)
  if (numMatch) {
    const be = parseInt(numMatch[1], 10)
    return be - 543
  }
  return new Date().getFullYear()
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const allRecords: CandidateRecord[] = []
  let totalPages = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? LAW_INDEX_BASE : `${LAW_INDEX_BASE}?page=${page}`
    if (verbose) console.log(`  Fetching page ${page}/${MAX_PAGES}...`)

    try {
      const html = await fetchUrl(url)
      const items = parseLawIndexPage(html)

      if (items.length === 0) {
        if (verbose) console.log(`  Page ${page}: empty — stopping`)
        break
      }

      totalPages++
      for (const item of items) {
        const year = thaiYearFromTitle(item.title)
        const publishedAt = new Date(`${year}-01-01T00:00:00Z`)
        const externalId = `th_law_${item.itemId}`
        const sourceUrl = `${LAW_INDEX_BASE}item/${item.itemId}`

        allRecords.push({
          itemId: item.itemId,
          title: item.title,
          year,
          publishedAt,
          externalId,
          sourceExternalId: `${externalId}_src`,
          sourceUrl,
        })
      }

      if (!verbose) process.stdout.write(`  Page ${page}/${MAX_PAGES} — ${allRecords.length} laws\r`)

      if (limit > 0 && allRecords.length >= limit) {
        allRecords.splice(limit)
        break
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Page ${page}: ${msg}`)
    }

    await sleep(REQUEST_DELAY_MS)
  }

  if (allRecords.length > 0) console.log()
  console.log(`  Fetched ${totalPages} pages, ${allRecords.length} laws total`)
  return allRecords
}

// ── Dry-run: only fetch first 3 pages to validate ─────────────────────────────

async function fetchDryRunSample(): Promise<CandidateRecord[]> {
  const records: CandidateRecord[] = []
  for (let page = 1; page <= 3; page++) {
    const url = page === 1 ? LAW_INDEX_BASE : `${LAW_INDEX_BASE}?page=${page}`
    try {
      const html = await fetchUrl(url)
      const items = parseLawIndexPage(html)
      for (const item of items) {
        const year = thaiYearFromTitle(item.title)
        records.push({
          itemId: item.itemId,
          title: item.title,
          year,
          publishedAt: new Date(`${year}-01-01T00:00:00Z`),
          externalId: `th_law_${item.itemId}`,
          sourceExternalId: `th_law_${item.itemId}_src`,
          sourceUrl: `${LAW_INDEX_BASE}item/${item.itemId}`,
        })
      }
      console.log(`  Page ${page}: ${items.length} laws`)
    } catch (err) {
      console.warn(`  Page ${page} error: ${err}`)
    }
    await sleep(REQUEST_DELAY_MS)
  }
  return records
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
        name: `Thailand OCS Law ${rec.itemId} — ${rec.title.slice(0, 80)}`,
        url: rec.sourceUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
      },
    })

    const claimText = `Thailand enacted: ${rec.title}.`

    const claim = await tx.claim.create({
      data: {
        text: claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        claimEmergedAt: rec.publishedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          itemId: rec.itemId,
          title: rec.title,
          year: rec.year,
          country: 'Thailand',
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

  console.log(`\n── ${PIPELINE}: Thailand Legislation ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('parliament-thailand', 'National Assembly of Thailand', 'government', 'gov-region-asia')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Thailand laws from ocs.go.th law index...')
  let allCandidates: CandidateRecord[]

  if (mode === 'dry-run') {
    console.log('  (Dry-run: fetching pages 1–3 to validate)')
    allCandidates = await fetchDryRunSample()
  } else {
    allCandidates = await fetchAllCandidates(limit, verbose)
  }

  console.log(`\nTotal candidates: ${allCandidates.length}`)

  if (allCandidates.length === 0) {
    console.error('\nERROR: No candidates parsed — check ocs.go.th structure.')
    process.exit(1)
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      const decade = `${Math.floor(r.year / 10) * 10}s`
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const sample = allCandidates.slice(0, 15).map(r => ({
      itemId: r.itemId, title: r.title, year: r.year,
      claimText: `Thailand enacted: ${r.title}.`,
      externalId: r.externalId, sourceUrl: r.sourceUrl,
    }))

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      note: 'Dry-run fetches only pages 1-3 (~60 laws). Full run: ~247 pages, ~4,940 laws.',
      totalCandidatesInDryRun: allCandidates.length,
      distribution: { byDecade },
      sample,
    }

    fs.writeFileSync('pipeline-73-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-73-dry-run-sample.json')

    console.log('\nDistribution by decoded CE year decade:')
    Object.entries(byDecade).sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([d, n]) => console.log(`  ${d}: ${n}`))
    console.log('\nSample (first 5):')
    allCandidates.slice(0, 5).forEach((r, i) =>
      console.log(`  ${i + 1}. [${r.year}] ${r.title.slice(0, 100)}`)
    )
    console.log('\nDry-run complete.')
    return
  }

  // ── Sample / Full ──────────────────────────────────────────────────────────
  if (mode === 'full' && !process.env.ALLOW_EDITS) {
    console.error('ERROR: Set ALLOW_EDITS=true to run in full mode.')
    process.exit(1)
  }

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
          if (verbose) console.log(`  [${result}] ${row.externalId} — ${row.title.slice(0, 60)}`)
        }
      }, { timeout: 30000 })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Batch ${i}–${i + batch.length} failed: ${msg}`)
      counts.errors += batch.length
    }
    if (!verbose) process.stdout.write(`  ${Math.min(i + BATCH, rows.length)}/${rows.length} processed...\r`)
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

  if (mode === 'sample') console.log('\nAwaiting explicit go-ahead before full run.')
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
