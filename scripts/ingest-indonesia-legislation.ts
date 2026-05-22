// Pipeline 90 — Indonesia Acts/UU (indonesia_legislation_v1)
// Dataset: JDIH Nasional — peraturan.go.id (Indonesian National Legislation Information Network)
// Source: peraturan.go.id JSON API — UU (Undang-Undang / Acts of Parliament)
// Run: npx tsx scripts/ingest-indonesia-legislation.ts --dry-run
//      npx tsx scripts/ingest-indonesia-legislation.ts --sample 10
//      npx tsx scripts/ingest-indonesia-legislation.ts --full [--limit N] [--verbose]
//
// NOTE: peraturan.go.id (103.145.96.87) times out from non-Indonesian IPs.
// Run this script from an Indonesian IP or via a server in-region.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as https from 'https'

const prisma = new PrismaClient()

const INGESTED_BY = 'indonesia_legislation_v1'
const PIPELINE = 'Pipeline 90'
const SOURCE_URL = 'https://peraturan.go.id/'
const API_BASE = 'https://peraturan.go.id/api/peraturan'
const REQUEST_DELAY_MS = 1000
const PER_PAGE = 100

// ── Types ──────────────────────────────────────────────────────────────────────

interface PeraturanRecord {
  id?: number | string
  jenis?: string
  nomor?: string        // law number, e.g. "13"
  tahun?: string | number  // year, e.g. "2003"
  judul?: string        // Indonesian title
  tanggal_penetapan?: string   // date enacted
  tanggal_pengundangan?: string
  status?: string       // "berlaku" (in force) or "tidak berlaku" (repealed)
  sumber?: string       // e.g. "LN Tahun 2003 Nomor 39"
  bidang?: string       // subject area
  url?: string          // canonical URL on peraturan.go.id
  singkatan?: string    // short title
}

interface PeraturanPage {
  data: PeraturanRecord[]
  total?: number
  per_page?: number
  current_page?: number
  last_page?: number
  // alternate shape used by some peraturan.go.id endpoints:
  recordsTotal?: number
  recordsFiltered?: number
  rows?: PeraturanRecord[]
}

