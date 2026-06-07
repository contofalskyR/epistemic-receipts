// OpenAlex academic literature ingestion — peer-reviewed research as HARD_FACT EMPIRICAL claims
// Creates: Claims (EMPIRICAL HARD_FACT), Sources (the journal/venue), Edges
// No CITES cross-references — ingesters produce facts, humans curate connections
// Docs: https://docs.openalex.org/
// Run: npx tsx scripts/ingest-openalex.ts --bucket [cognition|biomedical|policy] --limit N

import 'dotenv/config'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const OA_BASE = 'https://api.openalex.org/works'
const MAILTO = 'robert.contofalsky@rutgers.edu'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OAWork {
  id?: string
  doi?: string | null
  title?: string | null
  publication_date?: string | null
  abstract_inverted_index?: Record<string, number[]> | null
  primary_location?: {
    landing_page_url?: string | null
    source?: {
      display_name?: string | null
      host_organization_name?: string | null
      type?: string | null
    } | null
  } | null
}

interface OAResponse {
  meta?: { count?: number; next_cursor?: string | null }
  results?: OAWork[]
}

type IngestResult = 'ingested' | 'skipped' | 'failed'
type Counts = { ingested: number; skipped: number; errors: number }

// ── CLI ───────────────────────────────────────────────────────────────────────

function parseArgs(): { bucket: string; limit: number } {
  const args = process.argv.slice(2)
  const bucketIdx = args.indexOf('--bucket')
  const limitIdx  = args.indexOf('--limit')
  const bucket = bucketIdx !== -1 ? (args[bucketIdx + 1] ?? 'cognition') : 'cognition'
  const limit  = limitIdx  !== -1 ? (parseInt(args[limitIdx + 1] ?? '0', 10) || 0) : 0
  return { bucket, limit }
}

// ── Rate limiting (4 req/sec polite) ──────────────────────────────────────────

let lastReqAt = 0
const MIN_INTERVAL = 250

function sleep(ms: number) { return new Promise<void>(r => setTimeout(r, ms)) }

