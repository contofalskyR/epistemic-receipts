// Pipeline 62 — Malaysia Acts (malaysia_legislation_v1)
// Dataset: Attorney General Chambers, Laws of Malaysia (lom.agc.gov.my)
// Source: JSON-backed DataTables API — updated (in-force) + repealed acts
// Run: npx tsx scripts/ingest-malaysia-legislation.ts --dry-run
//      npx tsx scripts/ingest-malaysia-legislation.ts --sample 10
//      npx tsx scripts/ingest-malaysia-legislation.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'malaysia_legislation_v1'
const PIPELINE = 'Pipeline 62'
const SOURCE_URL = 'https://lom.agc.gov.my/'
const JSON_UPDATED_URL = 'https://lom.agc.gov.my/json-updated-2024.php'
const JSON_REPEALED_URL = 'https://lom.agc.gov.my/json-repealed-2024.php'
const REQUEST_DELAY_MS = 1000

// ── Types ──────────────────────────────────────────────────────────────────────

interface MalaysiaUpdatedRecord {
  lgt_act_id: string
  lgt_act_no: string
  lgt_log_type: string
  title: string          // HTML with act title and links
  doc2download?: string
}

interface MalaysiaRepealedRecord {
  ILA_ACT_NO: string
  TITLEBI: string        // English title, plain text
  TITLEBM?: string
  REPEALEDBY?: string
  REPEALTITLEBI?: string
}

interface CandidateRecord {
  actNo: string
  title: string
  status: 'In Force' | 'Repealed'
  year: number
  externalId: string
  sourceExternalId: string
  actDetailUrl: string
  publishedAt: Date
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
          'Accept': 'application/json, text/html, */*',
          'Accept-Language': 'en-US,en;q=0.9',
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

async function fetchJson(url: string, retries = 3): Promise<unknown> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await httpsGet(url, 30_000)
      if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
        console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
        await sleep(delay)
        delay *= 2
        continue
      }
      if (res.status !== 200) throw new Error(`HTTP ${res.status}`)
      return JSON.parse(res.body)
    } catch (err) {
      if (attempt >= retries) throw err
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`  Error: ${msg} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
    }
  }
  throw new Error(`Failed after ${retries} retries`)
}

// ── Parsing ────────────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Extract English (BI) act title from HTML title field.
// HTML contains: <a href="act-detail.php?act=N&lang=BI&date=...">TITLE</a>
function extractEnglishTitle(titleHtml: string): string {
  const biMatch = titleHtml.match(/lang=BI[^>]*>([^<]+)<\/a>/)
  if (biMatch) return biMatch[1].replace(/\s+/g, ' ').trim()
  // Fallback: first anchor text that looks like an English title (uppercase)
  const anyMatch = titleHtml.match(/>([A-Z][^<]{3,})<\/a>/)
  if (anyMatch) return anyMatch[1].replace(/\s+/g, ' ').trim()
  return stripHtml(titleHtml).split('\n')[0].replace(/\s+/g, ' ').trim()
}

// Extract the original enactment year from the act title text.
// Uses the year embedded in the act name (e.g. "ACT 1914"), ignoring "(REVISED—YYYY)" parentheticals.
function extractYearFromTitle(titleText: string): number {
  // Strip parenthetical revisions so "AUCTIONEERS ACT 1914 (REVISED—2026)" → "AUCTIONEERS ACT 1914"
  const mainPart = titleText.replace(/\s*\([^)]*\)/g, '').replace(/\s*\[[^\]]*\]/g, '').trim()
  const m = mainPart.match(/\b(19\d{2}|20\d{2})\b/)
  if (m) return parseInt(m[1], 10)
  // Fallback: any year in the full title
  const anyM = titleText.match(/\b(19\d{2}|20\d{2})\b/)
  return anyM ? parseInt(anyM[1], 10) : new Date().getFullYear()
}

function extractActDetailUrl(titleHtml: string, actNo: string): string {
  const hrefMatch = titleHtml.match(/href="(act-detail\.php[^"]+lang=BI[^"]+)"/)
  if (hrefMatch) return `https://lom.agc.gov.my/${hrefMatch[1]}`
  return `https://lom.agc.gov.my/act-detail.php?act=${encodeURIComponent(actNo)}&lang=BI`
}

