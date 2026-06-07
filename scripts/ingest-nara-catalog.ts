// Pipeline — US National Archives (NARA) Catalog
// Dataset: NARA Catalog API v2 (catalog.archives.gov/api/v2) — API key required.
// API key registration: email Catalog_API@nara.gov (free, for read-only access).
// Set NARA_API_KEY env var before running.
//
// Scope: Unrestricted archival items from high-value record groups (CIA, State, OSD, Church Committee, JFK ARRB).
// Run: npx tsx scripts/ingest-nara-catalog.ts --dry-run (default; requires NARA_API_KEY)
//      npx tsx scripts/ingest-nara-catalog.ts --full [--record-group 263]  (requires ALLOW_EDITS=true + NARA_API_KEY)
//      npx tsx scripts/ingest-nara-catalog.ts --full --record-group 59 --year-start 1940 --year-end 1945 --dry-run
//      npx tsx scripts/ingest-nara-catalog.ts --check-limits  (probe rate limit headers, 1 API call, no DB writes)
//
// API notes discovered during integration (2026-05-28/29, corrected 2026-06-02):
//   - v2 params differ from v1: levelOfDescription=item (not resultTypes), limit= (not rows=), page= (not offset=)
//   - v2 response wraps Elasticsearch body: data.body.hits.hits[] or data.opaResponse.results.result[] (v1 compat)
//   - API key goes in x-api-key header per swagger docs
//   - CloudFront at catalog.archives.gov routes /api/v2/swagger* to backend; search endpoints also require the key
//   - NARA API v2 has a 10,000 result window for page-based pagination (page 1–100 × 100/page = 10k max).
//     HOWEVER: searchAfter=<naId> (integer) enables deep pagination beyond 10k — confirmed working 2026-06-02.
//     Use pages 1-100 first, then switch to searchAfter=<lastNaId> to continue. Chains correctly.
//   - dateRangeStart/dateRangeEnd are NOT valid params (use startDate/endDate instead), but date filters
//     still don't reliably reduce record counts for large RGs — most photos have no date field set.
//   - Budget strategy: 10k calls/month per key × 100 records/call. For RG59 (~76k records): ~770 calls total.
//     Use --max-pages to cap per run, then --resume next month. Register 2–3 free NARA keys for more capacity.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'

const prisma = new PrismaClient()

const INGESTED_BY = 'nara_catalog_v1'
const NARA_BASE = 'https://catalog.archives.gov/api/v2'
const PAGE_SIZE = 100
const THROTTLE_MS = 300
const DRY_RUN_SAMPLE = 20
const CURSOR_FILE = '.nara-cursor.json'

// ── Cursor / resume state ─────────────────────────────────────────────────────

interface GroupCursor {
  nextPage: number
  fetched: number
  total: number
  complete: boolean
  searchAfterNaId?: number  // set after page 100; switches from page= to searchAfter= pagination
}

type CursorState = Record<string, GroupCursor>

function loadCursor(): CursorState {
  try {
    return JSON.parse(fs.readFileSync(CURSOR_FILE, 'utf-8')) as CursorState
  } catch {
    return {}
  }
}

function saveCursor(state: CursorState) {
  fs.writeFileSync(CURSOR_FILE, JSON.stringify(state, null, 2))
}

// ── Record group config ────────────────────────────────────────────────────────

interface RecordGroupDef {
  number: string
  name: string
  topicSlug: string
  domain: string
}

