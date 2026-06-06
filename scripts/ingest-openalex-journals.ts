// OpenAlex journal-sweep ingester — high-quality venue coverage for 1M+ scale
// Sweeps top academic journals by primary_location.source.id, sorted by citation count desc.
// Creates: Claims (EMPIRICAL HARD_FACT), Sources (the paper), Edges
// Pipeline tag: openalex_journals_v1
// Docs: https://docs.openalex.org/
// Run: npx dotenv-cli -e .env.local -- npx tsx --project tsconfig.scripts.json scripts/ingest-openalex-journals.ts [flags]

import 'dotenv/config'
import { randomUUID } from 'crypto'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const OA_BASE = 'https://api.openalex.org/works'
const MAILTO = 'robert.contofalsky@rutgers.edu'
const PIPELINE = 'openalex_journals_v1'

// ── Types ─────────────────────────────────────────────────────────────────────

interface OAWork {
  id?: string
  doi?: string | null
  title?: string | null
  publication_date?: string | null
  cited_by_count?: number | null
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

type Tier = 'science' | 'life' | 'physical' | 'cognitive' | 'economics'

interface JournalConfig {
  sourceId: string
  name: string
  topicSlugs: string[]
  minCitations?: number
  tier: Tier
}

// ── Journal registry ───────────────────────────────────────────────────────────
// Source IDs verified against https://api.openalex.org/sources?search=<name>&mailto=...
// Canonical = highest works_count when multiple results returned.

const JOURNALS: JournalConfig[] = [
  // ── Science/Nature tier (flagship multidisciplinary) ────────────────────────
  {
    sourceId: 'S137773608',
    name: 'Nature',
    topicSlugs: ['academic-literature'],
    tier: 'science',
  },
  {
    sourceId: 'S3880285',
    name: 'Science',
    topicSlugs: ['academic-literature'],
    tier: 'science',
  },
  {
    sourceId: 'S125754415',
    name: 'Proceedings of the National Academy of Sciences',
    topicSlugs: ['academic-literature'],
    tier: 'science',
  },
  {
    sourceId: 'S202381698',
    name: 'PLOS ONE',
    topicSlugs: ['academic-literature'],
    tier: 'science',
  },
  {
    sourceId: 'S64187185',
    name: 'Nature Communications',
    topicSlugs: ['academic-literature'],
    tier: 'science',
  },
  {
    sourceId: 'S196734849',
    name: 'Scientific Reports',
    topicSlugs: ['academic-literature'],
    tier: 'science',
  },
  {
    sourceId: 'S1336409049',
    name: 'eLife',
    topicSlugs: ['academic-literature', 'biology', 'medicine'],
    tier: 'science',
  },

  // ── Life sciences ────────────────────────────────────────────────────────────
  {
    sourceId: 'S110447773',
    name: 'Cell',
    topicSlugs: ['biology', 'medicine'],
    tier: 'life',
  },
  {
    sourceId: 'S203256638',
    name: 'Nature Medicine',
    topicSlugs: ['medicine'],
    tier: 'life',
  },
  {
    sourceId: 'S49861241',
    name: 'The Lancet',
    topicSlugs: ['medicine'],
    tier: 'life',
  },
  {
    sourceId: 'S62468778',
    name: 'New England Journal of Medicine',
    topicSlugs: ['medicine'],
    tier: 'life',
  },
  {
    sourceId: 'S172573765',
    name: 'JAMA',
    topicSlugs: ['medicine'],
    tier: 'life',
  },
  {
    sourceId: 'S192814187',
    name: 'BMJ',
    topicSlugs: ['medicine'],
    tier: 'life',
  },
  {
    sourceId: 'S137905309',
    name: 'Nature Genetics',
    topicSlugs: ['biology', 'genetics'],
    tier: 'life',
  },
  {
    sourceId: 'S106963461',
    name: 'Nature Biotechnology',
    topicSlugs: ['biology', 'biotechnology'],
    tier: 'life',
  },

  // ── Physical sciences ────────────────────────────────────────────────────────
  {
    sourceId: 'S24807848',
    name: 'Physical Review Letters',
    topicSlugs: ['physics'],
    tier: 'physical',
  },
  {
    // Canonical: highest works_count for Physical Review D across all era-named entries
    sourceId: 'S4210238307',
    name: 'Physical Review D',
    topicSlugs: ['physics'],
    tier: 'physical',
  },
  {
    sourceId: 'S77047749',
    name: 'The Journal of Chemical Physics',
    topicSlugs: ['physics', 'chemistry'],
    tier: 'physical',
  },
  {
    sourceId: 'S156274416',
    name: 'Nature Physics',
    topicSlugs: ['physics'],
    tier: 'physical',
  },
  {
    sourceId: 'S202193212',
    name: 'Nature Chemistry',
    topicSlugs: ['chemistry'],
    tier: 'physical',
  },
  {
    sourceId: 'S103895331',
    name: 'Nature Materials',
    topicSlugs: ['physics', 'chemistry'],
    tier: 'physical',
  },

  // ── Cognitive / social science ───────────────────────────────────────────────
  {
    sourceId: 'S88198767',
    name: 'Cognition',
    topicSlugs: ['cognitive-science', 'psychology'],
    tier: 'cognitive',
  },
  {
    sourceId: 'S35223124',
    name: 'Psychological Review',
    topicSlugs: ['psychology'],
    tier: 'cognitive',
  },
  {
    sourceId: 'S58854535',
    name: 'Psychological Science',
    topicSlugs: ['psychology'],
    tier: 'cognitive',
  },
  {
    sourceId: 'S62013203',
    name: 'Journal of Experimental Psychology: General',
    topicSlugs: ['psychology'],
    tier: 'cognitive',
  },
  {
    sourceId: 'S2764866340',
    name: 'Nature Human Behaviour',
    topicSlugs: ['cognitive-science', 'psychology'],
    tier: 'cognitive',
  },
  {
    sourceId: 'S192051125',
    name: 'Trends in Cognitive Sciences',
    topicSlugs: ['cognitive-science'],
    tier: 'cognitive',
  },

  // ── Economics / social ───────────────────────────────────────────────────────
  {
    sourceId: 'S23254222',
    name: 'American Economic Review',
    topicSlugs: ['economics'],
    tier: 'economics',
  },
  {
    sourceId: 'S203860005',
    name: 'The Quarterly Journal of Economics',
    topicSlugs: ['economics'],
    tier: 'economics',
  },
  {
    sourceId: 'S95323914',
    name: 'Journal of Political Economy',
    topicSlugs: ['economics'],
    tier: 'economics',
  },
  {
    sourceId: 'S183584863',
    name: 'Nature Climate Change',
    topicSlugs: ['economics', 'biology'],
    tier: 'economics',
  },
]

const JOURNAL_BY_SOURCE_ID = new Map(JOURNALS.map(j => [j.sourceId, j]))

// ── CLI ────────────────────────────────────────────────────────────────────────

interface CliArgs {
  journal: string | null
  tier: Tier | null
  limit: number
  minCitations: number
  dryRun: boolean
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const get = (flag: string) => {
    const idx = args.indexOf(flag)
    return idx !== -1 ? args[idx + 1] ?? null : null
  }

