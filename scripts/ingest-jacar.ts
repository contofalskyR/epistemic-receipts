// Pipeline 120 — Japan Center for Asian Historical Records (JACAR)
// Dataset: jacar.archives.go.jp — no auth required; HTML scraping via server-rendered pages.
// Scope: WWII military (C series, inst=03) and diplomatic cables (B series, inst=02), 1931–1945.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-jacar.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-jacar.ts --full [--limit N] [--verbose] [--fetch-details]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'jacar_v1'
const JACAR_BASE = 'https://www.jacar.archives.go.jp'
const SEARCH_URL = `${JACAR_BASE}/aj/search-en`
const DETAIL_BASE = `${JACAR_BASE}/das/meta-en`

// B series (Diplomatic Archives) + C series (National Institute for Defense Studies)
const TARGET_FONDS = ['BA0000000000', 'CA0000000000']
const DATE_FROM = 1931
const DATE_TO = 1945
const PAGE_SIZE = 100
const THROTTLE_MS = 900
const DRY_RUN_SAMPLE_COUNT = 20

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface ListItem {
  refCode: string
  title: string
  institution: string
}

interface JacarRecord {
  refCode: string
  externalId: string
  sourceUrl: string
  title: string
  date: Date | null
  datePrecision: string | null
  rawDate: string | null
  description: string | null
  institution: string
  language: string | null
  creator: string | null
  classification: string | null
  series: 'B' | 'C' | 'other'
  claimText: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--limit N] [--verbose] [--fetch-details]')
    process.exit(1)
  }

  const mode = args.includes('--full') ? 'full' : 'dry-run'

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const li = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'full',
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
    fetchDetails: args.includes('--fetch-details'),
  }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function jacarFetch(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'text/html,application/xhtml+xml',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (res.status === 400) throw new Error(`JACAR 400 Bad Request at ${url}`)
    if (!res.ok) throw new Error(`JACAR HTTP ${res.status} at ${url}`)
    return res.text()
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── HTML parsing ──────────────────────────────────────────────────────────────

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim()
}

function extractSearchItems(html: string): ListItem[] {
  const itemPattern = /<li class="archive-result-table__body-item".*?<\/li>/gs
  const items: ListItem[] = []

  for (const item of html.matchAll(itemPattern)) {
    const block = item[0]

    const refMatch = block.match(/name="id" value="aj11\/([^"]+)"/)
    if (!refMatch) continue
    const refCode = refMatch[1]

    // Title: first <span> text inside result-header__title h3
    const titleBlock = block.match(/result-header__title[^>]*>(.*?)<\/h3>/s)
    const titleSpans = titleBlock ? [...titleBlock[1].matchAll(/<span[^>]*>\s*([^<\s][^<]*?)\s*<\/span>/g)].map(m => m[1].trim()).filter(Boolean) : []
    const title = titleSpans.length > 0 ? titleSpans.join(' ') : ''
    if (!title) continue

    // Institution from result-tree
    const treeLabels = [...block.matchAll(/result-tree__item-label[^>]*>(.*?)<\/span>/gs)]
    const treeClean = treeLabels.map(m => stripTags(m[1])).filter(Boolean)
    const institution = treeClean[0] ?? ''

    items.push({ refCode, title: stripTags(title), institution })
  }

  return items
}

function extractTotalCount(html: string): number {
  const m = html.match(/data-count="(\d+)"/)
  return m ? parseInt(m[1], 10) : 0
}

// Japanese era year offset map (era name → Gregorian year when era started)
const ERA_OFFSETS: Record<string, number> = {
  meiji: 1867,    // Meiji 1 = 1868 → offset 1867
  taisho: 1911,   // Taisho 1 = 1912
  showa: 1925,    // Showa 1 = 1926
  heisei: 1988,   // Heisei 1 = 1989
}

// Convert full-width digits to ASCII
function fullWidthToAscii(s: string): string {
  return s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFF10 + 0x30))
}

