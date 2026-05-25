// Pipeline 122 — CNSAS (Consiliul Național pentru Studierea Arhivelor Securității)
// Dataset: www.cnsas.ro — Romanian Securitate secret police files
// Scope: Publicly accessible document pages: studies, reports, archival descriptions,
//        the Securitate cadres registry, and document collection metadata.
// Access: CNSAS blocks datacenter IPs; uses Wayback Machine CDX API to enumerate
//         archived document pages. Canonical sourceUrl always points to live CNSAS URL.
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-romania-cnsas.ts --dry-run
//      ALLOW_EDITS=true npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-romania-cnsas.ts --full [--limit N] [--verbose]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import { execSync } from 'child_process'

const prisma = new PrismaClient()

const INGESTED_BY = 'romania_cnsas_v1'
const PIPELINE = 'Pipeline 122'
const CNSAS_BASE = 'https://www.cnsas.ro'
const WAYBACK_BASE = 'https://web.archive.org/web'
const CDX_API = 'https://web.archive.org/cdx/search/cdx'
const THROTTLE_MS = 800
const DRY_RUN_SAMPLE_COUNT = 20
const TELEGRAM_TARGET = '7688025079'

// Wayback CDX patterns, tried in order until enough candidates are collected.
// Archival/documentary content first; administrative forms excluded via path filters.
const CDX_SEARCHES: Array<{ pattern: string; label: string; mimeFilter?: string }> = [
  { pattern: 'www.cnsas.ro/documente/cadrele_securitatii*', label: 'cadre', mimeFilter: 'text/html' },
  { pattern: 'www.cnsas.ro/documente/studii*', label: 'studii-html', mimeFilter: 'text/html' },
  { pattern: 'www.cnsas.ro/caiete*', label: 'caiete-html', mimeFilter: 'text/html' },
  { pattern: 'www.cnsas.ro/documente/evenimente*', label: 'evenimente', mimeFilter: 'text/html' },
  { pattern: 'www.cnsas.ro/periodicul*', label: 'periodicul', mimeFilter: 'text/html' },
  { pattern: 'www.cnsas.ro/documente/*', label: 'documente-html', mimeFilter: 'text/html' },
  { pattern: 'www.cnsas.ro/caiete*', label: 'caiete-pdf', mimeFilter: 'application/pdf' },
  { pattern: 'www.cnsas.ro/documente/studii*', label: 'studii-pdf', mimeFilter: 'application/pdf' },
  { pattern: 'www.cnsas.ro/documente/cadrele_securitatii*', label: 'cadre-pdf', mimeFilter: 'application/pdf' },
]

// Navigation/boilerplate paths with no archival document content
const SKIP_PATH_EXACT = new Set([
  '/', '/index.html', '/default.htm', '/index.htm',
  '/contact.html', '/despre_noi.html', '/harta_site.html',
  '/acces_dosar.html', '/cercetatori.html', '/acces_informatii.html',
  '/activitate.html', '/conducere.html', '/personal.html',
  '/galerie_foto.html', '/linkuri.html',
])

// Paths that are administrative forms or templates — no archival content
const SKIP_PATH_PREFIXES = [
  '/documente/tipuri',    // access request form templates
  '/documente/formulare', // other form templates
]

const SKIP_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.ico', '.css', '.js'])

// Generic site-level title — indicates the HTML page didn't have a document-specific title
const GENERIC_SITE_TITLES = new Set([
  'Consiliul National pentru Studierea Arhivelor Securitatii',
  'Consiliul Național pentru Studierea Arhivelor Securității',
  'CNSAS',
  'Home',
  'Acasă',
  'Pagina principala',
  'Pagina principală',
])

// ── Types ─────────────────────────────────────────────────────────────────────

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

interface CdxEntry {
  timestamp: string
  original: string
}