  const journalRaw = get('--journal')
  const tierRaw    = get('--tier')
  const limitRaw   = get('--limit')
  const minCitRaw  = get('--min-citations')

  const tier = (['science', 'life', 'physical', 'cognitive', 'economics'] as Tier[])
    .includes(tierRaw as Tier) ? (tierRaw as Tier) : null

  return {
    journal:      journalRaw,
    tier,
    limit:        limitRaw  ? (parseInt(limitRaw,  10) || 0) : 0,
    minCitations: minCitRaw ? (parseInt(minCitRaw, 10) || 1) : 1,
    dryRun:       args.includes('--dry-run'),
  }
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

// ── HTTP with retry ────────────────────────────────────────────────────────────

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

// ── OpenAlex fields ────────────────────────────────────────────────────────────

const SELECT_FIELDS = [
  'id', 'doi', 'title', 'publication_date',
  'cited_by_count', 'abstract_inverted_index', 'primary_location',
].join(',')

// ── Pagination ─────────────────────────────────────────────────────────────────

async function* paginateJournal(
  journal: JournalConfig,
  minCitations: number,
  cap: number,
): AsyncGenerator<OAWork> {
  let cursor: string | null = '*'
  let yielded = 0

  // Filter: works in this journal with min citations
  const filterParts = [`primary_location.source.id:${journal.sourceId}`]
  if (minCitations > 0) filterParts.push(`cited_by_count:>${minCitations - 1}`)
  const filter = filterParts.join(',')

  while (cursor) {
    const url = new URL(OA_BASE)
    url.searchParams.set('filter', filter)
    url.searchParams.set('sort', 'cited_by_count:desc')
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

// ── Abstract reconstruction ────────────────────────────────────────────────────

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

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// ── Topic management ───────────────────────────────────────────────────────────

const topicCache = new Map<string, string>()

interface TopicDef {
  slug: string
  name: string
  domain: string
  parentSlug?: string
}

const ALL_TOPICS: TopicDef[] = [
  { slug: 'academic-literature', name: 'Academic Literature', domain: 'academic-literature' },
  { slug: 'biology',             name: 'Biology',             domain: 'academic-literature', parentSlug: 'academic-literature' },
  { slug: 'medicine',            name: 'Medicine',            domain: 'medicine',             parentSlug: 'academic-literature' },
  { slug: 'genetics',            name: 'Genetics',            domain: 'academic-literature', parentSlug: 'biology' },
  { slug: 'biotechnology',       name: 'Biotechnology',       domain: 'academic-literature', parentSlug: 'biology' },
  { slug: 'physics',             name: 'Physics',             domain: 'academic-literature', parentSlug: 'academic-literature' },
  { slug: 'chemistry',           name: 'Chemistry',           domain: 'academic-literature', parentSlug: 'academic-literature' },
  { slug: 'cognitive-science',   name: 'Cognitive Science',   domain: 'academic-literature', parentSlug: 'academic-literature' },
  { slug: 'psychology',          name: 'Psychology',          domain: 'academic-literature', parentSlug: 'academic-literature' },
  { slug: 'economics',           name: 'Economics',           domain: 'academic-literature', parentSlug: 'academic-literature' },
  { slug: 'neuroscience',        name: 'Neuroscience',        domain: 'academic-literature', parentSlug: 'academic-literature' },
]

const TOPIC_DEF_MAP = new Map(ALL_TOPICS.map(t => [t.slug, t]))

async function ensureTopic(slug: string): Promise<string> {
  if (topicCache.has(slug)) return topicCache.get(slug)!

  const def = TOPIC_DEF_MAP.get(slug)
  if (!def) throw new Error(`Unknown topic slug: ${slug}`)

  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) { topicCache.set(slug, existing.id); return existing.id }

  let parentTopicId: string | null = null
  if (def.parentSlug) {
    parentTopicId = await ensureTopic(def.parentSlug)
  }

  const created = await prisma.topic.create({
    data: { slug, name: def.name, domain: def.domain, parentTopicId },
  })
  console.log(`  Created topic: ${slug}`)
  topicCache.set(slug, created.id)
  return created.id
}

async function resolveTopicIds(slugs: string[]): Promise<string[]> {
  // Always include root topic
  const allSlugs = Array.from(new Set(['academic-literature', ...slugs]))
  return Promise.all(allSlugs.map(ensureTopic))
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

// ── Work preparation ───────────────────────────────────────────────────────────

interface PreparedRow {
  workId: string
  title: string
  summary: string
  sourceUrl: string
  venueName: string
  publishedAt: Date | null
  doi: string | null
  citedByCount: number | null
  claimExternalId: string
  sourceExternalId: string
}

function prepareWork(work: OAWork): PreparedRow | null {
  const workId = extractWorkId(work.id)
  if (!workId) return null
  const title = work.title?.trim()
  if (!title) return null
  const doiUrl  = doiToUrl(work.doi)
  const landing = work.primary_location?.landing_page_url?.trim() || null
  const sourceUrl = doiUrl ?? landing
  if (!sourceUrl) return null

  const abstract  = reconstructAbstract(work.abstract_inverted_index)
  const summary   = (abstract && abstract.length > 0 ? abstract : title).slice(0, 500)
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
    citedByCount: work.cited_by_count ?? null,
    claimExternalId:  `openalex_${workId}`,
    sourceExternalId: `openalex_source_${workId}`,
  }
}

// ── Batched ingest ─────────────────────────────────────────────────────────────

async function ingestBatch(
  works: OAWork[],
  topicIds: string[],
  dryRun: boolean,
): Promise<Counts> {
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

  // Deduplication check (cross-script: any openalex_v1 records are also skipped)
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

  if (dryRun) {
    console.log(`  [dry-run] Would ingest ${fresh.length} / ${prepared.length} works in this batch`)
    for (const r of fresh.slice(0, 3)) {
      console.log(`    • ${r.title.slice(0, 80)} [${r.citedByCount ?? '?'} citations]`)
    }
    counts.ingested += fresh.length
    return counts
  }

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
          ingestedBy: PIPELINE,
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
          ingestedBy: PIPELINE,
          humanReviewed: false,
          autoApproved: true,
          externalId: r.claimExternalId,
          metadata: {
            dataset: PIPELINE,
            openalex_id: r.workId,
            title: r.title,
            doi: r.doi,
            venue: r.venueName,
            cited_by_count: r.citedByCount,
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
          ingestedBy: PIPELINE,
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

// ── Journal runner ─────────────────────────────────────────────────────────────

async function runJournal(
  journal: JournalConfig,
  minCitations: number,
  limit: number,
  dryRun: boolean,
): Promise<Counts & { journal: string }> {
  console.log(`\n── ${journal.name} (${journal.sourceId}) ──────────────────────────`)
  console.log(`   minCitations=${minCitations} limit=${limit || 'all'} dryRun=${dryRun}`)

  const topicIds = await resolveTopicIds(journal.topicSlugs)
  const counts: Counts = { ingested: 0, skipped: 0, errors: 0 }

  const BATCH_SIZE = 200
  let batch: OAWork[] = []
  let seen = 0
  const fetchCap = limit > 0 ? limit + 500 : 0

  async function flush() {
    if (batch.length === 0) return
    const r = await ingestBatch(batch, topicIds, dryRun)
    counts.ingested += r.ingested
    counts.skipped  += r.skipped
    counts.errors   += r.errors
    batch = []
    if (seen % 1000 === 0 || seen <= BATCH_SIZE) {
      console.log(`   Progress: seen=${seen} ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
    }
  }

  for await (const work of paginateJournal(journal, minCitations, fetchCap)) {
    if (limit > 0 && counts.ingested >= limit) break
    seen++
    batch.push(work)
    if (batch.length >= BATCH_SIZE) await flush()
  }
  await flush()

  console.log(`   Final: seen=${seen} ingested=${counts.ingested} skipped=${counts.skipped} errors=${counts.errors}`)
  return { ...counts, journal: journal.name }
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const { journal: journalId, tier, limit, minCitations, dryRun } = parseArgs()

  if (dryRun) console.log('\n[DRY RUN — no DB writes]')

  let targets: JournalConfig[]

  if (journalId) {
    const found = JOURNAL_BY_SOURCE_ID.get(journalId)
      ?? JOURNALS.find(j => j.sourceId === journalId)
    if (!found) {
      console.error(`Unknown sourceId: ${journalId}`)
      console.error(`Available: ${JOURNALS.map(j => `${j.sourceId} (${j.name})`).join(', ')}`)
      await prisma.$disconnect()
      process.exit(1)
    }
    targets = [found]
  } else if (tier) {
    targets = JOURNALS.filter(j => j.tier === tier)
    if (targets.length === 0) {
      console.error(`No journals found for tier: ${tier}`)
      await prisma.$disconnect()
      process.exit(1)
    }
  } else {
    console.error('Specify --journal <sourceId> or --tier <science|life|physical|cognitive|economics>')
    await prisma.$disconnect()
    process.exit(1)
  }

  console.log(`\n=== OpenAlex Journal Sweep — ${targets.map(j => j.name).join(', ')} ===`)
  console.log(`    journals=${targets.length} minCitations=${minCitations} limit=${limit || 'all'} dryRun=${dryRun}\n`)

  const totals: Counts = { ingested: 0, skipped: 0, errors: 0 }
  const remaining = { limit }

  for (const journal of targets) {
    const journalLimit = remaining.limit > 0
      ? Math.max(0, remaining.limit - totals.ingested)
      : 0
    if (remaining.limit > 0 && journalLimit === 0) break

    const r = await runJournal(
      journal,
      journal.minCitations ?? minCitations,
      journalLimit,
      dryRun,
    )
    totals.ingested += r.ingested
    totals.skipped  += r.skipped
    totals.errors   += r.errors
  }

  console.log('\n=== Grand Total ===')
  console.log(`  Journals : ${targets.length}`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
