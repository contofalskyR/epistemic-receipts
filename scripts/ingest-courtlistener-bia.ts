// CourtListener Board of Immigration Appeals (BIA) opinion ingester.
// Pulls published precedent decisions from the BIA — binding within immigration law.
// Auto-tagged with "immigration-courts" parent + "court-bia" child topic.
// Mirrors the SCOTUS / circuits ingester pattern.
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-bia.ts \
//        --limit 500 --min-citations 5 [--dry-run] [--slow]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'
const CL_ROOT  = 'https://www.courtlistener.com'

// ── BIA court constants ───────────────────────────────────────────────────────

const BIA_CODE       = 'bia'
const BIA_SLUG       = 'court-bia'
const BIA_NAME       = 'Board of Immigration Appeals'
const BIA_SHORT_NAME = 'B.I.A.'

const PARENT_SLUG = 'immigration-courts'
const PARENT_NAME = 'Immigration Courts'

// ── Types ─────────────────────────────────────────────────────────────────────

interface CLCitation {
  volume:   number | null
  reporter: string | null
  page:     string | null
  type:     number
}

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

// ── CLI flag parsing ──────────────────────────────────────────────────────────

function parseLimit(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--limit')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 0) return n
  }
  return 500
}

function parseMinCitations(): number {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--min-citations')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n >= 0) return n
  }
  return 5
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

// ── Date parsing ──────────────────────────────────────────────────────────────

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

// ── API fetch (matches circuits ingester's retry behaviour) ───────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_429_WARN_MS  = 300_000 // log a long-wait warning above 5 min

let MAX_RETRIES    = 5
let REQUEST_DELAY_MS = 800
let FETCH_TIMEOUT_MS = 30_000

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

// ── Topic upsert ──────────────────────────────────────────────────────────────

async function ensureTopic(slug: string, name: string, parentId: string | null): Promise<string> {
  const existing = await prisma.topic.findUnique({ where: { slug } })
  if (existing) return existing.id
  const created = await prisma.topic.create({
    data: {
      name,
      slug,
      domain: 'law',
      parentTopicId: parentId ?? undefined,
    },
  })
  return created.id
}

// ── Ingest ────────────────────────────────────────────────────────────────────

interface IngestResult {
  fetched:  number
  ingested: number
  skipped:  number
  errors:   number
}