const RECORD_GROUPS: RecordGroupDef[] = [
  { number: '263', name: 'Records of the Central Intelligence Agency (CIA)',        topicSlug: 'nara-rg-263-cia',   domain: 'intelligence' },
  { number: '59',  name: 'General Records of the Department of State',              topicSlug: 'nara-rg-59-state',  domain: 'diplomacy'    },
  { number: '330', name: 'Records of the Office of the Secretary of Defense',       topicSlug: 'nara-rg-330-osd',   domain: 'defense'      },
  { number: '128', name: 'Records of Joint Committees of Congress',                 topicSlug: 'nara-rg-128-jcc',   domain: 'government'   },
  { number: '148', name: 'Records of the Assassination Records Review Board (JFK)', topicSlug: 'nara-rg-148-arrb',  domain: 'government'   },
  { number: '65',  name: 'Records of the Federal Bureau of Investigation (FBI)',    topicSlug: 'nara-rg-65-fbi',    domain: 'intelligence' },
  { number: '226', name: 'Records of the Office of Strategic Services (OSS)',       topicSlug: 'nara-rg-226-oss',   domain: 'intelligence' },
  { number: '218', name: 'Records of the Joint Chiefs of Staff',                    topicSlug: 'nara-rg-218-jcs',   domain: 'defense'      },
  { number: '84',  name: 'Records of Foreign Service Posts of the Department of State', topicSlug: 'nara-rg-84-fsp', domain: 'diplomacy' },
  { number: '326', name: 'Records of the Atomic Energy Commission (AEC/Manhattan Project)', topicSlug: 'nara-rg-326-aec', domain: 'science' },
  { number: '238', name: 'Records of National Archives Collections of World War II War Crimes Records (Nuremberg)', topicSlug: 'nara-rg-238-nuremberg', domain: 'government' },
  { number: '220', name: 'Records of Temporary Committees, Commissions, and Boards (Presidential Commissions)', topicSlug: 'nara-rg-220-commissions', domain: 'government' },
  { number: '457', name: 'Records of the National Security Agency / Central Security Service (NSA/SIGINT)', topicSlug: 'nara-rg-457-nsa', domain: 'intelligence' },
  { number: '107', name: 'Records of the Office of the Secretary of War, WWII', topicSlug: 'nara-rg-107-secrwar', domain: 'defense' },
]

const RG_BY_NUMBER = new Map(RECORD_GROUPS.map(rg => [rg.number, rg]))

// ── Types ─────────────────────────────────────────────────────────────────────

// v2 API: hits are in body.hits.hits[]; each hit._source.record holds the record
interface NaraHitV2 {
  _source?: {
    record?: NaraRecord
  }
  fields?: Partial<NaraRecord>
}

// v1-compat: some responses may use the opaResponse wrapper
interface NaraRecord {
  naId?: string | number
  title?: string
  description?: string
  beginDate?: string
  endDate?: string
  accessRestriction?: { restriction?: string }
  recordGroupNumber?: string | number
  seriesTitle?: string
  parentSeries?: { title?: string }
  objects?: NaraObject | NaraObject[]
  scopeAndContentNote?: string
  levelOfDescription?: string
}

