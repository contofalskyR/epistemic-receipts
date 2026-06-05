// CourtListener SCOTUS opinion ingester — second ingester, validates the abstraction.
// Pulls most-cited Supreme Court opinions as scaffolding INSTITUTIONAL claims.
// Auto-tagged with "constitutional-law". Same provenance pattern as openFDA.
//
// Requires: COURTLISTENER_TOKEN in .env (free account at courtlistener.com)
// Run: npm run ingest-scotus -- --limit 50

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'
const CL_ROOT  = 'https://www.courtlistener.com'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CLCitation {
  volume:   number | null
  reporter: string | null
  page:     string | null
  type:     number
}

// CourtListener sometimes returns numbers, sometimes strings for numeric fields.
// Treat everything as unknown and coerce defensively.
interface CLCluster {
  id:                 number | string
  case_name:          string | null
  case_name_short:    string | null
  date_filed:         string | null
  citations:          CLCitation[] | null
  absolute_url:       string | null
  citation_count:     number | string | null
  precedential_status: string | null
}

interface CLPage {
  count:   number
  next:    string | null
  results: CLCluster[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseLimit(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--limit')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 10
}

function parseMinCitations(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--min-citations')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n >= 0) return n
  }
  return 10
}

function parseBeforeYear(): number | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--before-year')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 1700 && n <= 2100) return n
  }
  return null
}

function parseAfterYear(): number | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--after-year')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 1700 && n <= 2100) return n
  }
  return null
}

