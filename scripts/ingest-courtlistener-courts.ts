// CourtListener court catalogue ingester (Tier 2B).
//
// Creates Topics — not Claims — from the /courts/ endpoint (3,358 records as
// of 2026-06-03). Builds a hierarchical Topic tree:
//
//   federal-courts / state-courts / tribal-courts / military-courts /
//   international-courts / committee-courts / other-courts
//     └─ <court-slug>   (slug = CL `id` field, e.g. "scotus", "ca9", "cal")
//
// Jurisdiction codes (per CL API):
//   F  = federal appellate           → federal-courts
//   FD = federal district            → federal-courts
//   FB = federal bankruptcy          → federal-courts
//   FS = federal special             → federal-courts
//   (any other F* code)              → federal-courts
//   S  = state supreme               → state-courts
//   SA = state appellate             → state-courts
//   ST = state trial                 → state-courts
//   T  = tribal                      → tribal-courts
//   TT = territory                   → tribal-courts (closest editorial fit)
//   I  = international               → international-courts
//   C  = committee                   → committee-courts
//   M*                               → military-courts (e.g. MA, military)
//   (anything else)                  → other-courts
//
// Backfills the implicit topic tree the circuits + state-supreme ingesters
// have been creating ad-hoc. Existing slugs like `us-court-of-appeals-9th-circuit`
// stay in place (they're referenced by ClaimTopic rows); the new canonical
// CL-id-based slugs (`ca9`) live alongside them for future cleanup.
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-courts.ts \
//        [--limit 4000] [--jurisdiction F] [--dry-run]

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'

// ── Types ────────────────────────────────────────────────────────────────────

interface CLCourt {
  id:           string            // CL slug e.g. "scotus", "ca9", "cal"
  full_name:    string | null
  short_name:   string | null
  jurisdiction: string | null     // F | FD | FB | FS | S | SA | ST | T | TT | I | C | ...
  start_date:   string | null
  end_date:     string | null
  citation_string: string | null
  url:          string | null
  parent_court: string | null     // URL to parent /courts/<id>/
}

interface CLPage<T> {
  count:   number
  next:    string | null
  results: T[]
}

// ── CLI flag parsing ─────────────────────────────────────────────────────────

function parseLimit(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--limit')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 10_000
}

function parseJurisdictionFilter(): string | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--jurisdiction')
  if (idx !== -1 && args[idx + 1]) return args[idx + 1].toUpperCase()
  return null
}

function parseDryRun(): boolean { return process.argv.includes('--dry-run') }

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── API fetch (same shape as other CL ingesters) ─────────────────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_429_WAIT_MS    = 120_000
const MAX_RETRIES        = 5
const REQUEST_DELAY_MS   = 800
const FETCH_TIMEOUT_MS   = 30_000

