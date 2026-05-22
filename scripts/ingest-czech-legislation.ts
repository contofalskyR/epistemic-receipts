// Pipeline 66 — Czech Legislation (czech_legislation_v1)
// Source: Czech Parliament (psp.cz) — Sbírka zákonů (Collection of Laws)
// Scope:  All legislative acts published 1945–present. Includes laws (Zákon),
//         government decrees (Nařízení vlády), ordinances (Vyhláška), and
//         constitutional acts (Ústavní zákon). 1945–1992 records are
//         Czechoslovak laws inherited by the Czech Republic.
// URL:    https://www.psp.cz/sqw/sbirka.sqw?r=YEAR  (year index page)
//         https://www.psp.cz/sqw/sbirka.sqw?cz=NUM&r=YEAR  (individual law)
// Encoding: windows-1250
// Run:    set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-czech-legislation.ts --dry-run
//         set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-czech-legislation.ts --sample 5
//         set -a && source .env.local && set +a && npx ts-node --project tsconfig.scripts.json scripts/ingest-czech-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'czech_legislation_v1'
const PIPELINE = 'Pipeline 66'
const PSP_BASE = 'https://www.psp.cz/sqw'
const FIRST_YEAR = 1945
const PAGE_DELAY_MS = 400

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  czNum: number
  year: number
  claimText: string
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

async function fetchYearPage(year: number, retries = 4): Promise<string> {
  const url = `${PSP_BASE}/sbirka.sqw?r=${year}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'cs,en;q=0.9',
          'User-Agent': 'EpistemicReceipts/1.0 (robert.contofalsky@rutgers.edu)',
        },
      })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} year ${year} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`psp.cz HTTP ${res.status} for year ${year}`)
      const buf = await res.arrayBuffer()
      return new TextDecoder('windows-1250').decode(buf)
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error year ${year}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries for year ${year}`)
}

// ── HTML helpers ───────────────────────────────────────────────────────────────

function decodeEntities(html: string): string {
  return html
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── Parsing ────────────────────────────────────────────────────────────────────

// Matches table rows: <a href="sbirka.sqw?cz=NUM&r=YEAR">NUM/YEAR</a>&nbsp;Sb.</td><td>TITLE</td>
// psp.cz renders all rows on a single line so dotAll flag is not needed
const ROW_RE = /href="sbirka\.sqw\?cz=(\d+)&(?:amp;)?r=(\d+)"[^>]*>\d+\/\d+<\/a>&nbsp;Sb\.<\/td><td>(.*?)<\/td>/g

function parseYearPage(html: string, year: number, verbose: boolean): CandidateRecord[] {
  const candidates: CandidateRecord[] = []
  const seenNums = new Set<number>()

  ROW_RE.lastIndex = 0
  let match: RegExpExecArray | null

  while ((match = ROW_RE.exec(html)) !== null) {
    const czNum = parseInt(match[1], 10)
    const rowYear = parseInt(match[2], 10)
    const rawTitle = match[3] ?? ''

    if (rowYear !== year) continue
    if (isNaN(czNum) || czNum <= 0) continue
    if (seenNums.has(czNum)) continue
    seenNums.add(czNum)

    const title = decodeEntities(rawTitle)
    if (!title) {
      if (verbose) console.log(`  Skip ${czNum}/${year}: empty title`)
      continue
    }

    const sourceUrl = `${PSP_BASE}/sbirka.sqw?cz=${czNum}&r=${year}`
    const externalId = `czech_legislation_${year}_${czNum}`
    const sourceExternalId = `czech_legislation_src_${year}_${czNum}`

    candidates.push({
      czNum,
      year,
      claimText: title,
      sourceUrl,
      externalId,
      sourceExternalId,
      sourceName: `Czech Law ${czNum}/${year} Sb.`,
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
  let skippedYears = 0

  console.log(`  Scanning ${years.length} years (${FIRST_YEAR}–${currentYear})...`)

  for (const year of years) {
    let html: string
    try {
      html = await fetchYearPage(year)
    } catch (err) {
      console.warn(`  Failed year ${year}: ${err instanceof Error ? err.message : err}`)
      skippedYears++
      await sleep(PAGE_DELAY_MS)
      continue
    }

    const yearCandidates = parseYearPage(html, year, verbose)
    let addedThisYear = 0

    for (const rec of yearCandidates) {
      if (seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      all.push(rec)
      addedThisYear++
      if (hardLimit > 0 && all.length >= hardLimit) break
    }

    if (verbose) console.log(`  Year ${year}: ${addedThisYear} laws`)
    else process.stdout.write(`  Year ${year}: ${addedThisYear} laws (total: ${all.length})        \r`)

    if (hardLimit > 0 && all.length >= hardLimit) break
    await sleep(PAGE_DELAY_MS)
  }

  process.stdout.write('\n')
  if (skippedYears > 0) console.log(`  Skipped ${skippedYears} years due to errors`)
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
    const publishedAt = new Date(`${rec.year}-01-01T00:00:00Z`)

    const source = await tx.source.upsert({
      where: { externalId: rec.sourceExternalId },
      update: {},
      create: {
        externalId: rec.sourceExternalId,
        name: rec.sourceName,
        url: rec.sourceUrl,
        publishedAt,
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
        claimEmergedAt: publishedAt,
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: false,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          czNum: rec.czNum,
          year: rec.year,
          citation: `${rec.czNum}/${rec.year} Sb.`,
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

  console.log(`\n── ${PIPELINE}: Czech Legislation (Sbírka zákonů) ──────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('cz-parliament', 'Czech Parliament (Poslanecká sněmovna)', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Czech laws from psp.cz Sbírka zákonů...')
  const candidates = await fetchAllLaws(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      czNum: r.czNum,
      year: r.year,
      citation: `${r.czNum}/${r.year} Sb.`,
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
      sourceUrlPattern: `${PSP_BASE}/sbirka.sqw?r=YEAR`,
      totalCandidates: candidates.length,
      sample,
    }

    fs.writeFileSync('pipeline-66-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-66-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.czNum}/${r.year} Sb.] ${r.claimText.slice(0, 100)}${r.claimText.length > 100 ? '…' : ''}`)
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