interface NaraObject {
  file?: { url?: string }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NaraRawResponse = any

type IngestResult = 'ingested' | 'skipped'
type Counts = { ingested: number; skipped: number; errors: number }

interface CandidateRecord {
  naId: string
  externalId: string
  title: string
  recordGroup: string
  seriesTitle: string | null
  beginDate: string | null
  endDate: string | null
  accessRestriction: string
  scopeNote: string | null
  digitized: boolean
  sourceUrl: string
  claimText: string
  publishedAt: Date | null
  claimEmergedAt: Date | null
  claimEmergedPrecision: string | null
}

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2)

  const isFull = args.includes('--full')
  const isResume = args.includes('--resume')
  const isDryRunFlag = args.includes('--dry-run')
  // --dry-run always wins; --full/--resume without --dry-run writes to DB
  const mode: 'dry-run' | 'full' = isDryRunFlag ? 'dry-run' : ((isFull || isResume) ? 'full' : 'dry-run')

  if ((isFull || isResume) && !isDryRunFlag && process.env.ALLOW_EDITS !== 'true') {
    console.error('--full/--resume (without --dry-run) requires ALLOW_EDITS=true environment variable')
    process.exit(1)
  }

  const apiKey = process.env.NARA_API_KEY || ''
  if (!apiKey) {
    console.error([
      'NARA_API_KEY environment variable not set.',
      'The NARA Catalog API v2 requires a key for all search operations.',
      'To obtain a free read-only key, email: Catalog_API@nara.gov',
      'Set the key in .env.local as: NARA_API_KEY=your-key-here',
    ].join('\n'))
    process.exit(1)
  }

  const rgi = args.indexOf('--record-group')
  const rgArg = rgi !== -1 ? (args[rgi + 1] ?? '') : ''

  let recordGroups: RecordGroupDef[]
  if (rgArg) {
    const rg = RG_BY_NUMBER.get(rgArg)
    if (!rg) {
      console.error(`Unknown record group: ${rgArg}. Valid: ${RECORD_GROUPS.map(r => r.number).join(', ')}`)
      process.exit(1)
    }
    recordGroups = [rg]
  } else {
    recordGroups = RECORD_GROUPS
  }

  const mpi = args.indexOf('--max-pages')
  // No hard cap when --full or --resume is passed (unless explicitly set via --max-pages)
  const maxPages: number | null = mpi !== -1
    ? parseInt(args[mpi + 1] ?? '100', 10)
    : (isFull || isResume ? null : 100)

  const ysi = args.indexOf('--year-start')
  const yei = args.indexOf('--year-end')
  const yearStart: number | null = ysi !== -1 ? parseInt(args[ysi + 1] ?? '0', 10) : null
  const yearEnd: number | null = yei !== -1 ? parseInt(args[yei + 1] ?? '0', 10) : null

  const isCheckLimits = args.includes('--check-limits')

  return { mode, recordGroups, apiKey, maxPages, isResume, isFull, yearStart, yearEnd, isCheckLimits }
}

// ── Rate limiting + HTTP ──────────────────────────────────────────────────────

let lastReqAt = 0

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = THROTTLE_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function naraFetch(url: string, apiKey: string, retries = 3): Promise<NaraRawResponse> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`NARA API ${res.status} at ${url}: ${body.slice(0, 200)}`)
    }
    // Guard against HTML responses (API key invalid → CloudFront serves SPA)
    const contentType = res.headers.get('content-type') ?? ''
    if (!contentType.includes('application/json') && !contentType.includes('text/json')) {
      const body = await res.text()
      if (body.trimStart().startsWith('<')) {
        throw new Error(
          `NARA API returned HTML instead of JSON at ${url}.\n` +
          `This usually means the x-api-key header is invalid or not being forwarded.\n` +
          `Check that NARA_API_KEY is correct (obtained from Catalog_API@nara.gov).`
        )
      }
    }
    return res.json() as Promise<NaraRawResponse>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── Constants for year filtering ──────────────────────────────────────────────
const DEFAULT_YEAR_START = 1900

// ── Parse NARA API response ────────────────────────────────────────────────────
// v2 returns Elasticsearch format: { body: { hits: { hits: [...], total: { value: N } } } }
// v1-compat may return: { opaResponse: { results: { result: [...], total: N } } }

function toArray<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return []
  return Array.isArray(v) ? v : [v]
}

function extractHitsAndTotal(data: NaraRawResponse): { records: NaraRecord[]; total: number } {
  // v2 Elasticsearch format
  if (data?.body?.hits?.hits) {
    const hits: NaraHitV2[] = toArray(data.body.hits.hits)
    const total: number = data.body.hits.total?.value ?? data.body.hits.total ?? hits.length
    const records = hits.map(h => ({ ...h._source?.record, ...h.fields })).filter(Boolean) as NaraRecord[]
    return { records, total }
  }

  // v1-compat format (opaResponse)
  if (data?.opaResponse?.results) {
    const results = data.opaResponse.results
    const rawTotal = results.total ?? results['@attributes']?.numFound ?? 0
    const total = typeof rawTotal === 'string' ? parseInt(rawTotal, 10) || 0 : Number(rawTotal) || 0
    const records = toArray(results.result) as NaraRecord[]
    return { records, total }
  }

  // Unknown format — log and return empty
  console.warn('  Warning: unexpected NARA API response format')
  return { records: [], total: 0 }
}