async function clFetch(urlOrPath: string, token: string): Promise<unknown> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${BASE_URL}${urlOrPath}`

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    let res: Response
    const ctrl  = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
      res = await fetch(url, {
        headers: { 'Authorization': `Token ${token}`, 'Accept': 'application/json' },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
    } catch (networkErr) {
      clearTimeout(timer)
      if (attempt > MAX_RETRIES) throw networkErr
      const reason  = (networkErr as Error)?.name === 'AbortError'
        ? `fetch timeout (${FETCH_TIMEOUT_MS / 1000}s)`
        : 'network error'
      const backoff = Math.min(2 ** attempt * 1000, 300_000)
      console.log(`  Retrying after ${reason} (attempt ${attempt}/${MAX_RETRIES}, waiting ${Math.ceil(backoff / 1000)}s)...`)
      await sleep(backoff)
      continue
    }

    if (res.status === 401) {
      throw new Error('CourtListener returned 401 — check COURTLISTENER_TOKEN in .env.local')
    }

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      const wait = isNaN(retryAfter) ? 60000 : retryAfter * 1000
      if (wait > MAX_429_WAIT_MS) {
        throw new Error(`CourtListener rate limit too long (${Math.ceil(wait / 1000)}s) — wait and restart`)
      }
      console.log(`  Rate limited (429) — waiting ${Math.ceil(wait / 1000)}s before retry...`)
      await sleep(wait)
      continue
    }

    if (TRANSIENT_STATUSES.has(res.status)) {
      if (attempt > MAX_RETRIES) {
        throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)
      }
      console.log(`  Retrying after ${res.status} (attempt ${attempt}/${MAX_RETRIES})...`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) {
      throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)
    }

    return res.json()
  }

  throw new Error('clFetch: exhausted retries')
}

// ── Jurisdiction → parent topic bucket ───────────────────────────────────────

interface JurisdictionBucket {
  parentSlug: string
  parentName: string
}

const PARENT_BUCKETS: Record<string, JurisdictionBucket> = {
  federal:       { parentSlug: 'federal-courts',       parentName: 'Federal Courts' },
  state:         { parentSlug: 'state-courts',         parentName: 'State Courts' },
  tribal:        { parentSlug: 'tribal-courts',        parentName: 'Tribal & Territorial Courts' },
  military:      { parentSlug: 'military-courts',      parentName: 'Military Courts' },
  international: { parentSlug: 'international-courts', parentName: 'International Courts' },
  committee:     { parentSlug: 'committee-courts',     parentName: 'Committee Courts' },
  other:         { parentSlug: 'other-courts',         parentName: 'Other Courts' },
}

function bucketForJurisdiction(code: string | null): JurisdictionBucket {
  if (!code) return PARENT_BUCKETS.other
  const upper = code.toUpperCase()
  if (upper.startsWith('F')) return PARENT_BUCKETS.federal
  if (upper.startsWith('S')) return PARENT_BUCKETS.state
  if (upper === 'T' || upper === 'TT') return PARENT_BUCKETS.tribal
  if (upper === 'I') return PARENT_BUCKETS.international
  if (upper === 'C') return PARENT_BUCKETS.committee
  if (upper.startsWith('M')) return PARENT_BUCKETS.military
  return PARENT_BUCKETS.other
}

// ── Topic upsert (idempotent on slug) ────────────────────────────────────────

async function ensureTopic(
  slug: string,
  name: string,
  description: string | null,
  parentId: string | null,
  dryRun: boolean,
): Promise<{ id: string | null; created: boolean }> {
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    // Backfill description if missing — never overwrite an existing one or rename.
    if (description && !existing.description && !dryRun) {
      await prisma.topic.update({
        where: { id: existing.id },
        data:  { description },
      })
    }
    return { id: existing.id, created: false }
  }

  if (dryRun) return { id: null, created: true }

  const created = await prisma.topic.create({
    data: {
      name,
      slug,
      description: description ?? undefined,
      domain: 'law',
      parentTopicId: parentId ?? undefined,
    },
  })
  return { id: created.id, created: true }
}

function buildDescription(court: CLCourt): string {
  const fullName = (court.full_name ?? '').trim()
  const start    = (court.start_date ?? '').trim()
  const end      = (court.end_date ?? '').trim()
  const cite     = (court.citation_string ?? '').trim()

  const parts: string[] = []
  if (fullName) parts.push(fullName)
  if (start && end)     parts.push(`(${start.slice(0, 10)} – ${end.slice(0, 10)})`)
  else if (start)       parts.push(`(established ${start.slice(0, 10)})`)
  else if (end)         parts.push(`(dissolved ${end.slice(0, 10)})`)
  if (cite)             parts.push(`Citation: ${cite}.`)

  return parts.join(' ')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error('\nError: COURTLISTENER_TOKEN not set in .env.local\n')
    process.exit(1)
  }

  const limit              = parseLimit()
  const jurisdictionFilter = parseJurisdictionFilter()
  const dryRun             = parseDryRun()

  console.log(
    `\n=== CourtListener Court Catalogue → Topics — limit: ${limit}` +
    `${jurisdictionFilter ? `, jurisdiction: ${jurisdictionFilter}` : ''}` +
    `${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  // Pre-create top-level buckets and cache their ids.
  const parentTopicCache = new Map<string, string | null>()
  for (const bucket of Object.values(PARENT_BUCKETS)) {
    const { id } = await ensureTopic(bucket.parentSlug, bucket.parentName, null, null, dryRun)
    parentTopicCache.set(bucket.parentSlug, id)
  }

  const filterParts = ['page_size=100']
  if (jurisdictionFilter) filterParts.push(`jurisdiction=${jurisdictionFilter}`)
  const firstUrl = `/courts/?${filterParts.join('&')}`

  let fetched   = 0
  let created   = 0
  let unchanged = 0
  let skipped   = 0
  let errors    = 0
  let nextUrl: string | null = firstUrl

  while (nextUrl && fetched < limit) {
    await sleep(REQUEST_DELAY_MS)

    let page: CLPage<CLCourt>
    try {
      page = (await clFetch(nextUrl, token)) as CLPage<CLCourt>
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Page fetch failed — stopping: ${msg}`)
      errors++
      break
    }

    const courts = page.results ?? []
    const need   = limit - fetched
    const batch  = courts.slice(0, need)
    fetched     += batch.length

    console.log(`Page — ${batch.length} courts (${fetched} total, ${page.count ?? '?'} available)`)

    for (const court of batch) {
      const courtId = (court.id ?? '').trim().toLowerCase()
      if (!courtId) {
        console.log(`  Skipped (no court id)`)
        skipped++
        continue
      }

      const bucket   = bucketForJurisdiction(court.jurisdiction)
      const parentId = parentTopicCache.get(bucket.parentSlug) ?? null

      const name = (court.full_name && court.full_name.trim())
        || (court.short_name && court.short_name.trim())
        || courtId

      const description = buildDescription(court)

      try {
        const slug = `court-${courtId}`
        const { id, created: wasCreated } = await ensureTopic(
          slug, name, description || null, parentId, dryRun,
        )

        if (wasCreated) {
          console.log(`  + ${slug} (${bucket.parentSlug}) — ${name}`)
          created++
        } else if (id) {
          unchanged++
        } else {
          console.log(`  [DRY RUN] Would create: ${slug} (${bucket.parentSlug}) — ${name}`)
          created++
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: court ${courtId} — ${msg}`)
        errors++
      }
    }

    nextUrl = page.next && fetched < limit ? page.next : null
  }

  let dbTopics = 0
  if (!dryRun) {
    try {
      dbTopics = await prisma.topic.count({ where: { domain: 'law' } })
    } catch { /* best-effort */ }
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Courts fetched : ${fetched}`)
  console.log(`  Topics created : ${created}`)
  console.log(`  Unchanged      : ${unchanged}`)
  console.log(`  Skipped        : ${skipped}`)
  console.log(`  Errors         : ${errors}`)
  if (!dryRun) console.log(`  DB law topics  : ${dbTopics}`)
  console.log('')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
