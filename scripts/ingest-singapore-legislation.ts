// Pipeline 30 — Singapore Statutes Online (singapore_legislation_v1)
// Dataset: Singapore Statutes Online (sso.agc.gov.sg) — public, no API key required.
// Scope: Acts of Parliament currently in force.
// Source: Browse page HTML parsed via X-SW-AJAX header (site uses session-based AJAX, GET-only).
// Topic: sg-statutes (Singapore Statutes Online, domain=government).
// Run: npx tsx scripts/ingest-singapore-legislation.ts --dry-run
//      npx tsx scripts/ingest-singapore-legislation.ts --sample 10
//      npx tsx scripts/ingest-singapore-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'singapore_legislation_v1'
const PIPELINE = 'Pipeline 30'
const SSO_BASE = 'https://sso.agc.gov.sg'
const PAGE_SIZE = 500
const PAGE_DELAY_MS = 300

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'X-SW-AJAX': '1',
  'X-Requested-With': 'XMLHttpRequest',
  'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
  'Referer': 'https://sso.agc.gov.sg/Browse/Act/Current/All',
}

// ── Types ──────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  actId: string
  claimText: string
  enactedYear: number
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

async function fetchBrowsePage(pageNum: number, retries = 4): Promise<string> {
  const path = pageNum === 1
    ? `/Browse/Act/Current/All?PageSize=${PAGE_SIZE}&SortBy=Title&SortOrder=ASC&getPartialView=list`
    : `/Browse/Act/Current/All/${pageNum}?PageSize=${PAGE_SIZE}&SortBy=Title&SortOrder=ASC&getPartialView=list`
  const url = `${SSO_BASE}${path}`

  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers: HEADERS })
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} at page ${pageNum} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (!res.ok) throw new Error(`SSO HTTP ${res.status} at page ${pageNum}`)
      return await res.text()
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Network error page ${pageNum}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at page ${pageNum}`)
}

// ── HTML parsing ───────────────────────────────────────────────────────────────

function parseTotalPages(html: string): number {
  const m = html.match(/of (\d+)/)
  return m ? parseInt(m[1], 10) : 1
}

function parseTotalResults(html: string): number {
  const m = html.match(/(\d+) results/)
  return m ? parseInt(m[1], 10) : 0
}

function parseActsFromHtml(html: string, verbose: boolean): CandidateRecord[] {
  const records: CandidateRecord[] = []
  const seen = new Set<string>()

  const linkRe = /href="\/Act\/([^"?]+)"[^>]*>([^<]+)</g
  let m: RegExpExecArray | null

  while ((m = linkRe.exec(html)) !== null) {
    const actId = m[1].trim()
    const title = m[2].trim()

    if (!actId || !title || seen.has(actId)) continue
    seen.add(actId)

    // Extract year from title (e.g. "Accountants Act 2004" → 2004)
    const yearMatch = title.match(/\b(19|20)\d{2}\b/)
    if (!yearMatch) {
      if (verbose) console.log(`  Skip ${actId}: no year in title "${title}"`)
      continue
    }
    const year = parseInt(yearMatch[0], 10)
    const dateStr = `${year}-01-01`
    const enactedDate = new Date(`${dateStr}T00:00:00Z`)

    const externalId = `sg_act_${actId}`
    const sourceExternalId = `sg_act_source_${actId}`
    const sourceUrl = `${SSO_BASE}/Act/${actId}`

    records.push({
      actId,
      claimText: title,
      enactedYear: year,
      enactedDate,
      enactedDateStr: dateStr,
      sourceUrl,
      externalId,
      sourceExternalId,
      sourceName: `Singapore Statutes — ${title}`,
    })
  }

  return records
}

// ── Fetch all acts ─────────────────────────────────────────────────────────────

async function fetchAllActs(hardLimit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const allRecords: CandidateRecord[] = []
  const seenIds = new Set<string>()

  console.log('  Fetching page 1...')
  const html1 = await fetchBrowsePage(1)
  const totalResults = parseTotalResults(html1)
  const totalPages = parseTotalPages(html1)
  console.log(`  SSO reports ${totalResults} current Acts (${totalPages} pages at PageSize=${PAGE_SIZE})`)

  const page1Records = parseActsFromHtml(html1, verbose)
  for (const r of page1Records) {
    if (!seenIds.has(r.externalId)) {
      seenIds.add(r.externalId)
      allRecords.push(r)
      if (hardLimit > 0 && allRecords.length >= hardLimit) break
    }
  }

  if (hardLimit > 0 && allRecords.length >= hardLimit) return allRecords

  for (let page = 2; page <= totalPages; page++) {
    await sleep(PAGE_DELAY_MS)
    if (verbose) console.log(`  Fetching page ${page}/${totalPages}...`)
    else process.stdout.write(`  Fetching page ${page}/${totalPages}...\r`)

    const html = await fetchBrowsePage(page)
    const pageRecords = parseActsFromHtml(html, verbose)

    for (const r of pageRecords) {
      if (!seenIds.has(r.externalId)) {
        seenIds.add(r.externalId)
        allRecords.push(r)
        if (hardLimit > 0 && allRecords.length >= hardLimit) break
      }
    }

    if (hardLimit > 0 && allRecords.length >= hardLimit) break
  }

  if (!verbose) process.stdout.write('\n')
  return allRecords
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
        claimEmergedPrecision: 'YEAR',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          actId: rec.actId,
          enactedYear: rec.enactedYear,
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

  console.log(`\n── ${PIPELINE}: Singapore Statutes Online ─────────────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicId = await ensureTopic('sg-statutes', 'Singapore Statutes Online', 'government')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching current Acts from SSO...')
  const candidates = await fetchAllActs(limit, verbose)
  console.log(`\nTotal candidates: ${candidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = candidates.slice(0, 15).map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      actId: r.actId,
      enactedYear: r.enactedYear,
      enactedDate: r.enactedDateStr,
      sourceUrl: r.sourceUrl,
      sourceName: r.sourceName,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedPrecision: 'YEAR',
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

    fs.writeFileSync('pipeline-30-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-30-dry-run-sample.json')

    if (candidates.length > 0) {
      console.log('\nSample titles:')
      candidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.enactedYear}] ${r.claimText.slice(0, 110)}${r.claimText.length > 110 ? '…' : ''}`)
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

    if (i + BATCH < rows.length) await sleep(PAGE_DELAY_MS)
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
