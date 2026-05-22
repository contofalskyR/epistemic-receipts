// Pipeline 108 — Slovakia Legislation (slovakia_legislation_v1)
// Dataset: Zbierka zákonov Slovenskej republiky (Collection of Laws of the Slovak Republic)
//          via static.slov-lex.sk — the Ministry of Justice of Slovakia's official legal portal.
// Scope:   Primary legislation (Zákon) enacted since Slovak independence (1993–present).
//          One record per act identified by its ZZ number (e.g. "7/2024 Z. z.").
// Method:  Scrape year index pages at static.slov-lex.sk/static/SK/ZZ/{year}/,
//          filter to rows whose title begins with "Zákon", parse act number and title.
//          No auth required. ~4,000 records expected.
// Topic:   sk-nrsr (Národná rada Slovenskej republiky / National Council of Slovakia)
// Run:     set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-slovakia-legislation.ts --dry-run
//          set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-slovakia-legislation.ts --sample 5
//          set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-slovakia-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'slovakia_legislation_v1'
const PIPELINE = 'Pipeline 108'
const STATIC_BASE = 'https://static.slov-lex.sk/static/SK/ZZ'
const CANONICAL_BASE = 'https://www.slov-lex.sk/ezbierky/pravne-predpisy/SK/ZZ'
const FIRST_YEAR = 1993
const PAGE_DELAY_MS = 300

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  year: number
  actNumber: number
  zzId: string            // e.g. "7/2024"
  claimText: string
  publishedAt: Date
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
    sampleN: sai !== -1 ? (parseInt(args[sai + 1] ?? '5', 10) || 5) : 5,
    verbose: args.includes('--verbose'),
  }
}

// ── HTTP ───────────────────────────────────────────────────────────────────────

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function fetchHtml(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'sk,cs',
          'User-Agent': 'Mozilla/5.0 (compatible; EpistemicReceipts/1.0; research)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at ${url} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
      return await res.text()
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

// Row pattern: <td>N/YYYY&nbsp;Z.&nbsp;z.</td><td><a href="N/">Title</a></td>
const ROW_RE = /<td>(\d+)\/(\d{4})&nbsp;Z\.&nbsp;z\.<\/td>\s*<td><a href="\d+\/">([^<]+)<\/a><\/td>/g

function parseYearPage(html: string, year: number): CandidateRecord[] {
  const records: CandidateRecord[] = []
  ROW_RE.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = ROW_RE.exec(html)) !== null) {
    const actNumber = parseInt(match[1] ?? '0', 10)
    const actYear = parseInt(match[2] ?? '0', 10)
    const rawTitle = (match[3] ?? '').trim()

    if (actYear !== year || actNumber === 0) continue

    // Only primary legislation (acts of parliament)
    if (!rawTitle.startsWith('Zákon')) continue

    // Decode HTML entities in title
    const title = rawTitle
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim()

    if (!title) continue

    const zzId = `${actNumber}/${year}`
    const externalId = `slovakia_zz_${year}_${actNumber}`
    const sourceExternalId = `slovakia_zz_src_${year}_${actNumber}`
    const sourceUrl = `${CANONICAL_BASE}/${year}/${actNumber}`
    const publishedAt = new Date(`${year}-01-01T00:00:00Z`)

    records.push({
      year,
      actNumber,
      zzId,
      claimText: title,
      publishedAt,
      sourceUrl,
      externalId,
      sourceExternalId,
      sourceName: `Slovakia ZZ ${zzId} Z. z.`,
    })
  }

  return records
}

// ── Fetch all acts ─────────────────────────────────────────────────────────────

async function fetchAllActs(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - FIRST_YEAR + 1 }, (_, i) => FIRST_YEAR + i)
  const all: CandidateRecord[] = []
  const seen = new Set<string>()

  console.log(`  Fetching ${years.length} year index pages (${FIRST_YEAR}–${currentYear})...`)

  for (const year of years) {
    const url = `${STATIC_BASE}/${year}/`
    let html: string
    try {
      html = await fetchHtml(url)
    } catch (err) {
      console.warn(`  Failed year ${year}: ${err instanceof Error ? err.message : err}`)
      await sleep(PAGE_DELAY_MS)
      continue
    }

    const yearRecords = parseYearPage(html, year)
    let added = 0

    for (const rec of yearRecords) {
      if (seen.has(rec.externalId)) continue
      seen.add(rec.externalId)
      all.push(rec)
      added++
      if (hardLimit > 0 && all.length >= hardLimit) break
    }

    if (verbose) {
      console.log(`  Year ${year}: ${added} Zákon / ${yearRecords.length} total parsed`)
    } else {
      process.stdout.write(`  Year ${year}: ${added} acts (running total: ${all.length})        \r`)
    }

    if (hardLimit > 0 && all.length >= hardLimit) break
    await sleep(PAGE_DELAY_MS)
  }

  process.stdout.write('\n')
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
        publishedAt: rec.publishedAt,
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
        claimEmergedAt: rec.publishedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          zz_id: rec.zzId,
          year: rec.year,
          act_number: rec.actNumber,
          source_url: rec.sourceUrl,
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

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Slovakia Zbierka zákonov (Zákon) ───────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('sk-nrsr', 'Slovak National Council (Národná rada SR)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Slovak acts from static.slov-lex.sk...')
  const candidates = await fetchAllActs(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      zzId: r.zzId,
      year: r.year,
      publishedAt: r.publishedAt.toISOString().slice(0, 10),
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
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
      source: 'static.slov-lex.sk/static/SK/ZZ/',
      method: 'html-scrape-year-index',
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-108-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-108-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year}] ${r.zzId} Z. z. — ${r.claimText.slice(0, 100)}${r.claimText.length > 100 ? '…' : ''}`)
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

  if (mode === 'sample') {
    console.log('\nAwaiting explicit go-ahead before full run.')
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