function parseDryRun(): boolean {
  return process.argv.includes('--dry-run')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── Date parsing ──────────────────────────────────────────────────────────────
// CourtListener dates vary: "1803-02-24" (DAY), "1803-02" (MONTH), "1803" (YEAR),
// or ISO strings with time components. Normalise to Date + precision label.

type Precision = 'DAY' | 'MONTH' | 'YEAR'

function parseDate(raw: string | null): { date: Date; precision: Precision } | null {
  if (!raw) return null

  // Year only: "1803"
  if (/^\d{4}$/.test(raw)) {
    const d = new Date(`${raw}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? null : { date: d, precision: 'YEAR' }
  }

  // Year-Month only: "1803-02"
  if (/^\d{4}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}-01T00:00:00Z`)
    return isNaN(d.getTime()) ? null : { date: d, precision: 'MONTH' }
  }

  // Full date (may include time component): "1803-02-24" or "1803-02-24T00:00:00Z"
  // Append time if missing to avoid local-timezone drift on Date parse
  const normalised = /T/.test(raw) ? raw : `${raw}T00:00:00Z`
  const d = new Date(normalised)
  return isNaN(d.getTime()) ? null : { date: d, precision: 'DAY' }
}

// ── Citation formatting ────────────────────────────────────────────────────────
// citations is an array, sometimes empty, sometimes with null fields inside.

function formatCitation(citations: CLCitation[] | null | undefined): string {
  if (!citations || citations.length === 0) return ''
  const c = citations[0]
  if (c.volume == null || !c.reporter || !c.page) return ''
  return `${c.volume} ${c.reporter} ${c.page}`
}

// ── URL construction ───────────────────────────────────────────────────────────
// absolute_url is usually a path ("/opinion/123/slug/") but can be a full URL
// or, for very old records, a different pattern. Normalise to a full URL.

function buildSourceUrl(absoluteUrl: string | null | undefined): string | null {
  if (!absoluteUrl) return null
  if (absoluteUrl.startsWith('http')) return absoluteUrl
  // Ensure single leading slash
  const path = absoluteUrl.startsWith('/') ? absoluteUrl : `/${absoluteUrl}`
  return `${CL_ROOT}${path}`
}

// ── Citation count coercion ────────────────────────────────────────────────────

function toCitationCount(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw
  return isNaN(n) ? null : n
}

// ── API fetch ─────────────────────────────────────────────────────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_RETRIES = 5
const REQUEST_DELAY_MS = 800   // throttle between pages to avoid 429s
const MAX_429_WARN_MS  = 300_000 // log a long-wait warning above 5 min

async function clFetch(urlOrPath: string, token: string): Promise<unknown> {
  const url = urlOrPath.startsWith('http') ? urlOrPath : `${BASE_URL}${urlOrPath}`

  for (let attempt = 1; attempt <= MAX_RETRIES + 1; attempt++) {
    let res: Response
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 30000)
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
      const reason = (networkErr as Error)?.name === 'AbortError' ? 'fetch timeout (30s)' : 'network error'
      console.log(`  Retrying after ${reason} (attempt ${attempt}/${MAX_RETRIES})...`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (res.status === 401) {
      throw new Error('CourtListener returned 401 — check COURTLISTENER_TOKEN in .env')
    }

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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error(
      '\nError: COURTLISTENER_TOKEN not set in .env\n' +
      'Free account at: https://www.courtlistener.com/sign-in/\n' +
      'Then find your token at: https://www.courtlistener.com/api/rest/v3/ (bottom of page)\n'
    )
    process.exit(1)
  }

  const limit = parseLimit()
  const beforeYear = parseBeforeYear()
  const afterYear = parseAfterYear()
  const minCitations = parseMinCitations()
  const dryRun = parseDryRun()
  const beforeLabel = beforeYear ?? 'none'
  const afterLabel = afterYear ?? 'none'
  console.log(`\n=== CourtListener SCOTUS Ingestion — limit: ${limit}, before: ${beforeLabel}, after: ${afterLabel}, min-citations: ${minCitations}${dryRun ? ' [DRY RUN]' : ''} ===\n`)

  // Look up supreme-court-ruling topic for auto-tagging
  const scotusTopic = await prisma.topic.findUnique({ where: { slug: 'supreme-court-ruling' } })
  if (!scotusTopic) {
    console.warn('Warning: topic "supreme-court-ruling" not found — claims will not be auto-tagged')
  }

  const pageSize = Math.min(limit, 100)
  const filterParts = [
    `docket__court=scotus`,
    `citation_count__gte=${minCitations}`,
    `order_by=-citation_count`,
    `page_size=${pageSize}`,
  ]
  if (beforeYear) filterParts.push(`date_filed__lt=${beforeYear}-01-01`)
  if (afterYear) filterParts.push(`date_filed__gte=${afterYear}-01-01`)
  const firstUrl = `/clusters/?${filterParts.join('&')}`

  let fetched  = 0
  let ingested = 0
  let skipped  = 0
  let errors   = 0

  let nextUrl: string | null = firstUrl

  while (nextUrl && fetched < limit) {
    await sleep(REQUEST_DELAY_MS)

    const page = (await clFetch(nextUrl, token)) as CLPage
    const clusters: CLCluster[] = page.results ?? []

    // How many from this page do we still need?
    const need = limit - fetched
    const batch = clusters.slice(0, need)
    fetched += batch.length

    console.log(`Fetched page — ${batch.length} clusters (${fetched} total, ${page.count ?? '?'} available)\n`)

    for (const cluster of batch) {
      await sleep(REQUEST_DELAY_MS)

      const clusterId    = String(cluster.id)
      const clusterIdStr = `cl-cluster-${clusterId}`
      const caseName     = cluster.case_name?.trim() || ''
      const citationCount = toCitationCount(cluster.citation_count)
      const citation     = formatCitation(cluster.citations)
      const sourceUrl    = buildSourceUrl(cluster.absolute_url)
      const parsed       = parseDate(cluster.date_filed)

      // ── Quality gates ──────────────────────────────────────────────────────
      const gatesPassed =
        caseName.length > 0 &&
        parsed !== null &&
        citationCount !== null &&
        sourceUrl !== null

      // No name → can't produce a meaningful claim
      if (!caseName) {
        console.log(`  Skipped (insufficient data): cluster ${clusterId}`)
        skipped++
        continue
      }

      // ── Dedup ─────────────────────────────────────────────────────────────
      const existing = await prisma.claim.findUnique({ where: { externalId: clusterIdStr } })
      if (existing) {
        console.log(`  Skipped (already ingested): ${clusterIdStr} — ${caseName}`)
        skipped++
        continue
      }

      const filedDate    = parsed?.date ?? new Date()
      const precision    = parsed?.precision ?? 'DAY'
      const year         = filedDate.getUTCFullYear()
      const displayCit   = citation     ? `, ${citation}` : ''
      const displayYear  = year         ? ` (${year})`    : ''
      const countStr     = citationCount !== null ? String(citationCount) : 'unknown'

      const sourceName = `${caseName}${displayCit} — SCOTUS${displayYear}`
      const claimText  =
        `The U.S. Supreme Court in ${caseName}${displayYear} issued a ruling on the legal questions presented in the case.`

      const reviewFields = {
        humanReviewed:    false,
        autoApproved:     gatesPassed,
        reviewConfidence: gatesPassed ? 'MEDIUM' as const : undefined,
      }

      if (!gatesPassed) {
        console.warn(`  Warning: cluster ${clusterId} (${caseName}) failed quality gates — leaving unreviewed`)
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would ingest: ${caseName} (${countStr} citations, ${parsed?.date?.toISOString().slice(0,10) ?? 'no date'})`)
        ingested++
        continue
      }

      try {
        await prisma.$transaction(async tx => {
          // A. Source — the opinion page on CourtListener
          const source = await tx.source.create({
            data: {
              name:            sourceName,
              url:             sourceUrl,
              publishedAt:     filedDate,
              methodologyType: 'primary',
              ingestedBy:      'courtlistener_scotus_v1',
              externalId:      `cl-source-${clusterId}`,
              ...reviewFields,
            },
          })

          // B. Claim — institutional scaffolding; specific holding for AI extraction later
          const claim = await tx.claim.create({
            data: {
              text:                  claimText,
              claimType:             'INSTITUTIONAL',
              claimEmergedAt:        filedDate,
              claimEmergedPrecision: precision,
              currentStatus:         'HARD_FACT',
              parentClaimId:         null,
              ingestedBy:            'courtlistener_scotus_v1',
              externalId:            clusterIdStr,
              ...reviewFields,
            },
          })

          // C. Edge — Source FOR Claim (procedural: the ruling itself is the evidence)
          const edge = await tx.edge.create({
            data: {
              sourceId:     source.id,
              claimId:      claim.id,
              type:         'FOR',
              evidenceType: 'PROCEDURAL',
              ingestedBy:   'courtlistener_scotus_v1',
              ...reviewFields,
            },
          })

          // D. EdgeRevision — 90: Court of last resort, higher than FDA's 85
          await tx.edgeRevision.create({
            data: {
              edgeId:     edge.id,
              priorScore: null,
              newScore:   90,
              reason:     'U.S. Supreme Court institutional resolution — ruling issued by Court of last resort',
              changedAt:  filedDate,
            },
          })

          // E. ThresholdEvent — backdated to the opinion date, NOT today
          await tx.thresholdEvent.create({
            data: {
              claimId:             claim.id,
              triggeredBy:         `U.S. Supreme Court ruling — ${caseName}`,
              triggeredBySourceId: source.id,
              confirmedBy:         'courtlistener_scotus_v1',
              note:                `The U.S. Supreme Court issued its opinion in ${caseName}${displayCit}${displayYear}. Citation count as of ingestion: ${countStr}.`,
              evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 90 }]),
              createdAt:           filedDate,
              ingestedBy:          'courtlistener_scotus_v1',
              ...reviewFields,
            },
          })

          // F. Auto-tag with supreme-court-ruling
          if (scotusTopic) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: scotusTopic.id } },
              update: {},
              create: { claimId: claim.id, topicId: scotusTopic.id },
            })
          }
        })

        console.log(`  Ingested: ${caseName} (${countStr} citations)${gatesPassed ? '' : ' [UNREVIEWED]'}`)
        ingested++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: ${caseName} — ${msg}`)
        errors++
      }
    }

    // Follow pagination only if we still need more records
    nextUrl = page.next && fetched < limit ? page.next : null
  }

  console.log(`\n=== Summary ===`)
  console.log(`  Fetched  : ${fetched}`)
  console.log(`  Ingested : ${ingested}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Errors   : ${errors}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
