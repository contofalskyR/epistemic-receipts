// Pipeline 56 — European Parliament Adopted Texts (eu_parliament_v1)
// Dataset: EP Open Data Portal v2 API. Free, no API key required.
// Scope: All EP adopted texts (resolutions, legislative positions, formal decisions)
//        via data.europarl.europa.eu/api/v2/adopted-texts.
//        Distinct from P16 (eu_legislation_v1) which covers EUR-Lex Council/Commission legislation.
// Run: npx tsx scripts/ingest-eu-parliament.ts --dry-run
//      npx tsx scripts/ingest-eu-parliament.ts --sample 10
//      npx tsx scripts/ingest-eu-parliament.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'eu_parliament_v1'
const PIPELINE = 'Pipeline 56'
const API_BASE = 'https://data.europarl.europa.eu/api/v2/adopted-texts'
const PAGE_SIZE = 100
const PAGE_DELAY_MS = 500
const ENG_LANG_URI = 'http://publications.europa.eu/resource/authority/language/ENG'

// ── Types ──────────────────────────────────────────────────────────────────────

interface EPExpression {
  id: string
  type: string
  language: string
  title?: Record<string, string>
  title_alternative?: Record<string, string>
}

interface EPAdoptedText {
  id: string
  type: string
  document_date: string
  parliamentary_term?: string
  work_type?: string
  is_realized_by?: EPExpression[]
}

interface EPResponse {
  data: EPAdoptedText[]
  meta: { total: number }
}

interface CandidateRecord {
  eliId: string
  docRef: string
  title: string
  titleAlternative: string | null
  adoptedDate: Date
  adoptedDateStr: string
  parliamentaryTerm: string | null
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
          'Accept': 'application/ld+json',
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

async function fetchPage(offset: number, retries = 4, timeoutMs = 30_000): Promise<EPResponse> {
  const url = `${API_BASE}?limit=${PAGE_SIZE}&offset=${offset}`
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, timeoutMs)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} offset=${offset} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status} for offset=${offset}`)
      return JSON.parse(res.body) as EPResponse
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Fetch error offset=${offset}: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries at offset=${offset}`)
}

// ── Parse EP record ────────────────────────────────────────────────────────────

function extractDocRef(eliId: string): string {
  // eli/dl/doc/TA-9-2022-0040 → TA-9-2022-0040
  const parts = eliId.split('/')
  return parts[parts.length - 1] ?? eliId
}

function extractTerm(termUri: string | undefined): string | null {
  if (!termUri) return null
  // org/ep-9 → EP-9 / org/ep-10 → EP-10
  const m = termUri.match(/ep-(\d+)/)
  return m ? `EP-${m[1]}` : null
}

function toCandidate(item: EPAdoptedText): CandidateRecord | null {
  const dateStr = item.document_date?.slice(0, 10) ?? ''
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return null
  const adoptedDate = new Date(dateStr + 'T00:00:00Z')
  if (isNaN(adoptedDate.getTime())) return null

  const enExpr = item.is_realized_by?.find(e => e.language === ENG_LANG_URI)
  const title = enExpr?.title?.en?.trim() ?? ''
  if (!title) return null

  const docRef = extractDocRef(item.id)
  const sourceUrl = `https://www.europarl.europa.eu/doceo/document/${docRef}_EN.html`

  return {
    eliId: item.id,
    docRef,
    title,
    titleAlternative: enExpr?.title_alternative?.en?.trim() ?? null,
    adoptedDate,
    adoptedDateStr: dateStr,
    parliamentaryTerm: extractTerm(item.parliamentary_term),
    externalId: `ep_adopted_${docRef}`,
    sourceExternalId: `ep_src_${docRef}`,
    sourceUrl,
    sourceName: `European Parliament — ${docRef}`,
  }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  console.log('  Fetching first page to get total...')
  const first = await fetchPage(0)
  const total = first.meta.total
  console.log(`  Total EP adopted texts: ${total}`)

  const candidates: CandidateRecord[] = []
  let malformed = 0

  const processPage = (page: EPResponse) => {
    for (const item of page.data) {
      const rec = toCandidate(item)
      if (!rec) { malformed++; continue }
      candidates.push(rec)
      if (limit > 0 && candidates.length >= limit) return true
    }
    return false
  }

  if (processPage(first)) return candidates

  const pages = Math.ceil(total / PAGE_SIZE)
  for (let p = 1; p < pages; p++) {
    await sleep(PAGE_DELAY_MS)
    const page = await fetchPage(p * PAGE_SIZE)
    if (verbose) process.stdout.write(`  Page ${p + 1}/${pages} (${candidates.length} so far)...\r`)
    if (processPage(page)) break
  }

  if (verbose) console.log()
  console.log(`    ${candidates.length} candidates, ${malformed} dropped (no EN title or bad date)`)
  candidates.sort((a, b) => b.adoptedDateStr.localeCompare(a.adoptedDateStr))
  return candidates
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
        publishedAt: rec.adoptedDate,
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
        claimEmergedAt: rec.adoptedDate,
        claimEmergedPrecision: 'DAY',
        ingestedBy: INGESTED_BY,
        autoApproved: true,
        humanReviewed: false,
        externalId: rec.externalId,
        metadata: {
          dataset: INGESTED_BY,
          docRef: rec.docRef,
          eliId: rec.eliId,
          titleAlternative: rec.titleAlternative,
          parliamentaryTerm: rec.parliamentaryTerm,
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

  console.log(`\n── ${PIPELINE}: European Parliament Adopted Texts ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic('eu-parliament', 'European Parliament', 'government', 'gov-region-europe')
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching EP adopted texts from data.europarl.europa.eu...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      title: r.title,
      externalId: r.externalId,
      docRef: r.docRef,
      parliamentaryTerm: r.parliamentaryTerm,
      adoptedDate: r.adoptedDateStr,
      sourceUrl: r.sourceUrl,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byTerm: Record<string, number> = {}
    const byYear: Record<string, number> = {}
    for (const r of allCandidates) {
      const term = r.parliamentaryTerm ?? 'unknown'
      byTerm[term] = (byTerm[term] ?? 0) + 1
      const year = r.adoptedDateStr.slice(0, 4)
      byYear[year] = (byYear[year] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byParliamentaryTerm: byTerm, byYear: byYear },
      sample,
    }

    fs.writeFileSync('pipeline-56-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-56-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by parliamentary term:')
      for (const [k, v] of Object.entries(byTerm).sort()) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nSample titles (newest first):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.adoptedDateStr}] ${r.title.slice(0, 110)}${r.title.length > 110 ? '…' : ''}`)
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