function parseJapaneseDate(raw: string | null): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }

  const normalized = fullWidthToAscii(raw)

  // Match: "Showa20年7月30日" or "Showa２０年" or "Meiji32年9月"
  const eraPattern = /(meiji|taisho|showa|heisei)\s*(\d+)年(?:\s*(\d+)月)?(?:\s*(\d+)日)?/i
  const m = normalized.match(eraPattern)
  if (m) {
    const era = m[1].toLowerCase()
    const offset = ERA_OFFSETS[era]
    if (offset === undefined) return { date: null, precision: null }
    const year = parseInt(m[2], 10) + offset
    const month = m[3] ? parseInt(m[3], 10) : null
    const day = m[4] ? parseInt(m[4], 10) : null

    if (month && day) {
      const d = new Date(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00Z`)
      return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
    }
    if (month) {
      const d = new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00Z`)
      return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
    }
    const d = new Date(`${year}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  // Fallback: Gregorian YYYY or YYYY-MM-DD
  const yearMatch = normalized.match(/^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/)
  if (yearMatch) {
    const year = yearMatch[1]
    const month = yearMatch[2]
    const day = yearMatch[3]
    if (month && day) {
      const d = new Date(`${year}-${month}-${day}T00:00:00Z`)
      return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'DAY' }
    }
    if (month) {
      const d = new Date(`${year}-${month}-01T00:00:00Z`)
      return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'MONTH' }
    }
    const d = new Date(`${year}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? { date: null, precision: null } : { date: d, precision: 'YEAR' }
  }

  return { date: null, precision: null }
}

interface DetailData {
  rawDate: string | null
  date: Date | null
  datePrecision: string | null
  description: string | null
  language: string | null
  creator: string | null
  classification: string | null
}

function extractDetailFields(html: string): DetailData {
  const pairs = [...html.matchAll(/<dt[^>]*>\s*([^<]+?)\s*<\/dt>\s*<dd[^>]*>(.*?)<\/dd>/gs)]
  const fields: Record<string, string> = {}
  for (const [, label, val] of pairs) {
    fields[label.trim()] = stripTags(val)
  }

  // Date: use the "from" portion of a range
  const rawDateFull = fields['Date of Document Creation'] ?? null
  const rawDate = rawDateFull ? rawDateFull.split('～')[0].trim() : null
  const { date, precision } = parseJapaneseDate(rawDate)

  // Description: Contents field or call number (max 500 chars)
  const description = (fields['Contents'] ?? fields['Call Number in Holding Institution'] ?? null)
    ?.trim().slice(0, 500) ?? null

  return {
    rawDate,
    date,
    datePrecision: precision,
    description,
    language: fields['Language'] ?? null,
    creator: fields['Creator']?.slice(0, 500) ?? null,
    classification: fields['Classification Levels'] ?? null,
  }
}

// ── Build candidate ───────────────────────────────────────────────────────────

function buildCandidate(item: ListItem, detail: DetailData | null): JacarRecord {
  const series = item.refCode.startsWith('B') ? 'B' : item.refCode.startsWith('C') ? 'C' : 'other'
  const externalId = `jacar_${item.refCode}`
  const sourceUrl = `${DETAIL_BASE}/${item.refCode}`

  const seriesLabel = series === 'B'
    ? 'Diplomatic Archives'
    : series === 'C'
    ? 'Ministry of Defense Records'
    : 'JACAR'

  const suffix = item.institution ? ` — ${seriesLabel}, ${item.institution}` : ` — ${seriesLabel}`
  const claimText = `"${item.title}"${suffix}`

  return {
    refCode: item.refCode,
    externalId,
    sourceUrl,
    title: item.title,
    date: detail?.date ?? null,
    datePrecision: detail?.datePrecision ?? null,
    rawDate: detail?.rawDate ?? null,
    description: detail?.description ?? (item.institution ? item.institution.slice(0, 500) : null),
    institution: item.institution,
    language: detail?.language ?? null,
    creator: detail?.creator ?? null,
    classification: detail?.classification ?? null,
    series,
    claimText,
  }
}

// ── Fetch all records via search pagination ───────────────────────────────────

function buildSearchUrl(page: number): string {
  const params = new URLSearchParams({ type: 'aj23', rows: String(PAGE_SIZE), page: String(page), date_y_from: String(DATE_FROM), date_y_to: String(DATE_TO) })
  for (const fond of TARGET_FONDS) params.append('fond', fond)
  return `${SEARCH_URL}?${params}`
}

async function fetchListPage(page: number): Promise<{ items: ListItem[]; total: number }> {
  const url = buildSearchUrl(page)
  const html = await jacarFetch(url)
  return { items: extractSearchItems(html), total: extractTotalCount(html) }
}

