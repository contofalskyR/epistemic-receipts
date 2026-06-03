// CourtListener Court Catalogue ingester (Tier 2).
// Creates one Topic per court (no Claims, no Sources). Hierarchy:
//   federal-courts / state-courts / military-courts / international-courts / other-courts
// → court-<id> (e.g. court-scotus, court-ca9). Idempotent via slug upsert.
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-courts.ts \
//        [--jurisdiction F] [--dry-run]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CLCourt {
  id:           string  // 'scotus', 'ca9', etc.
  full_name:    string | null
  short_name:   string | null
  start_date:   string | null
  end_date:     string | null
  jurisdiction: string | null  // 'F', 'FD', 'FB', 'FS', 'S', 'SA', 'ST', 'SG', 'SS', 'C', 'T', 'I', 'U', 'X'
}

interface CLCourtPage {
  count:   number
  next:    string | null
  results: CLCourt[]
}

// ── CLI flag parsing ──────────────────────────────────────────────────────────

function parseDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

function parseJurisdiction(): string | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--jurisdiction')
  if (idx !== -1 && args[idx + 1]) return args[idx + 1].toUpperCase()
  return null
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── API fetch (matches circuits ingester's retry behaviour) ───────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_429_WAIT_MS  = 120_000
const MAX_RETRIES      = 5
const REQUEST_DELAY_MS = 800
const FETCH_TIMEOUT_MS = 30_000

async function clFetch(urlOrPath: string, token: string): Promise<unknown> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${BASE_URL}${urlOrPath}`

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    let res: Response
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS)
    try {
      res = await fetch(url, {
        headers: {
          'Authorization': `Token ${token}`,
          'Accept': 'application/json',
        },
        signal: ctrl.signal,
      })
      clearTimeout(timer)
    } catch (networkErr) {
      clearTimeout(timer)
      if (attempt > MAX_RETRIES) throw networkErr
      const reason = (networkErr as Error)?.name === 'AbortError' ? `fetch timeout (${FETCH_TIMEOUT_MS / 1000}s)` : 'network error'
      const backoff = Math.min(2 ** attempt * 1000, 300_000)
      console.log(`  Retrying after ${reason} (attempt ${attempt}/${MAX_RETRIES}, waiting ${Math.ceil(backoff / 1000)}s)...`)
      await sleep(backoff)
      continue
    }

    if (res.status === 401) {
      throw new Error('CourtListener returned 401 — check COURTLISTENER_TOKEN in .env')
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

// ── Jurisdiction → parent slug ────────────────────────────────────────────────

const PARENT_TOPICS: Array<{ slug: string; name: string }> = [
  { slug: 'federal-courts',       name: 'Federal Courts'       },
  { slug: 'state-courts',         name: 'State Courts'         },
  { slug: 'military-courts',      name: 'Military Courts'      },
  { slug: 'international-courts', name: 'International Courts' },
  { slug: 'other-courts',         name: 'Other Courts'         },
]

function parentSlugForJurisdiction(jurisdiction: string | null): string {
  switch ((jurisdiction ?? '').toUpperCase()) {
    case 'F':
    case 'FD':
    case 'FB':
    case 'FS':
      return 'federal-courts'
    case 'S':
    case 'SA':
    case 'ST':
    case 'SG':
    case 'SS':
      return 'state-courts'
    case 'U':
      return 'military-courts'
    case 'I':
      return 'international-courts'
    default:
      return 'other-courts'
  }
}

// ── Topic upsert ──────────────────────────────────────────────────────────────

async function upsertTopic(
  slug: string,
  name: string,
  parentId: string | null,
  dryRun: boolean,
): Promise<{ id: string; created: boolean }> {
  if (dryRun) {
    console.log(`    [DRY RUN] Would upsert topic: slug=${slug} name="${name}" parent=${parentId ?? 'none'}`)
    return { id: 'dry-run', created: false }
  }
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) {
    if ((parentId && existing.parentTopicId !== parentId) || existing.name !== name) {
      const updated = await prisma.topic.update({
        where: { slug },
        data: {
          name,
          parentTopicId: parentId ?? existing.parentTopicId,
        },
      })
      return { id: updated.id, created: false }
    }
    return { id: existing.id, created: false }
  }
  const created = await prisma.topic.create({
    data: {
      name,
      slug,
      domain: 'law',
      parentTopicId: parentId ?? undefined,
    },
  })
  return { id: created.id, created: true }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error('\nError: COURTLISTENER_TOKEN not set in .env\n')
    process.exit(1)
  }

  const dryRun = parseDryRun()
  const jurisdictionFilter = parseJurisdiction()

  console.log(
    `\n=== CourtListener Court Catalogue — jurisdiction: ${jurisdictionFilter ?? 'all'}` +
    `${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  // Ensure parent topics first
  const parentTopicIds = new Map<string, string>()
  for (const p of PARENT_TOPICS) {
    const { id } = await upsertTopic(p.slug, p.name, null, dryRun)
    parentTopicIds.set(p.slug, id)
  }

  let upserted = 0
  let created  = 0
  let skipped  = 0

  const params = new URLSearchParams()
  params.set('page_size', '100')
  if (jurisdictionFilter) params.set('jurisdiction', jurisdictionFilter)

  let nextUrl: string | null = `/courts/?${params.toString()}`

  while (nextUrl) {
    await sleep(REQUEST_DELAY_MS)

    let page: CLCourtPage
    try {
      page = (await clFetch(nextUrl, token)) as CLCourtPage
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`  page fetch failed: ${msg}`)
      break
    }

    const courts: CLCourt[] = page.results ?? []
    console.log(`  page — ${courts.length} courts (${upserted + skipped + courts.length} processed, ${page.count ?? '?'} available)`)

    for (const court of courts) {
      const courtId = (court.id ?? '').toString().trim()
      if (!courtId) {
        console.log(`    Skipped (no id)`)
        skipped++
        continue
      }

      const slug = `court-${courtId}`
      const name = (court.full_name?.trim() || court.short_name?.trim() || courtId)
      const parentSlug = parentSlugForJurisdiction(court.jurisdiction)
      const parentId = parentTopicIds.get(parentSlug) ?? null

      try {
        const { created: wasCreated } = await upsertTopic(slug, name, parentId, dryRun)
        upserted++
        if (wasCreated) created++
        if (dryRun) {
          // already logged inside upsertTopic
        } else {
          console.log(`    ${wasCreated ? 'Created' : 'Updated/kept'}: ${slug} (${name}) under ${parentSlug}`)
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`    Failed: ${slug} — ${msg}`)
      }
    }

    nextUrl = page.next || null
  }

  console.log(`\nTopics upserted: ${upserted}`)
  console.log(`  Newly created: ${created}`)
  console.log(`  Skipped      : ${skipped}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