async function ingestBIA(
  token: string,
  limit: number,
  minCitations: number,
  dryRun: boolean,
  parentTopicId: string | null,
  courtTopicId: string | null,
): Promise<IngestResult> {
  const result: IngestResult = { fetched: 0, ingested: 0, skipped: 0, errors: 0 }

  const pageSize = Math.min(limit, 100)
  const firstUrl =
    `/clusters/?docket__court=${BIA_CODE}` +
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
      console.error(`  [${BIA_CODE}] page fetch failed after retries — aborting: ${msg}`)
      result.errors++
      break
    }
    const clusters: CLCluster[] = page.results ?? []

    const need = limit - result.fetched
    const batch = clusters.slice(0, need)
    result.fetched += batch.length

    console.log(`  [${BIA_CODE}] page — ${batch.length} clusters (${result.fetched} total, ${page.count ?? '?'} available)`)

    for (const cluster of batch) {
      await sleep(REQUEST_DELAY_MS)

      const clusterId    = String(cluster.id)
      const clusterIdStr = `courtlistener_bia_v1-${clusterId}`
      const caseName     = cluster.case_name?.trim() || ''
      const citationCount = toCitationCount(cluster.citation_count)
      const citation     = formatCitation(cluster.citations)
      const sourceUrl    = buildSourceUrl(cluster.absolute_url)
      const parsed       = parseDate(cluster.date_filed)

      if (!caseName) {
        console.log(`    Skipped (no case name): ${clusterId}`)
        result.skipped++
        continue
      }

      const existing = await prisma.claim.findUnique({ where: { externalId: clusterIdStr } })
      if (existing) {
        console.log(`    Skipped (already ingested): ${clusterIdStr} — ${caseName}`)
        result.skipped++
        continue
      }

      const filedDate   = parsed?.date ?? new Date()
      const precision   = parsed?.precision ?? 'DAY'
      const year        = filedDate.getUTCFullYear()
      const displayCit  = citation ? `, ${citation}` : ''
      const displayYear = year ? ` (${BIA_SHORT_NAME} ${year})` : ` (${BIA_SHORT_NAME})`
      const countStr    = citationCount !== null ? String(citationCount) : 'unknown'

      const sourceName = `${caseName}${displayCit} — ${BIA_SHORT_NAME}${year ? ` ${year}` : ''}`
      const claimText  =
        `The ${BIA_NAME} in ${caseName}${displayYear} issued a published precedent decision on the immigration questions presented in the case.`

      const reviewFields = {
        humanReviewed: false,
        autoApproved:  false,
      }

      if (dryRun) {
        console.log(`    [DRY RUN] Would ingest: ${caseName} (${countStr} citations, ${parsed?.date?.toISOString().slice(0,10) ?? 'no date'})`)
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
              ingestedBy:      'courtlistener_bia_v1',
              externalId:      `courtlistener_bia_v1-source-${clusterId}`,
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
              ingestedBy:            'courtlistener_bia_v1',
              externalId:            clusterIdStr,
              ...reviewFields,
            },
          })

          const edge = await tx.edge.create({
            data: {
              sourceId:     source.id,
              claimId:      claim.id,
              type:         'FOR',
              evidenceType: 'PROCEDURAL',
              ingestedBy:   'courtlistener_bia_v1',
              ...reviewFields,
            },
          })

          // BIA precedent decisions are binding within immigration law, but
          // narrower in subject-matter authority than federal circuit opinions.
          await tx.edgeRevision.create({
            data: {
              edgeId:     edge.id,
              priorScore: null,
              newScore:   65,
              reason:     `${BIA_SHORT_NAME} published precedent decision — Board of Immigration Appeals (binding within immigration law)`,
              changedAt:  filedDate,
            },
          })

          await tx.thresholdEvent.create({
            data: {
              claimId:             claim.id,
              triggeredBy:         `${BIA_NAME} published precedent decision — ${caseName}`,
              triggeredBySourceId: source.id,
              confirmedBy:         'courtlistener_bia_v1',
              note:                `${BIA_NAME} issued its published precedent decision in ${caseName}${displayCit}. Citation count as of ingestion: ${countStr}.`,
              evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 65 }]),
              createdAt:           filedDate,
              ingestedBy:          'courtlistener_bia_v1',
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

  const limit = parseLimit()
  const minCitations = parseMinCitations()
  const dryRun = parseDryRun()
  const slow = parseSlow()

  if (slow) {
    MAX_RETRIES       = 10
    REQUEST_DELAY_MS  = 10_000
    FETCH_TIMEOUT_MS  = 90_000
    console.log('  [slow mode] timeout=90s, delay=10s, retries=10')
  }

  console.log(
    `\n=== CourtListener BIA Ingestion — limit: ${limit}, ` +
    `min-citations: ${minCitations}${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  const parentTopicId = dryRun
    ? null
    : await ensureTopic(PARENT_SLUG, PARENT_NAME, null)

  const courtTopicId = dryRun
    ? null
    : await ensureTopic(BIA_SLUG, BIA_NAME, parentTopicId)

  console.log(`\n--- ${BIA_SHORT_NAME} (${BIA_CODE}) ---`)
  const totals: IngestResult = { fetched: 0, ingested: 0, skipped: 0, errors: 0 }

  try {
    const r = await ingestBIA(token, limit, minCitations, dryRun, parentTopicId, courtTopicId)
    totals.fetched  += r.fetched
    totals.ingested += r.ingested
    totals.skipped  += r.skipped
    totals.errors   += r.errors
    console.log(`  → ${BIA_CODE}: ingested=${r.ingested} skipped=${r.skipped} errors=${r.errors}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`  → ${BIA_CODE}: FAILED — ${msg}`)
    totals.errors++
  }

  console.log(`\n=== Totals ===`)
  console.log(`  Fetched  : ${totals.fetched}`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}`)

  if (!dryRun) {
    const dbTotal = await prisma.claim.count({
      where: { ingestedBy: 'courtlistener_bia_v1', deleted: false },
    })
    console.log(`\n  DB total for 'courtlistener_bia_v1': ${dbTotal}\n`)
  } else {
    console.log('')
  }

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