interface CandidateRecord {
  uuNo: string          // e.g. "UU No. 13 Tahun 2003"
  title: string         // Indonesian title
  year: number
  status: 'Berlaku' | 'Tidak Berlaku' | 'Unknown'
  externalId: string
  sourceExternalId: string
  canonicalUrl: string
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
          'Accept': 'application/json, */*',
          'Accept-Language': 'id,en;q=0.9',
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

function normalizeTitle(judul: string): string {
  return judul.replace(/\s+/g, ' ').trim()
}

function extractYear(r: PeraturanRecord): number {
  if (r.tahun) {
    const y = parseInt(String(r.tahun), 10)
    if (!isNaN(y) && y > 1900 && y <= 2030) return y
  }
  if (r.tanggal_penetapan) {
    const m = r.tanggal_penetapan.match(/^(\d{4})/)
    if (m) return parseInt(m[1], 10)
  }
  if (r.judul) {
    const m = r.judul.match(/\bTahun\s+(\d{4})\b/i) ?? r.judul.match(/\b(19\d{2}|20\d{2})\b/)
    if (m) return parseInt(m[1], 10)
  }
  return new Date().getFullYear()
}

function extractStatus(r: PeraturanRecord): 'Berlaku' | 'Tidak Berlaku' | 'Unknown' {
  const s = (r.status ?? '').toLowerCase()
  if (s.includes('tidak berlaku') || s.includes('dicabut') || s.includes('diganti')) return 'Tidak Berlaku'
  if (s.includes('berlaku')) return 'Berlaku'
  return 'Unknown'
}

function buildUuNo(r: PeraturanRecord): string {
  const nomor = r.nomor?.trim() ?? ''
  const tahun = r.tahun ? String(r.tahun).trim() : ''
  if (nomor && tahun) return `UU No. ${nomor} Tahun ${tahun}`
  if (nomor) return `UU No. ${nomor}`
  return 'UU'
}

function buildCanonicalUrl(r: PeraturanRecord): string {
  if (r.url) {
    const u = r.url.trim()
    return u.startsWith('http') ? u : `${SOURCE_URL.replace(/\/$/, '')}/${u.replace(/^\//, '')}`
  }
  const nomor = r.nomor?.trim() ?? ''
  const tahun = r.tahun ? String(r.tahun).trim() : ''
  if (nomor && tahun) {
    const slug = `uu-nomor-${nomor}-tahun-${tahun}`
    return `https://peraturan.go.id/id/${slug}`
  }
  return SOURCE_URL
}

function buildExternalId(r: PeraturanRecord): string {
  const nomor = (r.nomor ?? '').trim().replace(/\s+/g, '-').toLowerCase()
  const tahun = r.tahun ? String(r.tahun).trim() : 'unknown'
  if (nomor && tahun !== 'unknown') return `id_uu_${nomor}_${tahun}`
  if (r.id) return `id_uu_${r.id}`
  // last resort: hash of title
  const title = (r.judul ?? '').slice(0, 40).toLowerCase().replace(/[^a-z0-9]+/g, '_')
  return `id_uu_${title}`
}

function fromRecord(r: PeraturanRecord): CandidateRecord | null {
  const judul = r.judul?.trim()
  if (!judul) return null

  const year = extractYear(r)
  const uuNo = buildUuNo(r)
  const externalId = buildExternalId(r)
  const canonicalUrl = buildCanonicalUrl(r)
  const status = extractStatus(r)
  const publishedAt = new Date(`${year}-01-01T00:00:00Z`)

  return {
    uuNo,
    title: normalizeTitle(judul),
    year,
    status,
    externalId,
    sourceExternalId: `${externalId}_src`,
    canonicalUrl,
    publishedAt,
  }
}

// Normalise the two known shapes of the peraturan.go.id paginated API response.
function extractRecords(raw: PeraturanPage): { records: PeraturanRecord[]; total: number; lastPage: number } {
  const records: PeraturanRecord[] = raw.data ?? raw.rows ?? []
  const total = raw.total ?? raw.recordsTotal ?? records.length
  const lastPage = raw.last_page ?? (raw.per_page ? Math.ceil(total / raw.per_page) : 1)
  return { records, total, lastPage }
}

// ── Fetch all candidates ───────────────────────────────────────────────────────

async function fetchAllCandidates(limit: number, verbose: boolean): Promise<CandidateRecord[]> {
  const candidates: CandidateRecord[] = []
  const seenIds = new Set<string>()

  // First page to discover total / last_page
  console.log(`  Fetching page 1 of UU records from ${API_BASE}...`)
  const firstUrl = `${API_BASE}?jenis=uu&page=1&per_page=${PER_PAGE}`
  const firstRaw = await fetchJson(firstUrl) as PeraturanPage
  const { records: firstRecords, total, lastPage } = extractRecords(firstRaw)

  console.log(`  Total UU records reported: ${total} (${lastPage} pages of ${PER_PAGE})`)

  for (const r of firstRecords) {
    const rec = fromRecord(r)
    if (!rec || seenIds.has(rec.externalId)) continue
    seenIds.add(rec.externalId)
    candidates.push(rec)
    if (limit > 0 && candidates.length >= limit) return candidates
  }

  for (let page = 2; page <= lastPage; page++) {
    await sleep(REQUEST_DELAY_MS)
    const url = `${API_BASE}?jenis=uu&page=${page}&per_page=${PER_PAGE}`
    if (verbose) console.log(`  Fetching page ${page}/${lastPage}...`)
    else process.stdout.write(`  Fetching page ${page}/${lastPage}...\r`)

    const raw = await fetchJson(url) as PeraturanPage
    const { records } = extractRecords(raw)

    for (const r of records) {
      const rec = fromRecord(r)
      if (!rec || seenIds.has(rec.externalId)) continue
      seenIds.add(rec.externalId)
      candidates.push(rec)
      if (limit > 0 && candidates.length >= limit) return candidates
    }
  }

  if (!verbose) console.log()
  console.log(`  ${candidates.length} total candidates`)
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
        name: `Indonesia JDIH — ${rec.title.slice(0, 100)}`,
        url: rec.canonicalUrl,
        publishedAt: rec.publishedAt,
        methodologyType: 'primary',
        ingestedBy: INGESTED_BY,
      },
    })

    const claimText = `Indonesia enacted ${rec.title} (${rec.year})`

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
          uuNo: rec.uuNo,
          title: rec.title,
          status: rec.status,
          year: rec.year,
          country: 'Indonesia',
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

// ── ALLOW_EDITS guard ──────────────────────────────────────────────────────────

function requireAllowEdits() {
  if (process.env.ALLOW_EDITS !== 'true') {
    console.error('Set ALLOW_EDITS=true to run --sample or --full modes.')
    process.exit(1)
  }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, sampleN, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: Indonesia Acts (UU) ─────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  let topicId = ''
  if (mode !== 'dry-run') {
    requireAllowEdits()
    console.log('\nStep 1: Ensuring topic...')
    topicId = await ensureTopic(
      'indonesia-dpr',
      'DPR Indonesia',
      'government',
      'gov-region-asia-pacific',
    )
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  console.log('\nStep 2: Fetching Indonesian UU from peraturan.go.id...')
  const allCandidates = await fetchAllCandidates(limit, verbose)
  console.log(`\nTotal candidates: ${allCandidates.length}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.slice(0, 15).map(r => ({
      uuNo: r.uuNo,
      title: r.title,
      status: r.status,
      year: r.year,
      externalId: r.externalId,
      claimText: `Indonesia enacted ${r.title} (${r.year})`,
      sourceUrl: r.canonicalUrl,
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

    fs.writeFileSync('pipeline-90-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-90-dry-run-sample.json')

    if (allCandidates.length > 0) {
      console.log('\nDistribution by status:')
      for (const [k, v] of Object.entries(byStatus)) console.log(`  ${k}: ${v}`)
      console.log('\nDistribution by decade:')
      for (const [k, v] of Object.entries(byDecade).sort()) console.log(`  ${k}: ${v}`)
      console.log('\nSample (first 5):')
      allCandidates.slice(0, 5).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.year}] ${r.uuNo}: ${r.title.slice(0, 80)}${r.title.length > 80 ? '…' : ''} (${r.status})`)
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