async function throttle() {
  const wait = MIN_INTERVAL - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

// ── HTTP with retry ───────────────────────────────────────────────────────────

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  let delay = 1000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { 'User-Agent': `epistemic-receipts (mailto:${MAILTO})` } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    return res
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── OpenAlex bucket config ────────────────────────────────────────────────────

interface BucketConfig {
  conceptIds: string[]       // OR-filtered
  search?: string
  extraFilters?: string[]    // additional comma-joined filter clauses (e.g. is_retracted:true)
  extraTopicSlugs: string[]  // tagged onto every claim in this bucket
}

const BUCKETS: Record<string, BucketConfig> = {
  cognition: {
    conceptIds: ['C15744967', 'C188147891'], // Psychology, Cognitive science
    search: 'cognitive science OR perception OR categorization OR learning',
    extraTopicSlugs: ['cognitive-science', 'psychology', 'neuroscience'],
  },
  biomedical: {
    conceptIds: ['C71924100', 'C86803240'], // Medicine, Biology
    search: 'clinical trial OR drug efficacy OR disease treatment',
    extraTopicSlugs: ['biomedical-research', 'medicine'],
  },
  policy: {
    conceptIds: ['C17744445', 'C162324750'], // Political science, Economics
    search: 'policy analysis OR regulatory impact OR legislation',
    extraTopicSlugs: ['policy-research', 'political-science'],
  },
  // Targets the fields where CrossRef retractions cluster (paper-mill heavy domains).
  // is_retracted:true narrows to ~71k OpenAlex works in these fields; has_doi:true
  // is required for CrossRef DOI-based linkage in link-retractions-crossref.ts.
  'retraction-prone-fields': {
    conceptIds: ['C192562407', 'C185592680', 'C41008148'], // Materials science, Chemistry, Engineering
    extraFilters: ['is_retracted:true', 'has_doi:true'],
    extraTopicSlugs: ['materials-science', 'chemistry', 'engineering'],
  },
  neuroscience: {
    conceptIds: ['C54355233', 'C2522767166'], // Neuroscience, Neurology
    extraTopicSlugs: ['neuroscience'],
  },
  biology: {
    conceptIds: ['C86803240', 'C184235292'], // Biology, Evolutionary biology
    extraTopicSlugs: ['biology'],
  },
  physics: {
    conceptIds: ['C121332964', 'C62520636'], // Physics, Quantum mechanics
    extraTopicSlugs: ['physics'],
  },
  mathematics: {
    conceptIds: ['C33923547'], // Mathematics
    extraTopicSlugs: ['mathematics'],
  },
  anthropology: {
    conceptIds: ['C142362112'], // Anthropology
    extraTopicSlugs: ['anthropology'],
  },
  economics: {
    conceptIds: ['C162324750'], // Economics
    extraTopicSlugs: ['economics'],
  },
  physiology: {
    conceptIds: ['C1276874', 'C153294291', 'C126255220'], // Physiology, Endocrinology, Cardiology
    extraTopicSlugs: ['physiology'],
  },
  chemistry: {
    conceptIds: ['C185592680', 'C178790620'], // Chemistry, Organic chemistry
    extraTopicSlugs: ['chemistry'],
  },
  'computer-science': {
    conceptIds: ['C41008148', 'C154945302'], // Computer science, Machine learning
    extraTopicSlugs: ['computer-science'],
  },
  linguistics: {
    conceptIds: ['C204321447', 'C2779134260'], // Linguistics, Natural language processing
    extraTopicSlugs: ['linguistics'],
  },
  sociology: {
    conceptIds: ['C144024400', 'C17744445'], // Sociology, Political science (overlaps intentional)
    extraTopicSlugs: ['sociology'],
  },
  law: {
    conceptIds: ['C295410457'], // Law
    extraTopicSlugs: ['law'],
  },
  'earth-science': {
    conceptIds: ['C143998085', 'C39432304'], // Geology, Environmental science
    extraTopicSlugs: ['earth-science'],
  },
}

const SELECT_FIELDS = [
  'id', 'doi', 'title', 'publication_date',
  'abstract_inverted_index', 'primary_location',
].join(',')

async function* paginateWorks(cfg: BucketConfig, cap: number): AsyncGenerator<OAWork> {
  let cursor: string | null = '*'
  let yielded = 0

  const filterParts = [`concepts.id:${cfg.conceptIds.join('|')}`]
  if (cfg.extraFilters) filterParts.push(...cfg.extraFilters)
  const filter = filterParts.join(',')

  while (cursor) {
    const url = new URL(OA_BASE)
    url.searchParams.set('filter', filter)
    if (cfg.search) url.searchParams.set('search', cfg.search)
    url.searchParams.set('per-page', '200')
    url.searchParams.set('cursor', cursor)
    url.searchParams.set('select', SELECT_FIELDS)
    url.searchParams.set('mailto', MAILTO)

    const res = await fetchWithRetry(url.toString())
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  OpenAlex API ${res.status}: ${text.slice(0, 200)}`)
      return
    }
    const data = await res.json() as OAResponse
    const results = data.results ?? []
    if (results.length === 0) return

    for (const work of results) {
      yield work
      yielded++
      if (cap > 0 && yielded >= cap) return
    }
    cursor = data.meta?.next_cursor ?? null
  }
}

// ── Abstract reconstruction ───────────────────────────────────────────────────

function reconstructAbstract(idx: Record<string, number[]> | null | undefined): string | null {
  if (!idx) return null
  const positions: Array<[number, string]> = []
  for (const [word, posList] of Object.entries(idx)) {
    for (const pos of posList) positions.push([pos, word])
  }
  if (positions.length === 0) return null
  positions.sort((a, b) => a[0] - b[0])
  return positions.map(p => p[1]).join(' ')
}

// ── Validation / helpers ──────────────────────────────────────────────────────

function extractWorkId(oaId: string | undefined): string | null {
  if (!oaId) return null
  const m = oaId.match(/W\d+$/)
  return m ? m[0] : null
}

function doiToUrl(doi: string | null | undefined): string | null {
  if (!doi) return null
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, '')
  return `https://doi.org/${clean}`
}

function parseDate(s: string | null | undefined): Date | null {
  if (!s) return null
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

// ── Topic management ──────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

async function ensureTopic(
  slug: string, name: string, domain: string, parentSlug?: string,
): Promise<string> {
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

async function ensureCoreTopics(bucket: string): Promise<string[]> {
  const root = await ensureTopic('academic-literature', 'Academic Literature', 'academic-literature')
  const bucketTopics: Record<string, Array<{ slug: string; name: string; domain: string }>> = {
    cognition: [
      { slug: 'cognitive-science', name: 'Cognitive Science', domain: 'academic-literature' },
      { slug: 'psychology',        name: 'Psychology',        domain: 'academic-literature' },
      { slug: 'neuroscience',      name: 'Neuroscience',      domain: 'academic-literature' },
    ],
    biomedical: [
      { slug: 'biomedical-research', name: 'Biomedical Research', domain: 'academic-literature' },
      { slug: 'medicine',            name: 'Medicine',            domain: 'medicine' },
    ],
    policy: [
      { slug: 'policy-research',    name: 'Policy Research',    domain: 'academic-literature' },
      { slug: 'political-science',  name: 'Political Science',  domain: 'academic-literature' },
    ],
    'aesthetic-medicine': [
      { slug: 'aesthetic-medicine', name: 'Aesthetic Medicine',             domain: 'academic-literature' },
      { slug: 'aesthetics',         name: 'Aesthetics & Cosmetic Medicine', domain: 'medicine' },
    ],
    'retraction-prone-fields': [
      { slug: 'materials-science', name: 'Materials Science', domain: 'academic-literature' },
      { slug: 'chemistry',         name: 'Chemistry',         domain: 'academic-literature' },
      { slug: 'engineering',       name: 'Engineering',       domain: 'academic-literature' },
    ],
    neuroscience: [
      { slug: 'neuroscience', name: 'Neuroscience', domain: 'academic-literature' },
    ],
    biology: [
      { slug: 'biology', name: 'Biology', domain: 'academic-literature' },
    ],
    physics: [
      { slug: 'physics', name: 'Physics', domain: 'academic-literature' },
    ],
    mathematics: [
      { slug: 'mathematics', name: 'Mathematics', domain: 'academic-literature' },
    ],
    anthropology: [
      { slug: 'anthropology', name: 'Anthropology', domain: 'academic-literature' },
    ],
    economics: [
      { slug: 'economics', name: 'Economics', domain: 'academic-literature' },
    ],
    physiology: [
      { slug: 'physiology', name: 'Physiology', domain: 'academic-literature' },
    ],
    chemistry: [
      { slug: 'chemistry', name: 'Chemistry', domain: 'academic-literature' },
    ],
    'computer-science': [
      { slug: 'computer-science', name: 'Computer Science', domain: 'academic-literature' },
    ],
    linguistics: [
      { slug: 'linguistics', name: 'Linguistics', domain: 'academic-literature' },
    ],
    sociology: [
      { slug: 'sociology', name: 'Sociology', domain: 'academic-literature' },
    ],
    law: [
      { slug: 'law', name: 'Law', domain: 'academic-literature' },
    ],
    'earth-science': [
      { slug: 'earth-science', name: 'Earth Science', domain: 'academic-literature' },
    ],
  }
  const ids = [root]
  for (const t of bucketTopics[bucket] ?? []) {
    ids.push(await ensureTopic(t.slug, t.name, t.domain, 'academic-literature'))
  }
  return ids
}

async function tagClaim(claimId: string, topicIds: string[]): Promise<void> {
  for (const topicId of topicIds) {
    await prisma.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Core: ingest one work ─────────────────────────────────────────────────────

async function ingestWork(work: OAWork, topicIds: string[]): Promise<IngestResult> {
  const workId = extractWorkId(work.id)
  if (!workId) return 'skipped'

  const title = work.title?.trim()
  if (!title) return 'skipped'

  const doiUrl  = doiToUrl(work.doi)
  const landing = work.primary_location?.landing_page_url?.trim() || null
  const sourceUrl = doiUrl ?? landing
  if (!sourceUrl) return 'skipped'

  const externalId = `openalex_${workId}`
  const existing = await prisma.claim.findUnique({ where: { externalId } })
  if (existing) return 'skipped'

  // Also dedupe by Source.externalId tied to landing URL (covers cross-bucket dupes)
  const sourceExternalId = `openalex_source_${workId}`
  const existingSource = await prisma.source.findUnique({ where: { externalId: sourceExternalId } })
  if (existingSource) return 'skipped'

  const abstract = reconstructAbstract(work.abstract_inverted_index)
  const summary = (abstract && abstract.length > 0 ? abstract : title).slice(0, 500)

  const publishedAt = parseDate(work.publication_date)
  const venueName = work.primary_location?.source?.display_name?.trim()
    ?? work.primary_location?.source?.host_organization_name?.trim()
    ?? 'OpenAlex'

  try {
    const { claimId } = await prisma.$transaction(async tx => {
      const source = await tx.source.create({
        data: {
          name: venueName,
          url: sourceUrl,
          publishedAt,
          methodologyType: 'primary',
          ingestedBy: 'openalex_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: sourceExternalId,
        },
      })

      const claim = await tx.claim.create({
        data: {
          text: summary,
          claimType: 'EMPIRICAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: publishedAt,
          claimEmergedPrecision: publishedAt ? 'DAY' : null,
          ingestedBy: 'openalex_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId,
          metadata: {
            dataset: 'openalex_v1',
            openalex_id: workId,
            title,
            doi: work.doi ?? null,
            venue: venueName,
          },
        },
      })

      const edge = await tx.edge.create({
        data: {
          sourceId: source.id,
          claimId: claim.id,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'openalex_v1',
          humanReviewed: false,
          autoApproved: true,
        },
      })

      await tx.edgeRevision.create({
        data: {
          edgeId: edge.id,
          priorScore: null,
          newScore: 80,
          reason: 'OpenAlex — peer-reviewed publication record',
          changedAt: publishedAt ?? new Date(),
        },
      })

      return { claimId: claim.id }
    }, { timeout: 30000 })

    await tagClaim(claimId, topicIds)
    return 'ingested'
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Failed: ${workId} — ${msg}`)
    return 'failed'
  }
}

// ── Batched ingest (fast path for large buckets) ─────────────────────────────
// Per-page bulk inserts via createMany. Generates client-side IDs so all rows
// (Source, Claim, Edge, EdgeRevision, ClaimTopic) can be inserted in one tx.

interface PreparedRow {
  workId: string
  title: string
  summary: string
  sourceUrl: string
  venueName: string
  publishedAt: Date | null
  doi: string | null
  claimExternalId: string
  sourceExternalId: string
}

function prepareWork(work: OAWork): PreparedRow | null {
  const workId = extractWorkId(work.id)
  if (!workId) return null
  const title = work.title?.trim()
  if (!title) return null
  const doiUrl = doiToUrl(work.doi)
  const landing = work.primary_location?.landing_page_url?.trim() || null
  const sourceUrl = doiUrl ?? landing
  if (!sourceUrl) return null

  const abstract = reconstructAbstract(work.abstract_inverted_index)
  const summary = (abstract && abstract.length > 0 ? abstract : title).slice(0, 500)
  const publishedAt = parseDate(work.publication_date)
  const venueName = work.primary_location?.source?.display_name?.trim()
    ?? work.primary_location?.source?.host_organization_name?.trim()
    ?? 'OpenAlex'

  return {
    workId,
    title,
    summary,
    sourceUrl,
    venueName,
    publishedAt,
    doi: work.doi ?? null,
    claimExternalId: `openalex_${workId}`,
    sourceExternalId: `openalex_source_${workId}`,
  }
}

async function ingestBatch(works: OAWork[], topicIds: string[]): Promise<Counts> {
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  const prepared: PreparedRow[] = []
  for (const w of works) {
    const r = prepareWork(w)
    if (r) prepared.push(r)
    else counts.skipped++
  }
  if (prepared.length === 0) return counts

  const claimExtIds  = prepared.map(p => p.claimExternalId)
  const sourceExtIds = prepared.map(p => p.sourceExternalId)

  const [existingClaims, existingSources] = await Promise.all([
    prisma.claim.findMany({
      where: { externalId: { in: claimExtIds } },
      select: { externalId: true },
    }),
    prisma.source.findMany({
      where: { externalId: { in: sourceExtIds } },
      select: { externalId: true },
    }),
  ])
  const existingClaimSet  = new Set(existingClaims.map(c => c.externalId!))
  const existingSourceSet = new Set(existingSources.map(s => s.externalId!))

  const fresh = prepared.filter(p =>
    !existingClaimSet.has(p.claimExternalId) && !existingSourceSet.has(p.sourceExternalId),
  )
  counts.skipped += prepared.length - fresh.length
  if (fresh.length === 0) return counts

  const rows = fresh.map(p => ({
    ...p,
    sourceId: randomUUID(),
    claimId:  randomUUID(),
    edgeId:   randomUUID(),
  }))

  try {
    await prisma.$transaction(async tx => {
      await tx.source.createMany({
        data: rows.map(r => ({
          id: r.sourceId,
          name: r.venueName,
          url: r.sourceUrl,
          publishedAt: r.publishedAt,
          methodologyType: 'primary',
          ingestedBy: 'openalex_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: r.sourceExternalId,
        })),
      })

      await tx.claim.createMany({
        data: rows.map(r => ({
          id: r.claimId,
          text: r.summary,
          claimType: 'EMPIRICAL',
          currentStatus: 'HARD_FACT',
          claimEmergedAt: r.publishedAt,
          claimEmergedPrecision: r.publishedAt ? 'DAY' : null,
          ingestedBy: 'openalex_v1',
          humanReviewed: false,
          autoApproved: true,
          externalId: r.claimExternalId,
          metadata: {
            dataset: 'openalex_v1',
            openalex_id: r.workId,
            title: r.title,
            doi: r.doi,
            venue: r.venueName,
          },
        })),
      })

      await tx.edge.createMany({
        data: rows.map(r => ({
          id: r.edgeId,
          sourceId: r.sourceId,
          claimId: r.claimId,
          type: 'FOR',
          evidenceType: 'EVIDENTIARY',
          ingestedBy: 'openalex_v1',
          humanReviewed: false,
          autoApproved: true,
        })),
      })

      await tx.edgeRevision.createMany({
        data: rows.map(r => ({
          edgeId: r.edgeId,
          priorScore: null,
          newScore: 80,
          reason: 'OpenAlex — peer-reviewed publication record',
          changedAt: r.publishedAt ?? new Date(),
        })),
      })

      await tx.claimTopic.createMany({
        data: rows.flatMap(r => topicIds.map(tid => ({ claimId: r.claimId, topicId: tid }))),
        skipDuplicates: true,
      })
    }, { timeout: 60000 })

    counts.ingested += rows.length
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  Batch failed (${rows.length} rows): ${msg}`)
    counts.errors += rows.length
  }

  return counts
}

async function runBucketBatched(bucket: string, limit: number): Promise<Counts> {
  const cfg = BUCKETS[bucket]
  if (!cfg) throw new Error(`Unknown bucket: ${bucket}`)

  const topicIds = await ensureCoreTopics(bucket)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  let batch: OAWork[] = []
  const BATCH_SIZE = 200
  let seen = 0
  const fetchCap = limit > 0 ? limit + 1000 : 0

  async function flush() {
    if (batch.length === 0) return
    const r = await ingestBatch(batch, topicIds)
    counts.ingested += r.ingested
    counts.skipped  += r.skipped
    counts.errors   += r.errors
    batch = []
    console.log(`  Progress: seen=${seen} ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
  }

  for await (const work of paginateWorks(cfg, fetchCap)) {
    if (limit > 0 && counts.ingested >= limit) break
    seen++
    batch.push(work)
    if (batch.length >= BATCH_SIZE) await flush()
  }
  await flush()

  return counts
}

// ── Aesthetic-medicine bucket ─────────────────────────────────────────────────
// Multi-search sweep with per-search primary_topic.field filter.
// Each search capped at 500 works; dedupe by OpenAlex workId across all searches.

interface AestheticSearch {
  search: string
  // OpenAlex "Dermatology" and "Surgery" are subfields under Medicine (field 27),
  // not fields — so we filter on primary_topic.subfield.id.
  subfield?: 'Dermatology' | 'Surgery'
}

const SUBFIELD_IDS: Record<NonNullable<AestheticSearch['subfield']>, string> = {
  Dermatology: 'subfields/2708',
  Surgery:     'subfields/2746',
}

const AESTHETIC_SEARCHES: AestheticSearch[] = [
  { search: 'aesthetic medicine treatment',     subfield: 'Dermatology' },
  { search: 'cosmetic dermatology',             subfield: 'Dermatology' },
  { search: 'botulinum toxin cosmetic',         subfield: 'Dermatology' },
  { search: 'dermal filler injection',          subfield: 'Dermatology' },
  { search: 'laser skin resurfacing',           subfield: 'Dermatology' },
  { search: 'rhinoplasty outcomes',             subfield: 'Surgery' },
  { search: 'breast augmentation outcomes',     subfield: 'Surgery' },
  { search: 'liposuction outcomes',             subfield: 'Surgery' },
  { search: 'facelift rhytidectomy',            subfield: 'Surgery' },
  { search: 'androgenetic alopecia treatment',  subfield: 'Dermatology' },
  { search: 'acne scar treatment',              subfield: 'Dermatology' },
  { search: 'melasma treatment',                subfield: 'Dermatology' },
  { search: 'body contouring procedures',       subfield: 'Surgery' },
  { search: 'hair transplant outcomes',         subfield: 'Surgery' },
  { search: 'chemical peel outcomes' },
]

const AESTHETIC_PER_SEARCH_CAP = 500

async function* paginateAestheticSearch(
  spec: AestheticSearch,
  cap: number,
): AsyncGenerator<OAWork> {
  let cursor: string | null = '*'
  let yielded = 0

  const filterParts = [
    'type:article',
    'is_paratext:false',
    // publication_year >= 2000 — OpenAlex `>` is strict, so >1999 means >=2000
    'publication_year:>1999',
  ]
  if (spec.subfield) filterParts.push(`primary_topic.subfield.id:${SUBFIELD_IDS[spec.subfield]}`)
  const filter = filterParts.join(',')

  while (cursor) {
    const url = new URL(OA_BASE)
    url.searchParams.set('filter', filter)
    url.searchParams.set('search', spec.search)
    url.searchParams.set('per-page', '200')
    url.searchParams.set('cursor', cursor)
    url.searchParams.set('select', SELECT_FIELDS)
    url.searchParams.set('mailto', MAILTO)

    const res = await fetchWithRetry(url.toString())
    if (!res.ok) {
      const text = await res.text()
      console.warn(`  OpenAlex API ${res.status}: ${text.slice(0, 200)}`)
      return
    }
    const data = await res.json() as OAResponse
    const results = data.results ?? []
    if (results.length === 0) return

    for (const work of results) {
      yield work
      yielded++
      if (yielded >= cap) return
    }
    cursor = data.meta?.next_cursor ?? null
  }
}

async function runAestheticMedicineBucket(limit: number): Promise<Counts> {
  const topicIds = await ensureCoreTopics('aesthetic-medicine')
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const seenWorkIds = new Set<string>()
  let seen = 0

  for (const spec of AESTHETIC_SEARCHES) {
    if (limit > 0 && counts.ingested >= limit) break

    const remaining = limit > 0 ? limit - counts.ingested : AESTHETIC_PER_SEARCH_CAP
    const perSearchCap = Math.min(remaining, AESTHETIC_PER_SEARCH_CAP)
    const fieldLabel = spec.subfield ?? '(no subfield filter)'
    console.log(`\n  Search: "${spec.search}" × ${fieldLabel} (cap ${perSearchCap})`)

    for await (const work of paginateAestheticSearch(spec, perSearchCap)) {
      if (limit > 0 && counts.ingested >= limit) break

      const workId = extractWorkId(work.id)
      if (!workId || seenWorkIds.has(workId)) continue
      seenWorkIds.add(workId)

      seen++
      const result = await ingestWork(work, topicIds)
      if (result === 'ingested') counts.ingested++
      else if (result === 'skipped') counts.skipped++
      else counts.errors++

      if (seen % 100 === 0) {
        console.log(`    Progress: seen=${seen} ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
      }
    }
  }

  return counts
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function runBucket(bucket: string, limit: number): Promise<Counts> {
  const cfg = BUCKETS[bucket]
  if (!cfg) throw new Error(`Unknown bucket: ${bucket}`)

  const topicIds = await ensureCoreTopics(bucket)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  let seen = 0
  const fetchCap = limit > 0 ? Math.max(limit * 3, limit + 200) : 0 // overfetch to absorb dupes/skips

  for await (const work of paginateWorks(cfg, fetchCap)) {
    if (limit > 0 && counts.ingested >= limit) break
    seen++
    const result = await ingestWork(work, topicIds)
    if (result === 'ingested') counts.ingested++
    else if (result === 'skipped') counts.skipped++
    else counts.errors++

    if (seen % 100 === 0) {
      console.log(`  Progress: seen=${seen} ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
  }

  return counts
}

async function main() {
  const { bucket, limit } = parseArgs()
  console.log(`\n=== OpenAlex Ingestion — bucket: ${bucket}, limit: ${limit || 'all'} ===\n`)

  const validBuckets = [...Object.keys(BUCKETS), 'aesthetic-medicine']
  if (!validBuckets.includes(bucket)) {
    console.error(`Unknown bucket: ${bucket}. Use: ${validBuckets.join(' | ')}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  const result = bucket === 'aesthetic-medicine'
    ? await runAestheticMedicineBucket(limit)
    : bucket === 'retraction-prone-fields'
      ? await runBucketBatched(bucket, limit)
      : await runBucket(bucket, limit)

  console.log(`\n=== Summary (${bucket}) ===`)
  console.log(`  Ingested : ${result.ingested}`)
  console.log(`  Skipped  : ${result.skipped}`)
  console.log(`  Errors   : ${result.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
