// Pipeline 118 — CIA FOIA Reading Room (CREST database)
// Dataset: www.cia.gov/readingroom — declassified CIA documents via FOIA
// Scope: MKULTRA mind control research, Cold War era intelligence
// Access: CIA site blocks all programmatic requests (Akamai bot protection).
//         This ingester uses Wayback Machine CDX API to discover archived
//         search-result pages and parses the HTML. The canonical sourceUrl
//         always points to the live CIA URL, not the Wayback snapshot.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cia-foia.ts --dry-run
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-cia-foia.ts --full [--query <term>] [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'cia_foia_v1'
const CIA_SEARCH_BASE = 'https://www.cia.gov/readingroom/search/site'
const CIA_DOC_BASE = 'https://www.cia.gov/readingroom/document'
const WAYBACK_BASE = 'https://web.archive.org/web'
const CDX_API = 'https://web.archive.org/cdx/search/cdx'
const THROTTLE_MS = 900
const DRY_RUN_SAMPLE_COUNT = 20
const RESULTS_PER_PAGE = 10

// ── Query config ───────────────────────────────────────────────────────────────

interface QueryConfig {
  term: string
  label: string
  topicSlug: string
  topicName: string
}

const QUERIES: QueryConfig[] = [
  {
    term: 'mkultra',
    label: 'MKULTRA',
    topicSlug: 'cia-foia-mkultra',
    topicName: 'CIA FOIA: MKULTRA Documents',
  },
  {
    term: 'cold war',
    label: 'Cold War',
    topicSlug: 'cia-foia-cold-war',
    topicName: 'CIA FOIA: Cold War Documents',
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  docId: string
  externalId: string
  sourceUrl: string
  title: string
  description: string | null
  claimText: string
  query: string
  queryLabel: string
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--query <term>] [--limit N] [--verbose]')
    process.exit(1)
  }

  const mode = args.includes('--full') ? 'full' : 'dry-run'

  if (mode === 'full' && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full requires ALLOW_EDITS=true')
    process.exit(1)
  }

  const qi = args.indexOf('--query')
  const li = args.indexOf('--limit')

  return {
    mode: mode as 'dry-run' | 'full',
    queryFilter: qi !== -1 ? (args[qi + 1] ?? null) : null,
    limit: li !== -1 ? (parseInt(args[li + 1] ?? '0', 10) || 0) : 0,
    verbose: args.includes('--verbose'),
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

async function fetchText(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
        Accept: 'text/html,application/json,*/*',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} at ${url}`)
    return res.text()
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Wayback CDX lookup ────────────────────────────────────────────────────────

interface SnapshotInfo {
  timestamp: string
  original: string
}

async function findBestSnapshot(ciaUrl: string): Promise<SnapshotInfo | null> {
  const cdxUrl = `${CDX_API}?url=${encodeURIComponent(ciaUrl)}&output=json&limit=1&fl=timestamp,original&filter=statuscode:200&sort=reverse`
  await throttle()
  const res = await fetch(cdxUrl, {
    headers: { 'User-Agent': 'epistemic-receipts-ingester/1.0' },
  })
  if (!res.ok) return null
  const data = await res.json() as string[][]
  if (!Array.isArray(data) || data.length < 2) return null
  return { timestamp: data[1][0], original: data[1][1] }
}

async function fetchWaybackPage(ciaUrl: string, timestamp: string): Promise<string | null> {
  const waybackUrl = `${WAYBACK_BASE}/${timestamp}/${ciaUrl}`
  try {
    return await fetchText(waybackUrl)
  } catch {
    return null
  }
}

// ── HTML parsing (no cheerio — regex only) ────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
}

function stripHtml(str: string): string {
  return str
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTotalResults(html: string): number {
  // "Search found 463 items"
  const match = html.match(/Search found (\d+) items?/i)
  return match ? parseInt(match[1], 10) : 0
}

function parseSearchResults(html: string, query: string, queryLabel: string): CandidateRecord[] {
  const results: CandidateRecord[] = []
  const seen = new Set<string>()

  // Split on result entry boundaries: each result starts with <h3 class="title">
  const parts = html.split('<h3 class="title">')

  for (let i = 1; i < parts.length; i++) {
    const part = parts[i]

    // Extract href and anchor text from the <a> tag
    const linkMatch = part.match(/<a href="([^"]+)">([^<]+)<\/a>/)
    if (!linkMatch) continue

    const rawUrl = linkMatch[1]
    const rawTitle = linkMatch[2].trim()
    if (!rawTitle) continue

    // Extract doc ID — strip Wayback prefix if present
    const docIdMatch = rawUrl.match(/readingroom\/document\/([a-z0-9_-]+)/i)
    if (!docIdMatch) continue
    const docId = docIdMatch[1].toLowerCase()

    if (seen.has(docId)) continue
    seen.add(docId)

    const title = decodeEntities(rawTitle)
    const externalId = `cia_foia_${docId}`
    const sourceUrl = `${CIA_DOC_BASE}/${docId}`

    // Extract snippet — may contain <strong>, <em> inline tags
    let description: string | null = null
    const snippetMatch = part.match(/<p class="search-snippet">([\s\S]*?)<\/p>/)
    if (snippetMatch) {
      description = stripHtml(decodeEntities(snippetMatch[1])).slice(0, 500) || null
    }

    const claimText = `"${title}" — CIA FOIA Reading Room (CREST database, ${queryLabel} query)`

    results.push({
      docId,
      externalId,
      sourceUrl,
      title,
      description,
      claimText,
      query,
      queryLabel,
    })
  }

  return results
}

// ── Fetch all results for a query ─────────────────────────────────────────────

async function fetchAllForQuery(
  qConfig: QueryConfig,
  maxRecords = 0,
): Promise<{ candidates: CandidateRecord[]; totalReported: number; pagesAttempted: number; pagesSucceeded: number }> {
  const candidates: CandidateRecord[] = []
  const seen = new Set<string>()
  let totalReported = 0
  let pagesAttempted = 0
  let pagesSucceeded = 0

  const baseSearchUrl = `${CIA_SEARCH_BASE}/${encodeURIComponent(qConfig.term)}`

  // Page 0 first — get total count and first batch
  console.log(`  Finding Wayback snapshot for page 0 of "${qConfig.term}"...`)
  const page0Snapshot = await findBestSnapshot(baseSearchUrl)

  if (!page0Snapshot) {
    console.warn(`  No Wayback snapshot found for query "${qConfig.term}" — skipping`)
    return { candidates, totalReported, pagesAttempted, pagesSucceeded }
  }

  console.log(`  Using snapshot ${page0Snapshot.timestamp} for page 0`)

  const page0Html = await fetchWaybackPage(baseSearchUrl, page0Snapshot.timestamp)
  pagesAttempted++

  if (!page0Html) {
    console.warn(`  Failed to fetch page 0 snapshot for "${qConfig.term}"`)
    return { candidates, totalReported, pagesAttempted, pagesSucceeded }
  }

  pagesSucceeded++
  totalReported = parseTotalResults(page0Html)
  const totalPages = totalReported > 0 ? Math.ceil(totalReported / RESULTS_PER_PAGE) : 1
  console.log(`  Total results reported: ${totalReported} | Estimated pages: ${totalPages}`)

  const page0Results = parseSearchResults(page0Html, qConfig.term, qConfig.label)
  for (const r of page0Results) {
    if (!seen.has(r.externalId)) {
      seen.add(r.externalId)
      candidates.push(r)
    }
    if (maxRecords > 0 && candidates.length >= maxRecords) break
  }

  if (maxRecords > 0 && candidates.length >= maxRecords) {
    return { candidates, totalReported, pagesAttempted, pagesSucceeded }
  }

  // Subsequent pages
  for (let page = 1; page < totalPages; page++) {
    const pageUrl = `${baseSearchUrl}?page=${page}`
    console.log(`  Page ${page + 1}/${totalPages} — looking for Wayback snapshot...`)

    const snap = await findBestSnapshot(pageUrl)

    if (!snap) {
      // Try with the page 0 timestamp (may or may not work)
      console.warn(`    No dedicated snapshot for page ${page} — trying page 0 timestamp`)
      const html = await fetchWaybackPage(pageUrl, page0Snapshot.timestamp)
      pagesAttempted++
      if (!html) {
        console.warn(`    Fetch failed — stopping pagination`)
        break
      }
      pagesSucceeded++
      const recs = parseSearchResults(html, qConfig.term, qConfig.label)
      if (recs.length === 0) {
        console.warn(`    No results parsed — stopping pagination`)
        break
      }
      for (const r of recs) {
        if (!seen.has(r.externalId)) {
          seen.add(r.externalId)
          candidates.push(r)
        }
        if (maxRecords > 0 && candidates.length >= maxRecords) break
      }
    } else {
      console.log(`    Snapshot ${snap.timestamp}`)
      const html = await fetchWaybackPage(pageUrl, snap.timestamp)
      pagesAttempted++
      if (!html) {
        console.warn(`    Fetch failed — skipping page ${page}`)
        continue
      }
      pagesSucceeded++
      const recs = parseSearchResults(html, qConfig.term, qConfig.label)
      for (const r of recs) {
        if (!seen.has(r.externalId)) {
          seen.add(r.externalId)
          candidates.push(r)
        }
        if (maxRecords > 0 && candidates.length >= maxRecords) break
      }
    }

    if (maxRecords > 0 && candidates.length >= maxRecords) break
  }

  return { candidates, totalReported, pagesAttempted, pagesSucceeded }
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
  rec: CandidateRecord,
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
      publishedAt: null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `cia_foia_source_${rec.docId}`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: null,
      claimEmergedPrecision: null,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        docId: rec.docId,
        query: rec.query,
        queryLabel: rec.queryLabel,
        description: rec.description,
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
      newScore: 85,
      reason: 'CIA FOIA Reading Room — declassified CREST document, HARD_FACT',
      changedAt: new Date(),
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
  const { mode, queryFilter, limit, verbose } = parseArgs()

  const activeQueries = queryFilter
    ? QUERIES.filter(q => q.term.toLowerCase().includes(queryFilter.toLowerCase()))
    : QUERIES

  console.log(`\n── Pipeline 118: CIA FOIA Reading Room ────────────────────────────────`)
  console.log(`Mode: ${mode} | Queries: ${activeQueries.map(q => q.label).join(', ')} | Limit: ${limit || 'all'}`)
  console.log(`Access: Wayback Machine CDX + HTML scraping (live CIA site blocks bots)`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Probing Wayback CDX and sampling records (no DB writes)...')

    const allCandidates: CandidateRecord[] = []
    const queryStats: Record<string, { total: number; fetched: number }> = {}

    for (const q of activeQueries) {
      console.log(`\n  Query: "${q.label}"`)
      const { candidates, totalReported } = await fetchAllForQuery(q, DRY_RUN_SAMPLE_COUNT - allCandidates.length)
      queryStats[q.label] = { total: totalReported, fetched: candidates.length }
      allCandidates.push(...candidates)
      if (allCandidates.length >= DRY_RUN_SAMPLE_COUNT) break
    }

    const sample = allCandidates.slice(0, DRY_RUN_SAMPLE_COUNT)

    console.log('\nQuery stats:')
    for (const [label, stats] of Object.entries(queryStats)) {
      console.log(`  ${label}: reported=${stats.total}, fetched=${stats.fetched}`)
    }

    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.docId}] ${r.queryLabel}`)
      console.log(`    ${r.title.slice(0, 100)}`)
      if (r.description) console.log(`    snippet: ${r.description.slice(0, 80)}...`)
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: 'Pipeline 118 — CIA FOIA Reading Room',
      accessMethod: 'Wayback Machine CDX + HTML scraping',
      ingestedBy: INGESTED_BY,
      queryStats,
      candidatesFetched: allCandidates.length,
      sample: sample.map(r => ({
        docId: r.docId,
        externalId: r.externalId,
        sourceUrl: r.sourceUrl,
        title: r.title,
        description: r.description,
        claimText: r.claimText,
        query: r.query,
        queryLabel: r.queryLabel,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        date: null,
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-118-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-118-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic('cia-foia-reading-room', 'CIA FOIA Reading Room', 'archives')

  const queryTopicIds: Map<string, string[]> = new Map()
  for (const q of activeQueries) {
    const qTopicId = await ensureTopic(q.topicSlug, q.topicName, 'archives', 'cia-foia-reading-room')
    queryTopicIds.set(q.term, [rootTopicId, qTopicId])
  }

  console.log('\nStep 2: Fetching records from Wayback Machine...')
  const allCandidates: CandidateRecord[] = []

  for (const q of activeQueries) {
    console.log(`\n  Query: "${q.label}"`)
    const { candidates, totalReported, pagesAttempted, pagesSucceeded } =
      await fetchAllForQuery(q, limit > 0 ? limit : 0)
    console.log(`  ${q.label}: reported=${totalReported}, fetched=${candidates.length}, pages=${pagesSucceeded}/${pagesAttempted}`)
    allCandidates.push(...candidates)
  }

  // Dedup across queries
  const uniqueCandidates: CandidateRecord[] = []
  const globalSeen = new Set<string>()
  for (const r of allCandidates) {
    if (!globalSeen.has(r.externalId)) {
      globalSeen.add(r.externalId)
      uniqueCandidates.push(r)
    }
  }

  console.log(`\nTotal unique candidates: ${uniqueCandidates.length}`)

  console.log(`\nStep 3: Ingesting ${uniqueCandidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of uniqueCandidates) {
    const topicIds = queryTopicIds.get(rec.query) ?? [rootTopicId]
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, topicIds),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${uniqueCandidates.length} — ${rec.docId}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  Failed: ${rec.externalId} — ${msg}`)
      counts.errors++
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

  if (dbClaims !== counts.ingested) {
    console.error(`  WARNING: DB count (${dbClaims}) != ingested counter (${counts.ingested})`)
  }
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