// ── Fetch items for one record group (paginated) ──────────────────────────────
//
// search_after / cursor-based resume: the cursor file (.nara-cursor.json) tracks
// the last completed page number per record group. On --resume, each group starts
// from its saved nextPage. maxPages=null removes the hard cap for full/resume runs.

async function fetchRecordGroupDryRun(
  rg: RecordGroupDef,
  apiKey: string,
): Promise<{ records: NaraRecord[]; total: number }> {
  const baseUrl = `${NARA_BASE}/records/search?levelOfDescription=item&limit=${DRY_RUN_SAMPLE}&recordGroupNumber=${rg.number}`
  const data = await naraFetch(`${baseUrl}&page=1`, apiKey)
  const { records, total } = extractHitsAndTotal(data)
  return { records: records.slice(0, DRY_RUN_SAMPLE), total }
}

// Fetches and writes one record group via page-based pagination for pages 1-100, then
// switches to searchAfter=<naId> deep pagination for records beyond 10k.
// NARA's 10k window only applies to page= param; searchAfter bypasses it entirely.
// Use --max-pages to cap API calls per run (each page = 1 call); --resume picks up the cursor.
async function fetchAndWriteGroup(
  rg: RecordGroupDef,
  apiKey: string,
  topicIds: string[],
  cursorState: CursorState,
  maxPages: number | null,
  dryRun = false,
): Promise<{ counts: Counts }> {
  const cursorKey = rg.number
  const saved = cursorState[cursorKey]
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  if (saved?.complete) {
    console.log(`  RG ${rg.number}: already complete (${saved.fetched} fetched) — skipping`)
    return { counts }
  }

  let page = saved?.nextPage ?? 1
  let searchAfterNaId: number | null = saved?.searchAfterNaId ?? null
  let total = saved?.total ?? 0
  let callCount = 0
  const label = `RG ${rg.number}`
  const baseUrl = `${NARA_BASE}/records/search?levelOfDescription=item&limit=${PAGE_SIZE}&recordGroupNumber=${rg.number}`

  const mode = searchAfterNaId != null ? `searchAfter from naId ${searchAfterNaId}` : `page ${page}`
  console.log(`  ${label}: ${saved ? `resuming (fetched ${saved.fetched}, ${mode})` : 'starting'}${dryRun ? ' (dry-run — no writes)' : ''}`)

  for (;;) {
    // Build URL: use page= for first 100 pages, then searchAfter= to bypass 10k cap
    let url: string
    if (searchAfterNaId != null) {
      url = `${baseUrl}&searchAfter=${searchAfterNaId}`
    } else {
      url = `${baseUrl}&page=${page}`
    }

    const data = await naraFetch(url, apiKey)
    const { records, total: pageTotal } = extractHitsAndTotal(data)
    if (total === 0) total = pageTotal
    callCount++

    // Track last naId for searchAfter chaining
    let lastNaId: number | null = null
    for (const rec of records) {
      const naIdRaw = rec.naId
      if (naIdRaw != null) lastNaId = typeof naIdRaw === 'string' ? parseInt(naIdRaw, 10) : naIdRaw

      const candidate = buildCandidate(rec, rg)
      if (!candidate) { counts.errors++; continue }
      if (dryRun) { counts.ingested++; continue }
      try {
        const result = await prisma.$transaction(
          async (tx) => writeRow(tx, candidate, topicIds),
          { timeout: 30000 },
        )
        if (result === 'ingested') counts.ingested++
        else counts.skipped++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: ${candidate.externalId} — ${msg}`)
        counts.errors++
      }
    }

    const fetched = (saved?.fetched ?? 0) + counts.ingested + counts.skipped + counts.errors
    const done = records.length < PAGE_SIZE

    // After page 100, switch to searchAfter pagination to bypass the 10k window
    const nextSearchAfterNaId = (page >= 100 || searchAfterNaId != null) && lastNaId != null
      ? lastNaId
      : null
    const nextPage = searchAfterNaId != null ? page : page + 1

    if (!dryRun) {
      cursorState[cursorKey] = {
        nextPage: nextPage,
        fetched,
        total,
        complete: done,
        ...(nextSearchAfterNaId != null ? { searchAfterNaId: nextSearchAfterNaId } : {}),
      }
      saveCursor(cursorState)
    }

    const pLabel = searchAfterNaId != null ? `searchAfter(${searchAfterNaId})` : `p${page}`
    console.log(`    ${label} ${pLabel}: +${records.length} records (api total: ${total}), ingested ${counts.ingested}, skipped ${counts.skipped}`)

    if (done) { console.log(`  ${label}: complete`); break }
    if (maxPages !== null && callCount >= maxPages) {
      console.warn(`  ${label}: reached call limit (${maxPages}); run with --resume to continue`)
      break
    }

    if (nextSearchAfterNaId != null) {
      searchAfterNaId = nextSearchAfterNaId
    } else {
      page++
    }
  }

  return { counts }
}

// Legacy: collect all records in memory (used for dry-run candidate display only)
async function fetchRecordGroup(
  rg: RecordGroupDef,
  apiKey: string,
  dryRun: boolean,
  maxPages: number | null = 100,
): Promise<{ records: NaraRecord[]; total: number }> {
  if (dryRun) return fetchRecordGroupDryRun(rg, apiKey)

  const all: NaraRecord[] = []
  let page = 1
  let total = 0
  const effectiveMax = maxPages ?? Infinity

  for (;;) {
    const baseUrl = `${NARA_BASE}/records/search?levelOfDescription=item&limit=${PAGE_SIZE}&recordGroupNumber=${rg.number}`
    const data = await naraFetch(`${baseUrl}&page=${page}`, apiKey)
    const { records, total: pageTotal } = extractHitsAndTotal(data)
    if (total === 0) total = pageTotal
    all.push(...records)
    console.log(`    RG ${rg.number}: fetched ${all.length}/${total}`)
    if (records.length < PAGE_SIZE) break
    if (page >= effectiveMax) {
      console.warn(`    RG ${rg.number}: reached ${effectiveMax}-page limit; may not have all records`)
      break
    }
    page++
  }

  return { records: all, total }
}

// ── Build candidates ──────────────────────────────────────────────────────────

function parseNaraDate(dateStr: string | null | undefined): { date: Date | null; precision: string | null } {
  if (!dateStr?.trim()) return { date: null, precision: null }
  const s = dateStr.trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const d = new Date(s + 'T00:00:00Z')
    if (!isNaN(d.getTime())) return { date: d, precision: 'DAY' }
  }
  if (/^\d{4}-\d{2}$/.test(s)) {
    const d = new Date(s + '-01T00:00:00Z')
    if (!isNaN(d.getTime())) return { date: d, precision: 'MONTH' }
  }
  if (/^\d{4}$/.test(s)) {
    const d = new Date(s + '-01-01T00:00:00Z')
    if (!isNaN(d.getTime())) return { date: d, precision: 'YEAR' }
  }
  return { date: null, precision: null }
}

function buildClaimText(title: string, recordGroup: string, beginDate: string | null, endDate: string | null): string {
  if (beginDate && endDate && beginDate !== endDate) {
    return `"${title}" — archived at NARA, Record Group ${recordGroup}, originally dated ${beginDate}–${endDate}`
  }
  if (beginDate || endDate) {
    return `"${title}" — archived at NARA, Record Group ${recordGroup}, originally dated ${beginDate ?? endDate}`
  }
  return `"${title}" — archived at NARA, Record Group ${recordGroup}`
}

function buildCandidate(rec: NaraRecord, rg: RecordGroupDef): CandidateRecord | null {
  const naId = rec.naId != null ? String(rec.naId) : null
  if (!naId || !rec.title?.trim()) return null

  const title = rec.title.trim()
  const beginDate = rec.beginDate?.trim() || null
  const endDate = rec.endDate?.trim() || null
  const seriesTitle = rec.seriesTitle?.trim() || rec.parentSeries?.title?.trim() || null
  const scopeNote = rec.scopeAndContentNote?.trim() || null
  const accessRestriction = rec.accessRestriction?.restriction ?? 'Unrestricted'

  const objects = toArray(rec.objects)
  const digitized = objects.some(o => !!o.file?.url)

  const { date: publishedAt, precision: claimEmergedPrecision } = parseNaraDate(beginDate)

  return {
    naId,
    externalId: `nara_catalog_${naId}`,
    title,
    recordGroup: rg.number,
    seriesTitle,
    beginDate,
    endDate,
    accessRestriction,
    scopeNote,
    digitized,
    sourceUrl: `https://catalog.archives.gov/id/${naId}`,
    claimText: buildClaimText(title, rg.number, beginDate, endDate),
    publishedAt,
    claimEmergedAt: publishedAt,
    claimEmergedPrecision,
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

async function ensureAllTopics(): Promise<Map<string, { rootId: string; rgId: string }>> {
  const rootId = await ensureTopic('nara-catalog', 'US National Archives (NARA) Catalog', 'government')
  const map = new Map<string, { rootId: string; rgId: string }>()
  for (const rg of RECORD_GROUPS) {
    const rgId = await ensureTopic(
      rg.topicSlug,
      `NARA Record Group ${rg.number} — ${rg.name}`,
      rg.domain,
      'nara-catalog',
    )
    map.set(rg.number, { rootId, rgId })
  }
  return map
}

// ── Core: write one record ────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

async function writeRow(
  tx: TxClient,
  rec: CandidateRecord,
  topicIds: string[],
): Promise<IngestResult> {
  const existing = await tx.claim.findUnique({ where: { externalId: rec.externalId }, select: { id: true } })
  if (existing) return 'skipped'

  const sourceExternalId = `nara_source_${rec.naId}`
  let source = await tx.source.findUnique({ where: { externalId: sourceExternalId } })
  if (!source) {
    try {
      source = await tx.source.create({
        data: {
          name: rec.title.length > 500 ? rec.title.slice(0, 497) + '…' : rec.title,
          url: rec.sourceUrl,
          publishedAt: rec.publishedAt,
          methodologyType: 'primary',
          ingestedBy: INGESTED_BY,
          humanReviewed: false,
          autoApproved: true,
          externalId: sourceExternalId,
        },
      })
    } catch {
      // Another worker or prior partial run already created this source — fetch it
      source = await tx.source.findUniqueOrThrow({ where: { externalId: sourceExternalId } })
    }
  }

  const claim = await tx.claim.create({
    data: {
      text: rec.claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt: rec.claimEmergedAt,
      claimEmergedPrecision: rec.claimEmergedPrecision,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: true,
      externalId: rec.externalId,
      metadata: {
        dataset: INGESTED_BY,
        naId: rec.naId,
        recordGroup: rec.recordGroup,
        seriesTitle: rec.seriesTitle,
        beginDate: rec.beginDate,
        endDate: rec.endDate,
        accessRestriction: rec.accessRestriction,
        scopeNote: rec.scopeNote,
        digitized: rec.digitized,
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
      reason: 'NARA Catalog official archival record — HARD_FACT',
      changedAt: rec.claimEmergedAt ?? new Date(),
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
  const { mode, recordGroups, apiKey, maxPages, isResume, isFull, yearStart: yearStartArg, yearEnd: yearEndArg, isCheckLimits } = parseArgs()

  // ── --check-limits: probe rate limit headers and exit ──────────────────────
  if (isCheckLimits) {
    console.log('Probing NARA API rate limit headers (1 request)...')
    const probeUrl = `${NARA_BASE}/records/search?levelOfDescription=item&limit=1&recordGroupNumber=263`
    await throttle()
    const res = await fetch(probeUrl, {
      headers: { 'Accept': 'application/json', 'x-api-key': apiKey },
    })
    console.log(`\nHTTP ${res.status}`)
    console.log('\nAll response headers:')
    res.headers.forEach((val, key) => {
      console.log(`  ${key}: ${val}`)
    })
    const rateHeaders = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset',
      'ratelimit-limit', 'ratelimit-remaining', 'ratelimit-reset',
      'retry-after', 'x-quota-limit', 'x-quota-remaining', 'x-quota-reset']
    console.log('\nRate-limit specific headers:')
    let found = false
    for (const h of rateHeaders) {
      const v = res.headers.get(h)
      if (v) { console.log(`  ${h}: ${v}`); found = true }
    }
    if (!found) console.log('  (none found — NARA may not expose rate limit headers)')
    return
  }

  const currentYear = new Date().getFullYear()
  const yearStart = yearStartArg ?? DEFAULT_YEAR_START
  const yearEnd = yearEndArg ?? currentYear

  console.log(`\n── Pipeline: NARA Catalog (${INGESTED_BY}) ────────────────────────────`)
  console.log(`Mode: ${mode}${isResume ? ' (resume)' : ''} | Record groups: ${recordGroups.map(rg => `RG ${rg.number}`).join(', ')}`)
  console.log(`API key: ${apiKey.slice(0, 4)}${'*'.repeat(Math.max(0, apiKey.length - 4))}`)
  console.log(`Pagination: page-based (p1-100), then searchAfter deep pagination (bypasses 10k cap)`)
  if (maxPages === null) console.log('Page cap: none (full run)')
  else console.log(`Page cap: ${maxPages} pages per group`)

  // Step 1: Topics (skipped in dry-run)
  let topicMap = new Map<string, { rootId: string; rgId: string }>()
  if (mode !== 'dry-run') {
    console.log('\nStep 1: Ensuring topics...')
    topicMap = await ensureAllTopics()
  } else {
    console.log('\nStep 1: Skipping topic DB writes (dry-run mode).')
  }

  // ── Dry-run ────────────────────────────────────────────────────────────────
  if (mode === 'dry-run') {
    if (isFull) {
      console.log('\nStep 2: Dry-run (full pagination path, no DB writes)...')
      const cursorState: CursorState = {}
      const totals: Counts = { ingested: 0, skipped: 0, errors: 0 }
      for (const rg of recordGroups) {
        const { counts } = await fetchAndWriteGroup(rg, apiKey, [], cursorState, maxPages ?? 2, /* dryRun= */ true)
        totals.ingested += counts.ingested
        totals.skipped += counts.skipped
        totals.errors += counts.errors
      }
      console.log(`\nDry-run complete.`)
      console.log(`  Would ingest: ${totals.ingested} | Errors: ${totals.errors}`)
      console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
      return
    }

    // Simple dry-run: just fetch a small sample to verify API connectivity
    console.log('\nStep 2: Fetching sample items from NARA Catalog API v2...')
    const allCandidates: CandidateRecord[] = []
    const rgBreakdown = new Map<string, { fetched: number; total: number; candidates: number }>()
    let skippedMalformed = 0

    for (const rg of recordGroups) {
      console.log(`  Fetching RG ${rg.number} — ${rg.name}...`)
      const { records, total } = await fetchRecordGroupDryRun(rg, apiKey)
      console.log(`    Retrieved ${records.length} records (API total: ${total})`)

      let candidatesThisRg = 0
      for (const rec of records) {
        const candidate = buildCandidate(rec, rg)
        if (!candidate) { skippedMalformed++; continue }
        allCandidates.push(candidate)
        candidatesThisRg++
      }
      rgBreakdown.set(rg.number, { fetched: records.length, total, candidates: candidatesThisRg })
    }

    console.log(`\nTotal candidates: ${allCandidates.length} (skipped malformed: ${skippedMalformed})`)
    console.log('\nStep 3: Writing dry-run sample (no DB writes)...')

    const sample = allCandidates.map(r => ({
      claimText: r.claimText,
      externalId: r.externalId,
      naId: r.naId,
      recordGroup: r.recordGroup,
      seriesTitle: r.seriesTitle,
      beginDate: r.beginDate,
      endDate: r.endDate,
      digitized: r.digitized,
      scopeNote: r.scopeNote ? r.scopeNote.slice(0, 200) + (r.scopeNote.length > 200 ? '…' : '') : null,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      autoApproved: true,
      humanReviewed: false,
      ingestedBy: INGESTED_BY,
      source: { url: r.sourceUrl, methodologyType: 'primary', name: r.title },
    }))

    const rgSummary: Record<string, { fetched: number; apiTotal: number }> = {}
    for (const [num, { fetched, total }] of rgBreakdown) {
      rgSummary[`RG ${num}`] = { fetched, apiTotal: total }
    }

    const output = {
      runDate: new Date().toISOString(),
      apiNote: 'NARA Catalog API v2 — requires x-api-key header (register at Catalog_API@nara.gov)',
      recordGroups: recordGroups.map(rg => `RG ${rg.number} — ${rg.name}`),
      totalCandidates: allCandidates.length,
      rgBreakdown: rgSummary,
      sample,
    }

    fs.writeFileSync('pipeline-nara-dry-run-sample.json', JSON.stringify(output, null, 2))
    console.log('  Written: pipeline-nara-dry-run-sample.json')
    console.log('\nDry-run complete.')
    console.log('\nSTOP — awaiting explicit go-ahead from Robert before full run.')
    return
  }

  // ── Full run (with or without --resume) ───────────────────────────────────
  // Pages 1-100 use page= param (10k records). After page 100, automatically switches to
  // searchAfter=<naId> deep pagination to retrieve all records beyond 10k.
  // Use --max-pages to cap API calls per run, then --resume next month to continue.

  const cursorState: CursorState = isResume ? loadCursor() : {}

  if (isResume) {
    console.log(`\nResume mode: loaded cursor from ${CURSOR_FILE}`)
    for (const [key, c] of Object.entries(cursorState)) {
      console.log(`  ${key}: nextPage=${c.nextPage}, fetched=${c.fetched}, total=${c.total}, complete=${c.complete}`)
    }
  }

  console.log(`\nStep 2: Full ingestion — page-based pagination × ${recordGroups.length} RG(s)${maxPages ? ` (capped at ${maxPages} pages/RG)` : ''}...`)
  const startTime = Date.now()
  const totals: Counts = { ingested: 0, skipped: 0, errors: 0 }

  for (const rg of recordGroups) {
    const topics = topicMap.get(rg.number)
    const topicIds = topics ? [topics.rootId, topics.rgId] : []
    const { counts } = await fetchAndWriteGroup(rg, apiKey, topicIds, cursorState, maxPages)
    totals.ingested += counts.ingested
    totals.skipped += counts.skipped
    totals.errors += counts.errors
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nIngestion complete in ${elapsed}s`)
  console.log(`  Ingested: ${totals.ingested} | Skipped: ${totals.skipped} | Errors: ${totals.errors}`)
  console.log(`  Cursor checkpoint: ${CURSOR_FILE}`)

  console.log('\nPost-ingestion DB verification...')
  const dbSources = await prisma.source.count({ where: { ingestedBy: INGESTED_BY } })
  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  Sources: ${dbSources}`)
  console.log(`  Claims:  ${dbClaims}`)
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
}).finally(() => prisma.$disconnect())
