// CourtListener State Supreme Court opinion ingester.
// Pulls highly-cited published opinions from the top-15 state courts of last resort.
// Mirrors federal circuits pattern. Edge score 75 (binding within state).
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-state-supreme.ts \
//        --limit 200 --min-citations 20 [--court cal] [--dry-run]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'
const CL_ROOT  = 'https://www.courtlistener.com'

// ── State supreme court catalogue ─────────────────────────────────────────────

interface CourtDef {
  code:      string // CourtListener docket__court value
  slug:      string // topic slug
  name:      string // human-readable label
  shortName: string // short label used in claim text
  state:     string // state abbreviation
}

// Top 15 states by population / legal volume. Court codes verified against
// CourtListener's /courts/ endpoint (jurisdiction=S, in_use=True).
const STATE_SUPREMES: CourtDef[] = [
  { code: 'cal',   slug: 'court-cal',   name: 'California Supreme Court',                 shortName: 'Cal. Sup. Ct.',   state: 'CA' },
  { code: 'ny',    slug: 'court-ny',    name: 'New York Court of Appeals',                shortName: 'N.Y. Ct. App.',   state: 'NY' },
  { code: 'tex',   slug: 'court-tex',   name: 'Supreme Court of Texas',                   shortName: 'Tex. Sup. Ct.',   state: 'TX' },
  { code: 'fla',   slug: 'court-fla',   name: 'Supreme Court of Florida',                 shortName: 'Fla. Sup. Ct.',   state: 'FL' },
  { code: 'ill',   slug: 'court-ill',   name: 'Supreme Court of Illinois',                shortName: 'Ill. Sup. Ct.',   state: 'IL' },
  { code: 'pa',    slug: 'court-pa',    name: 'Supreme Court of Pennsylvania',            shortName: 'Pa. Sup. Ct.',    state: 'PA' },
  { code: 'ohio',  slug: 'court-ohio',  name: 'Supreme Court of Ohio',                    shortName: 'Ohio Sup. Ct.',   state: 'OH' },
  { code: 'wash',  slug: 'court-wash',  name: 'Supreme Court of Washington',              shortName: 'Wash. Sup. Ct.',  state: 'WA' },
  { code: 'mass',  slug: 'court-mass',  name: 'Massachusetts Supreme Judicial Court',     shortName: 'Mass. SJC',       state: 'MA' },
  { code: 'nj',    slug: 'court-nj',    name: 'Supreme Court of New Jersey',              shortName: 'N.J. Sup. Ct.',   state: 'NJ' },
  { code: 'ga',    slug: 'court-ga',    name: 'Supreme Court of Georgia',                 shortName: 'Ga. Sup. Ct.',    state: 'GA' },
  { code: 'va',    slug: 'court-va',    name: 'Supreme Court of Virginia',                shortName: 'Va. Sup. Ct.',    state: 'VA' },
  { code: 'mich',  slug: 'court-mich',  name: 'Supreme Court of Michigan',                shortName: 'Mich. Sup. Ct.',  state: 'MI' },
  { code: 'colo',  slug: 'court-colo',  name: 'Colorado Supreme Court',                   shortName: 'Colo. Sup. Ct.',  state: 'CO' },
  { code: 'ariz',  slug: 'court-ariz',  name: 'Arizona Supreme Court',                    shortName: 'Ariz. Sup. Ct.',  state: 'AZ' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface CLCitation {
  volume:   number | null
  reporter: string | null
  page:     string | null
  type:     number
}

interface CLCluster {
  id:                  number | string
  case_name:           string | null
  case_name_short:     string | null
  date_filed:          string | null
  citations:           CLCitation[] | null
  absolute_url:        string | null
  citation_count:      number | string | null
  precedential_status: string | null
}

interface CLPage {
  count:   number
  next:    string | null
  results: CLCluster[]
}

// ── CLI flag parsing ──────────────────────────────────────────────────────────

function parseLimit(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--limit')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 200
}

function parseMinCitations(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--min-citations')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n >= 0) return n
  }
  return 20
}

function parseCourtFilter(): string | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--court')
  if (idx !== -1 && args[idx + 1]) return args[idx + 1].toLowerCase()
  return null
}

function parseDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

function parseSlow(): boolean {
  return process.argv.includes('--slow')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Date / citation helpers ───────────────────────────────────────────────────

type Precision = 'DAY' | 'MONTH' | 'YEAR'

function parseDate(raw: string | null): { date: Date; precision: Precision } | null {
  if (!raw) return null
  if (/^\d{4}$/.test(raw)) {
    const d = new Date(`${raw}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? null : { date: d, precision: 'YEAR' }
  }
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? null : { date: d, precision: 'MONTH' }
  }
  const normalised = /T/.test(raw) ? raw : `${raw}T00:00:00Z`
  const d = new Date(normalised)
  return isNaN(d.getTime()) ? null : { date: d, precision: 'DAY' }
}

function formatCitation(citations: CLCitation[] | null | undefined): string {
  if (!citations || citations.length === 0) return ''
  const c = citations[0]
  if (c.volume == null || !c.reporter || !c.page) return ''
  return `${c.volume} ${c.reporter} ${c.page}`
}

function buildSourceUrl(absoluteUrl: string | null | undefined): string | null {
  if (!absoluteUrl) return null
  if (absoluteUrl.startsWith('http')) return absoluteUrl
  const path = absoluteUrl.startsWith('/') ? absoluteUrl : `/${absoluteUrl}`
  return `${CL_ROOT}${path}`
}

function toCitationCount(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw
  return isNaN(n) ? null : n
}

// ── API fetch with retry ──────────────────────────────────────────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_429_WARN_MS    = 300_000 // log a long-wait warning above 5 min

let MAX_RETRIES      = 5
let REQUEST_DELAY_MS = 800
let FETCH_TIMEOUT_MS = 30_000

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
      const reason = (networkErr as Error)?.name === 'AbortError'
        ? `fetch timeout (${FETCH_TIMEOUT_MS / 1000}s)` : 'network error'
      const backoff = Math.min(2 ** attempt * 1000, 300_000)
      console.log(`  Retrying after ${reason} (attempt ${attempt}/${MAX_RETRIES}, waiting ${Math.ceil(backoff / 1000)}s)...`)
      await sleep(backoff)
      continue
    }

    if (res.status === 401) throw new Error('CourtListener returned 401 — check COURTLISTENER_TOKEN in .env')

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('retry-after') ?? '60', 10)
      const wait = isNaN(retryAfter) ? 60000 : retryAfter * 1000
      const waitSec = Math.ceil(wait / 1000)
      if (wait > MAX_429_WARN_MS) {
        console.log(`  Rate limited (429) — long penalty ${waitSec}s (${(waitSec / 3600).toFixed(1)}h) — waiting it out...`)
      } else {
        console.log(`  Rate limited (429) — waiting ${waitSec}s before retry...`)
      }
      await sleep(wait)
      continue
    }

    if (TRANSIENT_STATUSES.has(res.status)) {
      if (attempt > MAX_RETRIES) throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)
      console.log(`  Retrying after ${res.status} (attempt ${attempt}/${MAX_RETRIES})...`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)

    return res.json()
  }

  throw new Error('clFetch: exhausted retries')
}

// ── Topic upsert ──────────────────────────────────────────────────────────────

async function ensureTopic(slug: string, name: string, parentId: string | null): Promise<string> {
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) return existing.id
  const created = await prisma.topic.create({
    data: { name, slug, domain: 'law', parentTopicId: parentId ?? undefined },
  })
  return created.id
}

// ── Per-court ingest ──────────────────────────────────────────────────────────

interface CourtResult {
  fetched:  number
  ingested: number
  skipped:  number
  errors:   number
}

async function ingestCourt(
  court: CourtDef,
  token: string,
  limit: number,
  minCitations: number,
  dryRun: boolean,
  parentTopicId: string | null,
): Promise<CourtResult> {
  const result: CourtResult = { fetched: 0, ingested: 0, skipped: 0, errors: 0 }

  const courtTopicId = parentTopicId
    ? await ensureTopic(court.slug, court.name, parentTopicId)
    : null

  const pageSize = Math.min(limit, 100)
  const firstUrl =
    `/clusters/?docket__court=${court.code}` +
    `&citation_count__gte=${minCitations}` +
    `&precedential_status=Published` +
    `&order_by=-citation_count` +
    `&page_size=${pageSize}`

  let nextUrl: string | null = firstUrl

  while (nextUrl && result.fetched < limit) {
    await sleep(REQUEST_DELAY_MS)

    let page: CLPage
    try {
      page = (await clFetch(nextUrl, token)) as CLPage
    } catch (fetchErr) {
      const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr)
      console.error(`  [${court.code}] page fetch failed — skipping court: ${msg}`)
      result.errors++
      break
    }

    const clusters: CLCluster[] = page.results ?? []
    const need  = limit - result.fetched
    const batch = clusters.slice(0, need)
    result.fetched += batch.length

    console.log(`  [${court.code}] page — ${batch.length} clusters (${result.fetched} total, ${page.count ?? '?'} available)`)

    for (const cluster of batch) {
      await sleep(REQUEST_DELAY_MS)

      const clusterId     = String(cluster.id)
      const externalId    = `courtlistener_state_supreme_v1-${clusterId}`
      const caseName      = cluster.case_name?.trim() || ''
      const citationCount = toCitationCount(cluster.citation_count)
      const citation      = formatCitation(cluster.citations)
      const sourceUrl     = buildSourceUrl(cluster.absolute_url)
      const parsed        = parseDate(cluster.date_filed)

      if (!caseName) {
        console.log(`    Skipped (no case name): ${clusterId}`)
        result.skipped++
        continue
      }

      const existing = await prisma.claim.findUnique({ where: { externalId } })
      if (existing) {
        console.log(`    Skipped (already ingested): ${externalId} — ${caseName}`)
        result.skipped++
        continue
      }

      const filedDate  = parsed?.date ?? new Date()
      const precision  = parsed?.precision ?? 'DAY'
      const year       = filedDate.getUTCFullYear()
      const displayCit = citation ? `, ${citation}` : ''
      const countStr   = citationCount !== null ? String(citationCount) : 'unknown'

      const sourceName = `${caseName}${displayCit} — ${court.shortName}${year ? ` ${year}` : ''}`
      const claimText  = `The ${court.name} in ${caseName} (${court.state} ${year}) issued a published opinion on the legal questions presented in the case.`

      const reviewFields = { humanReviewed: false, autoApproved: false }

      if (dryRun) {
        console.log(`    [DRY RUN] Would ingest: ${caseName} (${countStr} citations, ${parsed?.date?.toISOString().slice(0, 10) ?? 'no date'})`)
        result.ingested++
        continue
      }

      try {
        await prisma.$transaction(async tx => {
          const source = await tx.source.create({
            data: {
              name:            sourceName,
              url:             sourceUrl,
              publishedAt:     filedDate,
              methodologyType: 'primary',
              ingestedBy:      'courtlistener_state_supreme_v1',
              externalId:      `courtlistener_state_supreme_v1-source-${clusterId}`,
              ...reviewFields,
            },
          })

          const claim = await tx.claim.create({
            data: {
              text:                  claimText,
              claimType:             'INSTITUTIONAL',
              claimEmergedAt:        filedDate,
              claimEmergedPrecision: precision,
              currentStatus:         'HARD_FACT',
              verificationStatus:    'PROVISIONAL',
              parentClaimId:         null,
              ingestedBy:            'courtlistener_state_supreme_v1',
              externalId,
              ...reviewFields,
            },
          })

          const edge = await tx.edge.create({
            data: {
              sourceId:     source.id,
              claimId:      claim.id,
              type:         'FOR',
              evidenceType: 'PROCEDURAL',
              ingestedBy:   'courtlistener_state_supreme_v1',
              ...reviewFields,
            },
          })

          // State courts of last resort: binding within state, lower than federal circuits.
          await tx.edgeRevision.create({
            data: {
              edgeId:     edge.id,
              priorScore: null,
              newScore:   75,
              reason:     `${court.shortName} published opinion — state court of last resort (binding within ${court.state})`,
              changedAt:  filedDate,
            },
          })

          await tx.thresholdEvent.create({
            data: {
              claimId:             claim.id,
              triggeredBy:         `${court.name} published opinion — ${caseName}`,
              triggeredBySourceId: source.id,
              confirmedBy:         'courtlistener_state_supreme_v1',
              note:                `${court.name} issued its published opinion in ${caseName}${displayCit}. Citation count as of ingestion: ${countStr}.`,
              evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 75 }]),
              createdAt:           filedDate,
              ingestedBy:          'courtlistener_state_supreme_v1',
              ...reviewFields,
            },
          })

          if (parentTopicId) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: parentTopicId } },
              update: {},
              create: { claimId: claim.id, topicId: parentTopicId },
            })
          }
          if (courtTopicId) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: courtTopicId } },
              update: {},
              create: { claimId: claim.id, topicId: courtTopicId },
            })
          }
        }, { timeout: 30000 })

        console.log(`    Ingested: ${caseName} (${countStr} citations)`)
        result.ingested++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`    Failed: ${caseName} — ${msg}`)
        result.errors++
      }
    }

    nextUrl = page.next && result.fetched < limit ? page.next : null
  }

  return result
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error('\nError: COURTLISTENER_TOKEN not set in .env\n')
    process.exit(1)
  }

  const limit        = parseLimit()
  const minCitations = parseMinCitations()
  const courtFilter  = parseCourtFilter()
  const dryRun       = parseDryRun()
  const slow         = parseSlow()

  if (slow) {
    MAX_RETRIES      = 10
    REQUEST_DELAY_MS = 10_000
    FETCH_TIMEOUT_MS = 90_000
    console.log('  [slow mode] timeout=90s, delay=10s, retries=10')
  }

  const targets = courtFilter
    ? STATE_SUPREMES.filter(c => c.code === courtFilter)
    : STATE_SUPREMES

  if (targets.length === 0) {
    const known = STATE_SUPREMES.map(c => c.code).join(', ')
    console.error(`\nError: --court ${courtFilter} did not match any known court.\nKnown codes: ${known}\n`)
    process.exit(1)
  }

  console.log(
    `\n=== CourtListener State Supreme Court Ingestion — limit/court: ${limit}, ` +
    `min-citations: ${minCitations}, courts: ${targets.map(t => t.code).join(',')}` +
    `${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  const parentTopicId = dryRun
    ? null
    : await ensureTopic('state-supreme-courts', 'State Supreme Courts', null)

  const totals: CourtResult = { fetched: 0, ingested: 0, skipped: 0, errors: 0 }

  for (let i = 0; i < targets.length; i++) {
    const court = targets[i]
    if (slow && i > 0) {
      console.log('  [slow mode] waiting 30s before next court...')
      await sleep(30_000)
    }
    console.log(`\n--- ${court.shortName} (${court.code}) ---`)
    try {
      const r = await ingestCourt(court, token, limit, minCitations, dryRun, parentTopicId)
      totals.fetched  += r.fetched
      totals.ingested += r.ingested
      totals.skipped  += r.skipped
      totals.errors   += r.errors
      console.log(`  → ${court.code}: ingested=${r.ingested} skipped=${r.skipped} errors=${r.errors}`)
    } catch (courtErr) {
      const msg = courtErr instanceof Error ? courtErr.message : String(courtErr)
      console.error(`  → ${court.code}: FAILED — ${msg}`)
      totals.errors++
    }
  }

  const dbTotal = await prisma.claim.count({ where: { ingestedBy: 'courtlistener_state_supreme_v1' } })
  console.log(`\n=== Totals ===`)
  console.log(`  Fetched  : ${totals.fetched}`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}`)
  console.log(`  DB total : ${dbTotal}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