function slugifyActNo(actNo: string): string {
  return actNo.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function fromUpdatedRecord(
  r: MalaysiaUpdatedRecord,
  repealedActNos: Set<string>,
): CandidateRecord | null {
  const actNo = r.lgt_act_no?.trim()
  if (!actNo) return null

  const title = extractEnglishTitle(r.title ?? '')
  if (!title) return null

  const year = extractYearFromTitle(title)
  const publishedAt = new Date(`${year}-01-01T00:00:00Z`)
  const actDetailUrl = extractActDetailUrl(r.title ?? '', actNo)
  const status: 'In Force' | 'Repealed' = repealedActNos.has(actNo) ? 'Repealed' : 'In Force'

  const slug = slugifyActNo(actNo)
  return {
    actNo: `ACT ${actNo}`,
    title,
    status,
    year,
    externalId: `my_act_${slug}`,
    sourceExternalId: `my_act_src_${slug}`,
    actDetailUrl,
    publishedAt,
  }
}

function fromRepealedRecord(r: MalaysiaRepealedRecord): CandidateRecord | null {
  const actNo = r.ILA_ACT_NO?.trim()
  const title = r.TITLEBI?.trim()
  if (!actNo || !title) return null

  const year = extractYearFromTitle(title)
  const publishedAt = new Date(`${year}-01-01T00:00:00Z`)

  const slug = slugifyActNo(actNo)
  return {
    actNo: `ACT ${actNo}`,
    title,
    status: 'Repealed',
    year,
    externalId: `my_act_${slug}`,
    sourceExternalId: `my_act_src_${slug}`,
    actDetailUrl: `https://lom.agc.gov.my/act-detail.php?act=${encodeURIComponent(actNo)}&lang=BI`,
    publishedAt,
  }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  // Pre-load repealed act numbers so we can set status correctly when processing updated list.
  // Many acts appear in both lists (same act number); repealed list takes precedence for status.
  console.log('  Pre-loading repealed act numbers (json-repealed-2024.php)...')
  const repealedData = await fetchJson(JSON_REPEALED_URL) as {
    recordsTotal: number
    records: MalaysiaRepealedRecord[]
  }
  const repealedActNos = new Set<string>(
    repealedData.records.map(r => r.ILA_ACT_NO?.trim()).filter(Boolean) as string[]
  )
  console.log(`    ${repealedData.recordsTotal} repealed acts (${repealedActNos.size} unique act numbers)`)

  await sleep(REQUEST_DELAY_MS)

  // --- Updated list (all principal acts, with correct status applied from repealed set) ---
  console.log('  Fetching principal acts (json-updated-2024.php)...')
  const updatedData = await fetchJson(JSON_UPDATED_URL) as {
    recordsTotal: number
    records: MalaysiaUpdatedRecord[]
  }
  console.log(`    ${updatedData.recordsTotal} acts returned`)

  for (const r of updatedData.records) {
    const rec = fromUpdatedRecord(r, repealedActNos)
    if (!rec) continue
    if (seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) return candidates
  }

  // Add any repealed acts whose act number was not present in the updated list
  for (const r of repealedData.records) {
    const rec = fromRepealedRecord(r)
    if (!rec) continue
    if (seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) return candidates
  }

  if (verbose) console.log()
  console.log(`    ${candidates.length} total candidates`)
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
        name: `Malaysia Laws — ${rec.title.slice(0, 100)}`,
        url: rec.actDetailUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Malaysia enacted ${rec.title} (${rec.actNo}) — ${rec.status}.`

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
          actNumber: rec.actNo,
          title: rec.title,
          status: rec.status,
          year: rec.year,
          country: 'Malaysia',
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

  console.log(`\n── ${PIPELINE}: Malaysia Acts ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic(
      'parliament-of-malaysia',
      'Parliament of Malaysia',
      'government',
      'gov-region-asia-pacific',
    )
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Malaysia acts from lom.agc.gov.my...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      actNo: r.actNo,
      title: r.title,
      status: r.status,
      year: r.year,
      externalId: r.externalId,
      claimText: `Malaysia enacted ${r.title} (${r.actNo}) — ${r.status}.`,
      sourceUrl: r.actDetailUrl,
      publishedAt: r.publishedAt.toISOString().slice(0, 10),
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
    }))

    const byStatus: Record<string, number> = {}
    const byDecade: Record<string, number> = {}
    for (const r of allCandidates) {
      byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
      const decade = Math.floor(r.year / 10) * 10 + 's'
      byDecade[decade] = (byDecade[decade] ?? 0) + 1
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: PIPELINE,
      ingestedBy: INGESTED_BY,
      totalCandidates: allCandidates.length,
      distribution: { byStatus, byDecade },
      sample,
    }

    fs.writeFileSync('pipeline-62-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-62-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by status:')
      for (const [k, v] of Object.entries(byStatus)) {
        console.log(`  ${k}: ${v}`)
      }
      console.log('\nSample (first 5):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year}] ${r.actNo}: ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''} (${r.status})`)
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