interface CandidateRecord {
  docId: string
  externalId: string
  sourceUrl: string
  title: string
  description: string | null
  dateStr: string | null
  date: Date | null
  datePrecision: string | null
  category: string
  urlPath: string
  claimText: string
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

async function fetchText(url: string, retries = 3): Promise<string> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'epistemic-receipts-ingester/1.0 (research; contact robert.contofalsky@rutgers.edu)',
        Accept: 'text/html,application/xhtml+xml,*/*',
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

// ── Wayback CDX ───────────────────────────────────────────────────────────────

async function fetchCdxEntries(urlPattern: string, mimeFilter?: string, limit = 2000): Promise<CdxEntry[]> {
  const params = new URLSearchParams({
    url: urlPattern,
    output: 'json',
    fl: 'timestamp,original',
    filter: 'statuscode:200',
    collapse: 'original',
    limit: String(limit),
    sort: 'reverse',   // most recent first — avoids old redirects
  })
  if (mimeFilter) params.append('filter', `mimetype:${mimeFilter}`)
  const cdxUrl = `${CDX_API}?${params}`
  console.log(`  CDX: ${cdxUrl}`)
  const text = await fetchText(cdxUrl)
  let rows: string[][]
  try {
    rows = JSON.parse(text) as string[][]
  } catch {
    return []
  }
  if (!Array.isArray(rows) || rows.length < 2) return []
  return rows.slice(1).map(r => ({ timestamp: r[0], original: r[1] }))
}

async function fetchWaybackPage(timestamp: string, originalUrl: string): Promise<string | null> {
  const waybackUrl = `${WAYBACK_BASE}/${timestamp}/${originalUrl}`
  try {
    return await fetchText(waybackUrl)
  } catch {
    return null
  }
}

// ── URL filtering ─────────────────────────────────────────────────────────────

function shouldSkipUrl(original: string): boolean {
  let pathname: string
  let decodedPath: string
  try {
    pathname = new URL(original).pathname
    decodedPath = decodeURIComponent(pathname).toLowerCase()
  } catch {
    return true
  }
  if (SKIP_PATH_EXACT.has(pathname)) return true
  const lower = pathname.toLowerCase()
  if (Array.from(SKIP_EXTENSIONS).some(ext => lower.endsWith(ext))) return true
  if (SKIP_PATH_PREFIXES.some(p => decodedPath.startsWith(p))) return true
  // Require minimum path depth — skip bare domain pages
  if (pathname.split('/').filter(Boolean).length === 0) return true
  return false
}

function urlToDocId(url: string): string {
  try {
    const u = new URL(url)
    let path: string
    try {
      path = decodeURIComponent(u.pathname)
    } catch {
      path = u.pathname
    }
    let id = path
      .replace(/\.html?$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/^\//, '')
      .replace(/\/+/g, '_')
      .replace(/[^a-zA-Z0-9_-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '')
    // Normalise serial-paged PDFs: P_010933_012 → P_010933
    id = normalisePdfDocId(id)
    return id.slice(0, 120) || 'cnsas'
  } catch {
    return 'cnsas'
  }
}

function categoryFromUrl(url: string): string {
  const lower = url.toLowerCase()
  if (lower.includes('/cadrele_securitatii')) return 'cadres'
  if (lower.includes('/studii')) return 'studies'
  if (lower.includes('/periodicul')) return 'periodical'
  if (lower.includes('/documente')) return 'documente'
  return 'general'
}

// ── HTML parsing (regex only — no cheerio) ────────────────────────────────────

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
}

function stripHtml(str: string): string {
  return str.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

function cleanWayback(html: string): string {
  return html
    .replace(/<!-- BEGIN WAYBACK TOOLBAR[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/i, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
}

function extractHtmlTitle(html: string, fallbackUrl: string): string | null {
  const clean = cleanWayback(html)

  // H1 first
  const h1 = clean.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1) {
    const t = decodeEntities(stripHtml(h1[1])).trim()
    if (t.length >= 4 && t.length <= 500 && !/^(home|acas[aă]|nav|menu)$/i.test(t)) return t
  }

  // H2
  const h2 = clean.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i)
  if (h2) {
    const t = decodeEntities(stripHtml(h2[1])).trim()
    if (t.length >= 4 && t.length <= 500) return t
  }

  // H3 if it looks like a document title (longer than 15 chars)
  const h3 = clean.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)
  if (h3) {
    const t = decodeEntities(stripHtml(h3[1])).trim()
    if (t.length >= 15 && t.length <= 500) return t
  }

  // <title> tag — strip "– CNSAS" suffix
  const titleTag = clean.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (titleTag) {
    let t = decodeEntities(stripHtml(titleTag[1])).trim()
    t = t.replace(/\s*[\-–|]\s*(?:CNSAS|Consiliul\s+Na[^\-–|]{0,60}Securit[^\-–|]{0,40}).*$/i, '').trim()
    t = t.replace(/\s*[\-–|]\s*(?:Home|Acas[aă]|Pagina principal[aă]).*$/i, '').trim()
    if (t.length >= 4 && t.length <= 500) return t
  }

  return null
}

function extractHtmlDescription(html: string): string | null {
  const clean = cleanWayback(html)
  // Find first content paragraph with at least 40 chars
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/gi
  let m: RegExpExecArray | null
  while ((m = pRe.exec(clean)) !== null) {
    const text = decodeEntities(stripHtml(m[1])).trim()
    if (text.length >= 40 && text.length <= 2000) {
      return text.slice(0, 600)
    }
  }
  return null
}

function extractHtmlDate(html: string): { dateStr: string | null; date: Date | null; precision: string | null } {
  const clean = cleanWayback(html)
  const text = decodeEntities(stripHtml(clean))

  // Romanian date formats: dd.mm.yyyy or dd/mm/yyyy
  const fullRo = text.match(/\b(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})\b/)
  if (fullRo) {
    const [, d, mo, y] = fullRo
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`
    const dt = new Date(`${iso}T00:00:00Z`)
    if (!isNaN(dt.getTime())) return { dateStr: iso, date: dt, precision: 'DAY' }
  }

  // Year only: look for 4-digit years in 1947–2024 range
  const yearMatch = text.match(/\b(19[4-9]\d|20[0-2]\d)\b/)
  if (yearMatch) {
    const y = yearMatch[1]
    const dt = new Date(`${y}-01-01T00:00:00Z`)
    return { dateStr: y, date: dt, precision: 'YEAR' }
  }

  return { dateStr: null, date: null, precision: null }
}

// Title from URL filename — used when HTML fetch fails or for PDFs.
// Decodes URL percent-encoding before building a human-readable title.
function titleFromUrlPath(url: string): string {
  try {
    const path = new URL(url).pathname
    let decoded: string
    try {
      decoded = decodeURIComponent(path)
    } catch {
      decoded = path
    }
    const filename = decoded.split('/').filter(Boolean).pop() ?? ''
    return filename
      .replace(/\.html?$/i, '')
      .replace(/\.pdf$/i, '')
      .replace(/[-_]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'CNSAS Document'
  } catch {
    return 'CNSAS Document'
  }
}

// For scanned Securitate files that are split across pages (_001.pdf, _002.pdf …),
// normalise the external ID to the file base — keeps only one record per file.
function normalisePdfDocId(rawDocId: string): string {
  // e.g. "documente_23_aug_1944_P_010933_012" → "documente_23_aug_1944_P_010933"
  return rawDocId.replace(/_\d{3,4}$/, '')
}

// ── Build candidate from CDX entry ────────────────────────────────────────────

async function buildCandidate(entry: CdxEntry, category: string): Promise<CandidateRecord | null> {
  const { timestamp, original } = entry
  if (shouldSkipUrl(original)) return null

  const docId = urlToDocId(original)
  if (!docId) return null

  const externalId = `cnsas_${docId}`
  const urlPath = (() => {
    try { return new URL(original).pathname } catch { return original }
  })()

  let title: string | null = null
  let description: string | null = null
  let dateStr: string | null = null
  let date: Date | null = null
  let datePrecision: string | null = null

  // Skip PDFs — title from filename, no fetch needed.
  const isPdf = original.toLowerCase().endsWith('.pdf')
  if (isPdf) {
    title = titleFromUrlPath(original)
  } else {
    const html = await fetchWaybackPage(timestamp, original)
    if (html) {
      title = extractHtmlTitle(html, original)
      description = extractHtmlDescription(html)
      const dt = extractHtmlDate(html)
      dateStr = dt.dateStr
      date = dt.date
      datePrecision = dt.precision
    }
  }

  if (!title) title = titleFromUrlPath(original)
  if (!title || title.length < 3) return null
  // Reject records whose title is just the generic site name with no document-specific content
  if (GENERIC_SITE_TITLES.has(title.trim())) return null

  const catLabel = category === 'cadres' ? 'Securitate cadres registry'
    : category === 'studies' ? 'studies and documents'
    : category === 'periodical' ? 'Securitatea periodical'
    : 'CNSAS documents'

  const datePart = dateStr ? `, ${dateStr}` : ''
  const claimText = `"${title}" — CNSAS (${catLabel}${datePart})`

  return {
    docId,
    externalId,
    sourceUrl: original,
    title: title.slice(0, 500),
    description,
    dateStr,
    date,
    datePrecision,
    category,
    urlPath,
    claimText,
  }
}

// ── Fetch all candidates ──────────────────────────────────────────────────────

async function fetchAllCandidates(
  maxRecords = 0,
  verbose = false,
): Promise<{ candidates: CandidateRecord[]; skippedMalformed: number; totalCdx: number }> {
  const candidates: CandidateRecord[] = []
  const seenExternalIds = new Set<string>()
  let skippedMalformed = 0
  let totalCdx = 0

  for (const { pattern, label, mimeFilter } of CDX_SEARCHES) {
    if (maxRecords > 0 && candidates.length >= maxRecords) break

    console.log(`\n  CDX search: ${pattern} (${label})`)
    const entries = await fetchCdxEntries(pattern, mimeFilter, 2000)
    totalCdx += entries.length
    console.log(`  CDX returned ${entries.length} unique URLs`)

    for (const entry of entries) {
      if (maxRecords > 0 && candidates.length >= maxRecords) break
      if (shouldSkipUrl(entry.original)) continue

      const cat = categoryFromUrl(entry.original)
      if (verbose) console.log(`    Processing: ${entry.original}`)

      const c = await buildCandidate(entry, cat)
      if (!c) { skippedMalformed++; continue }
      if (seenExternalIds.has(c.externalId)) continue
      seenExternalIds.add(c.externalId)
      candidates.push(c)
      if (verbose) console.log(`    [${candidates.length}] ${c.title.slice(0, 80)}`)
    }
  }

  return { candidates, skippedMalformed, totalCdx }
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
      publishedAt: rec.date ?? null,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: `${INGESTED_BY}_source_${rec.docId}`,
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
        docId: rec.docId,
        category: rec.category,
        urlPath: rec.urlPath,
        dateStr: rec.dateStr,
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
      newScore: 88,
      reason: 'CNSAS — Romanian Securitate archive primary source, HARD_FACT',
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

// ── Notification ──────────────────────────────────────────────────────────────

function notify(message: string) {
  try {
    execSync(
      `openclaw message send --channel telegram --target "${TELEGRAM_TARGET}" --message "${message.replace(/"/g, '\\"')}"`,
      { stdio: 'ignore' },
    )
  } catch {
    // non-fatal
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const { mode, limit, verbose } = parseArgs()

  console.log(`\n── ${PIPELINE}: CNSAS Romanian Securitate Files ────────────────────────`)
  console.log(`Mode: ${mode} | Limit: ${limit || 'all'} | Verbose: ${verbose}`)
  console.log(`Access: Wayback Machine CDX + HTML scraping (CNSAS blocks datacenter IPs)`)

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    console.log('\nStep 1: Enumerating CNSAS documents via Wayback CDX (no DB writes)...')

    const maxFetch = DRY_RUN_SAMPLE_COUNT
    let candidates: CandidateRecord[]
    let skippedMalformed: number
    let totalCdx: number

    try {
      ;({ candidates, skippedMalformed, totalCdx } = await fetchAllCandidates(maxFetch, verbose))
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      notify(`Romania CNSAS (P122) FAILED: ${reason}`)
      throw err
    }

    console.log(`\n  CDX total entries seen: ${totalCdx}`)
    console.log(`  Candidates built: ${candidates.length} (skipped malformed: ${skippedMalformed})`)

    const sample = candidates.slice(0, DRY_RUN_SAMPLE_COUNT)
    console.log('\nSample records:')
    for (const r of sample) {
      console.log(`  [${r.category}] ${r.urlPath}`)
      console.log(`    ${r.claimText.slice(0, 120)}`)
    }

    const output = {
      runDate: new Date().toISOString(),
      pipeline: `${PIPELINE} — CNSAS Romanian Securitate Files`,
      accessMethod: 'Wayback Machine CDX + HTML scraping',
      ingestedBy: INGESTED_BY,
      cdxPatternsQueried: CDX_SEARCHES.map(s => s.pattern),
      totalCdxEntries: totalCdx,
      candidatesFetched: candidates.length,
      skippedMalformed,
      sample: sample.map(r => ({
        docId: r.docId,
        externalId: r.externalId,
        sourceUrl: r.sourceUrl,
        title: r.title,
        description: r.description,
        dateStr: r.dateStr,
        datePrecision: r.datePrecision,
        category: r.category,
        urlPath: r.urlPath,
        claimText: r.claimText,
        claimType: 'INSTITUTIONAL',
        currentStatus: 'HARD_FACT',
        verificationStatus: 'VERIFIED',
        autoApproved: true,
        humanReviewed: false,
        ingestedBy: INGESTED_BY,
      })),
    }

    fs.writeFileSync('pipeline-122-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('\n  Written: pipeline-122-dry-run-sample.json')
    console.log('\nDry-run complete.')

    const summary = sample.slice(0, 3).map(r => r.title.slice(0, 40)).join('; ')
    notify(`Romania CNSAS (P122) done — dry-run passed. ${candidates.length} records. Sample: ${summary}`)

    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run ───────────────────────────────────────────────────────────────
  console.log('\nStep 1: Ensuring topics...')
  const rootTopicId = await ensureTopic('romania-cnsas', 'CNSAS — Romanian Securitate Files', 'archives')

  console.log('\nStep 2: Enumerating and fetching CNSAS documents...')
  const maxFetch = limit > 0 ? limit : 0
  let candidates: CandidateRecord[]
  let skippedMalformed: number

  try {
    ;({ candidates, skippedMalformed } = await fetchAllCandidates(maxFetch, verbose))
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err)
    notify(`Romania CNSAS (P122) FAILED: ${reason}`)
    throw err
  }

  console.log(`\nCandidates: ${candidates.length} (skipped malformed: ${skippedMalformed})`)

  console.log(`\nStep 3: Ingesting ${candidates.length} records...`)
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

      if (verbose || counts.ingested % 100 === 0) {
        console.log(`  Progress: ${counts.ingested}/${candidates.length} — ${rec.title.slice(0, 60)}`)
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

  const summary = candidates.slice(0, 3).map(r => r.title.slice(0, 40)).join('; ')
  notify(`Romania CNSAS (P122) done. Ingested ${counts.ingested} records. Sample: ${summary}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
