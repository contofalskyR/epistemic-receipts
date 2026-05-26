// OpenAlex academic literature ingestion — peer-reviewed research as HARD_FACT EMPIRICAL claims
// Creates: Claims (EMPIRICAL HARD_FACT), Sources (the journal/venue), Edges
// No CITES cross-references — ingesters produce facts, humans curate connections
// Docs: https://docs.openalex.org/
// Run: npx tsx scripts/ingest-openalex.ts --bucket [cognition|biomedical|policy] --limit N

import 'dotenv/config'
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
  search: string
  extraTopicSlugs: string[]  // tagged onto every claim in this bucket
}

const BUCKETS: Record<string, BucketConfig> = {
  cognition: {
    conceptIds: ['C15744967', 'C188147891'], // Psychology, Cognitive science
    search: 'cognitive science OR perception OR categorization OR learning',
    extraTopicSlugs: ['cognitive-science', 'psychology'],
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
}

const SELECT_FIELDS = [
  'id', 'doi', 'title', 'publication_date',
  'abstract_inverted_index', 'primary_location',
].join(',')

async function* paginateWorks(cfg: BucketConfig, cap: number): AsyncGenerator<OAWork> {
  let cursor: string | null = '*'
  let yielded = 0

  while (cursor) {
    const url = new URL(OA_BASE)
    url.searchParams.set('filter', `concepts.id:${cfg.conceptIds.join('|')}`)
    url.searchParams.set('search', cfg.search)
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
      { slug: 'psychology',         name: 'Psychology',        domain: 'academic-literature' },
    ],
    biomedical: [
      { slug: 'biomedical-research', name: 'Biomedical Research', domain: 'academic-literature' },
      { slug: 'medicine',            name: 'Medicine',            domain: 'medicine' },
    ],
    policy: [
      { slug: 'policy-research',    name: 'Policy Research',    domain: 'academic-literature' },
      { slug: 'political-science',  name: 'Political Science',  domain: 'academic-literature' },
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

  if (!BUCKETS[bucket]) {
    console.error(`Unknown bucket: ${bucket}. Use: ${Object.keys(BUCKETS).join(' | ')}`)
    await prisma.$disconnect()
    process.exit(1)
  }

  const result = await runBucket(bucket, limit)

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