async function fetchDetailPage(refCode: string): Promise<DetailData> {
  const html = await jacarFetch(`${DETAIL_BASE}/${refCode}`)
  return extractDetailFields(html)
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }
  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: JacarRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existingSource = await tx.source.findFirst({
    where: { url: rec.sourceUrl },
    select: { id: true },
  })
  if (existingSource) return 'skipped'

  const existingClaim = await tx.claim.findUnique({
    where: { externalId: rec.externalId },
    select: { id: true },
  })
  if (existingClaim) return 'skipped'

  const source = await tx.source.create({
    data: {
      name: rec.title.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `jacar_source_${rec.refCode}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.date ?? null,
      claimEmergedPrecision: rec.datePrecision ?? null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        refCode: rec.refCode,
        series: rec.series,
        institution: rec.institution,
        language: rec.language,
        creator: rec.creator,
        classification: rec.classification,
        rawDate: rec.rawDate,
      },
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'EVIDENTIARY',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 90,
      reason: 'JACAR — Japan Center for Asian Historical Records, primary archival document, HARD_FACT',
      changedAt: rec.date ?? new Date(),
    },
  })

  for (const topicId of topicIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId: claim.id, topicId } },
      update: {},
      create: { claimId: claim.id, topicId },
    })
  }

  return 'ingested'
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose, fetchDetails } = parseArgs()

  console.log(`\n── Pipeline 120: JACAR — Japan Center for Asian Historical Records ────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | FetchDetails: ${fetchDetails}`)
  console.log(`Scope: B+C series, ${DATE_FROM}–${DATE_TO}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing search endpoint and sampling list items (no DB writes)...')

    const { items: firstPageItems, total } = await fetchListPage(1)
    const sample = firstPageItems.slice(0, DRY_RUN_SAMPLE_COUNT)

    console.log(`\n  Total records from search API: ${total}`)
    console.log(`  Items on first page: ${firstPageItems.length}`)

    // Fetch detail pages for sample
    console.log(`\nStep 2: Fetching detail pages for ${sample.length} sample records...`)
    const candidates: JacarRecord[] = []
    for (const item of sample) {
      console.log(`  Fetching detail: ${item.refCode} — ${item.title.slice(0, 60)}`)
      const detail = await fetchDetailPage(item.refCode)
      candidates.push(buildCandidate(item, detail))
    }

    console.log('\nSample records:')
    for (const r of candidates.slice(0, 15)) {
      console.log(`  [${r.refCode}] ${r.rawDate ?? 'no-date'} | ${r.series}-series | ${r.language ?? 'no-lang'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
      if (r.description) console.log(`    desc: ${r.description.slice(0, 100)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      searchBase: SEARCH_URL,
      targetFonds: TARGET_FONDS,
      dateRange: { from: DATE_FROM, to: DATE_TO },
      totalFromApi: total,
      sampleSize: candidates.length,
      sample: candidates.map(r => ({
        refCode: r.refCode,
        externalId: r.externalId,
        claimText: r.claimText,
        sourceUrl: r.sourceUrl,
        rawDate: r.rawDate,
        datePrecision: r.datePrecision,
        series: r.series,
        institution: r.institution,
        language: r.language,
        creator: r.creator,
        classification: r.classification,
        description: r.description,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-120-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-120-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic('jacar-japan', 'JACAR — Japan Center for Asian Historical Records', 'archives')

  console.log('\nStep 2: Fetching and ingesting records...')
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const startTime = Date.now()

  let page = 1
  let total = 0
  let fetched = 0

  while (true) {
    const { items, total: apiTotal } = await fetchListPage(page)
    if (page === 1) {
      total = apiTotal
      console.log(`  Total from API: ${total}`)
    }
    if (items.length === 0) break

    for (const item of items) {
      let detail: DetailData | null = null
      if (fetchDetails) {
        try {
          detail = await fetchDetailPage(item.refCode)
        } catch (e) {
          console.warn(`  Detail fetch failed: ${item.refCode} — ${e instanceof Error ? e.message : e}`)
        }
      }

      const rec = buildCandidate(item, detail)
      fetched++

      try {
        const result = await prisma.$transaction(
          async (tx) => writeRow(tx, rec, [rootTopicId]),
          { timeout: 30000 },
        )
        if (result === 'ingested') counts.ingested++
        else if (result === 'skipped') counts.skipped++
        else counts.errors++

        if (verbose || counts.ingested % 500 === 0) {
          console.log(`  Progress: ${counts.ingested}/${total} — ${rec.refCode} — ${rec.title.slice(0, 60)}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: ${rec.externalId} — ${msg}`)
        counts.errors++
      }

      if (limit > 0 && fetched >= limit) break
    }

    if (limit > 0 && fetched >= limit) break
    page++
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

  if (dbClaims !== counts.ingested) {
    console.warn(`  WARNING: DB count (${dbClaims}) != ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
