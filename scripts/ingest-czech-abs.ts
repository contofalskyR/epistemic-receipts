// Pipeline 123 — Czech ABS (Archiv bezpečnostních složek) — Archivalie měsíce
// Dataset: https://www.abscr.cz/feed/?post_type=archivalie (RSS, paginated)
// Source:  "Archiválie měsíce" — monthly curated StB/SNB archival highlights, ~104 records
// Scope:   Communist-era State Security (StB) files, operations, and surveillance records
//          published as featured archival documents (2017–present)
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-czech-abs.ts --dry-run
//      npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-czech-abs.ts --full

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'czech_abs_v1'
const ABS_BASE = 'https://www.abscr.cz'
const ABS_CS_RSS = `${ABS_BASE}/feed/?post_type=archivalie`
const ABS_EN_RSS = `${ABS_BASE}/en/feed/?post_type=archivalie`
const THROTTLE_MS = 700
const DRY_RUN_SAMPLE_COUNT = 20
const RSS_PAGE_SIZE = 10

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  wpId: string
  csSlug: string
  csUrl: string
  enUrl: string | null
  csTitle: string
  enTitle: string | null
  pubDate: string
  excerpt: string | null
  externalId: string
  sourceUrl: string
  claimText: string
  date: Date | null
  datePrecision: string | null
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  if (!args.includes('--dry-run') && !args.includes('--full')) {
    console.error('Usage: --dry-run | --full  [--limit N] [--verbose]')
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

async function absFetch(url: string, retries = 3): Promise<{ body: string; status: number }> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        Accept: 'application/rss+xml, application/xml, text/xml',
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    const body = res.ok ? await res.text() : ''
    return { body, status: res.status }
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── RSS XML parsing ───────────────────────────────────────────────────────────

function extractCdata(tag: string, xml: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*</${tag}>`, 'i'))
  if (m) return m[1].trim()
  const m2 = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  if (m2) return decodeHtmlEntities(m2[1].trim())
  return null
}

function extractAttr(xml: string, tag: string, attr: string): string | null {
  const m = xml.match(new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i'))
  return m ? m[1] : null
}

function extractGuidText(xml: string): string | null {
  const m = xml.match(/<guid[^>]*>([\s\S]*?)<\/guid>/i)
  if (!m) return null
  return decodeHtmlEntities(m[1].trim())
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#038;/g, '&')
    .replace(/&#8211;/g, '–')
    .replace(/&#8220;/g, '"')
    .replace(/&#8221;/g, '"')
    .replace(/&#8222;/g, '„')
    .replace(/&#8230;/g, '…')
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

interface RSSItem {
  title: string
  link: string
  guid: string
  pubDate: string
  excerpt: string | null
}

function parseRSSItems(xml: string): RSSItem[] {
  const items: RSSItem[] = []
  const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)]

  for (const [, block] of itemBlocks) {
    const title = extractCdata('title', block)
    const link = extractCdata('link', block)
    const guid = extractGuidText(block)
    const pubDate = extractCdata('pubDate', block)
    const desc = extractCdata('description', block)

    if (!title || !link || !guid || !pubDate) continue

    const excerpt = desc ? stripHtml(desc.replace(/<a[^>]*>Zobrazit.*?<\/a>/gi, '').replace(/<a[^>]*>View.*?<\/a>/gi, '')).trim().slice(0, 800) : null

    items.push({ title, link, guid, pubDate, excerpt })
  }
  return items
}

// Extract WP post ID from guid like "https://www.abscr.cz/?post_type=archivalie&p=17998"
function extractWpId(guid: string): string | null {
  const m = guid.match(/[?&]p=(\d+)/)
  return m ? m[1] : null
}

// Extract slug from Czech URL like "https://www.abscr.cz/archivalie/akce-norbert/"
function extractCsSlug(url: string): string | null {
  const m = url.match(/\/archivalie\/([^/]+)\/?$/)
  return m ? m[1] : null
}

// Extract slug from English URL like "https://www.abscr.cz/en/archivalie/operation-norbert/"
function extractEnLinkSlug(url: string): string | null {
  const m = url.match(/\/en\/archivalie\/([^/]+)\/?$/)
  return m ? m[1] : null
}

// Parse "Mon, 27 Apr 2026 13:20:29 +0000" into Date
function parsePubDate(raw: string): { date: Date | null; precision: string | null } {
  if (!raw) return { date: null, precision: null }
  const d = new Date(raw)
  if (isNaN(d.getTime())) return { date: null, precision: null }
  return { date: d, precision: 'DAY' }
}

// ── Fetch RSS pages ───────────────────────────────────────────────────────────

async function fetchAllRSSPages(baseUrl: string, maxItems = 0): Promise<RSSItem[]> {
  const all: RSSItem[] = []
  let page = 1

  while (true) {
    const url = `${baseUrl}&paged=${page}`
    console.log(`  Fetching RSS page ${page} — ${url}`)
    const { body, status } = await absFetch(url)
    if (status === 404 || !body) break
    if (status >= 400) throw new Error(`RSS fetch ${status} at ${url}`)
    const items = parseRSSItems(body)
    if (items.length === 0) break

    all.push(...items)
    if (maxItems > 0 && all.length >= maxItems) break
    if (items.length < RSS_PAGE_SIZE) break
    page++
  }

  return maxItems > 0 ? all.slice(0, maxItems) : all
}

// ── Build English lookup: csSlug → {enTitle, enUrl} ─────────────────────────
// EN RSS guid is either:
//   (a) The CS URL:  "https://www.abscr.cz/archivalie/SLUG/"  → extract CS slug for match
//   (b) EN post ID:  "https://www.abscr.cz/?post_type=archivalie&p=ID" → can't match without page fetch
// We use only (a) for the lookup; (b) records fall back to Czech titles.

async function buildEnLookup(): Promise<Map<string, { enTitle: string; enUrl: string }>> {
  console.log('\n  Building English title lookup from EN RSS...')
  const map = new Map<string, { enTitle: string; enUrl: string }>()
  let page = 1

  while (true) {
    const url = `${ABS_EN_RSS}&paged=${page}`
    console.log(`  EN RSS page ${page}`)
    const { body, status } = await absFetch(url)
    if (status === 404 || !body) break
    if (status >= 400) throw new Error(`EN RSS fetch ${status} at ${url}`)
    const items = parseRSSItems(body)
    if (items.length === 0) break

    for (const item of items) {
      // Pattern (a): guid is a CS URL — reliable slug match
      const csSlugFromGuid = extractCsSlug(item.guid)
      if (csSlugFromGuid) {
        map.set(csSlugFromGuid, { enTitle: item.title, enUrl: item.link })
      }
      // Pattern (b): EN link slug == CS slug (many records share the same slug)
      const enLinkSlug = extractEnLinkSlug(item.link)
      if (enLinkSlug && !map.has(enLinkSlug)) {
        // Store under "en:<enSlug>" — matched against CS slug in buildCandidate
        map.set(`en:${enLinkSlug}`, { enTitle: item.title, enUrl: item.link })
      }
    }

    if (items.length < RSS_PAGE_SIZE) break
    page++
  }

  console.log(`  EN lookup built: ${map.size} entries with English titles`)
  return map
}

// ── Build candidates ──────────────────────────────────────────────────────────

function buildCandidate(
  csItem: RSSItem,
  enLookup: Map<string, { enTitle: string; enUrl: string }>,
): CandidateRecord | null {
  const wpId = extractWpId(csItem.guid)
  if (!wpId) return null

  const csSlug = extractCsSlug(csItem.link)
  if (!csSlug) return null

  // Try: (a) guid-based CS slug match, (b) EN link slug == CS slug
  const en = enLookup.get(csSlug) ?? enLookup.get(`en:${csSlug}`) ?? null
  const enTitle = en?.enTitle ?? null
  const enUrl = en?.enUrl ?? null

  const title = enTitle ?? csItem.title
  const { date, precision } = parsePubDate(csItem.pubDate)

  // claimText: prefer English title; annotate Czech-only with [cs]
  const titlePart = enTitle ? `"${enTitle}"` : `"${csItem.title}" [cs]`
  const datePart = date ? ` (${date.getFullYear()})` : ''
  const claimText = `${titlePart} — ABS Archiválie, StB file${datePart}`

  return {
    wpId,
    csSlug,
    csUrl: csItem.link,
    enUrl,
    csTitle: csItem.title,
    enTitle,
    pubDate: csItem.pubDate,
    excerpt: csItem.excerpt,
    externalId: `abs_${wpId}`,
    sourceUrl: csItem.link,
    claimText,
    date,
    datePrecision: precision,
  }
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
      name: rec.claimText.slice(0, 255),
      url: rec.sourceUrl,
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `abs_source_${rec.wpId}`,
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
        wpId: rec.wpId,
        csSlug: rec.csSlug,
        csUrl: rec.csUrl,
        enUrl: rec.enUrl,
        csTitle: rec.csTitle,
        enTitle: rec.enTitle,
        pubDate: rec.pubDate,
        excerpt: rec.excerpt,
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
      reason: 'Czech ABS — Archiv bezpečnostních složek, curated StB archival record, HARD_FACT',
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
  const { mode, limit, verbose } = parseArgs()

  console.log(`\n── Pipeline 123: Czech ABS — Archiválie měsíce ──────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'}`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Fetching Czech RSS (first 2 pages for dry-run)...')
    const csItems = await fetchAllRSSPages(ABS_CS_RSS, DRY_RUN_SAMPLE_COUNT)
    console.log(`  CS items fetched: ${csItems.length}`)

    console.log('\nStep 2: Building English title lookup...')
    const enLookup = await buildEnLookup()

    console.log('\nStep 3: Building candidates...')
    const candidates: CandidateRecord[] = []
    let skippedMalformed = 0
    for (const item of csItems) {
      const c = buildCandidate(item, enLookup)
      if (!c) { skippedMalformed++; continue }
      candidates.push(c)
    }

    console.log(`\n  Candidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)
    console.log(`  With English titles: ${candidates.filter(c => c.enTitle).length}`)

    console.log('\nSample records:')
    for (const r of candidates.slice(0, 15)) {
      const enFlag = r.enTitle ? '✓EN' : '  CS'
      console.log(`  [${r.wpId}] ${enFlag} | ${r.date?.toISOString().slice(0, 10) ?? 'no-date'}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
      if (r.enUrl) console.log(`    EN: ${r.enUrl}`)
      console.log(`    CS: ${r.csUrl}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      sourceRss: ABS_CS_RSS,
      totalCandidates: candidates.length,
      withEnglishTitles: candidates.filter(c => c.enTitle).length,
      skippedMalformed,
      sample: candidates.slice(0, DRY_RUN_SAMPLE_COUNT).map(r => ({
        wpId: r.wpId,
        externalId: r.externalId,
        sourceUrl: r.sourceUrl,
        enUrl: r.enUrl,
        csTitle: r.csTitle,
        enTitle: r.enTitle,
        claimText: r.claimText,
        pubDate: r.pubDate,
        datePrecision: r.datePrecision,
        excerpt: r.excerpt?.slice(0, 200),
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-123-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-123-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic(
    'czech-abs',
    'Czech ABS — StB Secret Police Files',
    'archives',
  )

  console.log('\nStep 2: Fetching Czech RSS (all pages)...')
  const maxFetch = limit > 0 ? limit : 0
  const csItems = await fetchAllRSSPages(ABS_CS_RSS, maxFetch)
  console.log(`  CS items fetched: ${csItems.length}`)

  console.log('\nStep 3: Building English title lookup...')
  const enLookup = await buildEnLookup()

  console.log('\nStep 4: Building candidates...')
  const candidates: CandidateRecord[] = []
  let skippedMalformed = 0
  for (const item of csItems) {
    const c = buildCandidate(item, enLookup)
    if (!c) { skippedMalformed++; continue }
    candidates.push(c)
  }

  console.log(`\n  Candidates: ${candidates.length} (malformed: ${skippedMalformed})`)
  console.log(`  With English titles: ${candidates.filter(c => c.enTitle).length}`)

  console.log(`\nStep 5: Ingesting ${candidates.length} records...`)
  const startTime = Date.now()
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rec of candidates) {
    try {
      const result = await prisma.$transaction(
        async (tx) => writeRow(tx, rec, [rootTopicId]),
        { timeout: 30000 },
      )
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (verbose || counts.ingested % 20 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.externalId} — ${(rec.enTitle ?? rec.csTitle).slice(0, 60)}`)
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
