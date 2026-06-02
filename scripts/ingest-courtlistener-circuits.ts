// CourtListener Federal Circuit Courts opinion ingester.
// Pulls highly-cited published opinions from the 13 federal courts of appeals.
// Auto-tagged with "federal-courts" + per-circuit slug. Mirrors SCOTUS pattern.
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-circuits.ts \
//        --limit 50 --min-citations 20 [--court ca9] [--dry-run]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'
const CL_ROOT  = 'https://www.courtlistener.com'

// ── Circuit catalogue ─────────────────────────────────────────────────────────

interface CircuitDef {
  code:     string // CourtListener docket__court value
  slug:     string // topic slug
  name:     string // human-readable label
  shortName: string // short label used in claim text
}

const CIRCUITS: CircuitDef[] = [
  { code: 'ca1',  slug: 'us-court-of-appeals-1st-circuit',  name: 'U.S. Court of Appeals for the First Circuit',    shortName: '1st Cir.'  },
  { code: 'ca2',  slug: 'us-court-of-appeals-2nd-circuit',  name: 'U.S. Court of Appeals for the Second Circuit',   shortName: '2d Cir.'   },
  { code: 'ca3',  slug: 'us-court-of-appeals-3rd-circuit',  name: 'U.S. Court of Appeals for the Third Circuit',    shortName: '3d Cir.'   },
  { code: 'ca4',  slug: 'us-court-of-appeals-4th-circuit',  name: 'U.S. Court of Appeals for the Fourth Circuit',   shortName: '4th Cir.'  },
  { code: 'ca5',  slug: 'us-court-of-appeals-5th-circuit',  name: 'U.S. Court of Appeals for the Fifth Circuit',    shortName: '5th Cir.'  },
  { code: 'ca6',  slug: 'us-court-of-appeals-6th-circuit',  name: 'U.S. Court of Appeals for the Sixth Circuit',    shortName: '6th Cir.'  },
  { code: 'ca7',  slug: 'us-court-of-appeals-7th-circuit',  name: 'U.S. Court of Appeals for the Seventh Circuit',  shortName: '7th Cir.'  },
  { code: 'ca8',  slug: 'us-court-of-appeals-8th-circuit',  name: 'U.S. Court of Appeals for the Eighth Circuit',   shortName: '8th Cir.'  },
  { code: 'ca9',  slug: 'us-court-of-appeals-9th-circuit',  name: 'U.S. Court of Appeals for the Ninth Circuit',    shortName: '9th Cir.'  },
  { code: 'ca10', slug: 'us-court-of-appeals-10th-circuit', name: 'U.S. Court of Appeals for the Tenth Circuit',    shortName: '10th Cir.' },
  { code: 'ca11', slug: 'us-court-of-appeals-11th-circuit', name: 'U.S. Court of Appeals for the Eleventh Circuit', shortName: '11th Cir.' },
  { code: 'cadc', slug: 'us-court-of-appeals-dc-circuit',   name: 'U.S. Court of Appeals for the D.C. Circuit',     shortName: 'D.C. Cir.' },
  { code: 'cafc', slug: 'us-court-of-appeals-federal-circuit', name: 'U.S. Court of Appeals for the Federal Circuit', shortName: 'Fed. Cir.' },
]

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
  return 100
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

// ── API fetch (matches SCOTUS ingester's retry behaviour) ─────────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_RETRIES = 5
const REQUEST_DELAY_MS = 800
const MAX_429_WAIT_MS  = 120_000

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

// ── Topic upsert (federal-courts parent + per-circuit child) ──────────────────

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

// ── Per-circuit ingest ────────────────────────────────────────────────────────

interface CircuitResult {
  fetched:  number
  ingested: number
  skipped:  number
  errors:   number
}

async function ingestCircuit(
  circuit: CircuitDef,
  token: string,
  limit: number,
  minCitations: number,
  dryRun: boolean,
  parentTopicId: string | null,
): Promise<CircuitResult> {
  const result: CircuitResult = { fetched: 0, ingested: 0, skipped: 0, errors: 0 }

  const circuitTopicId = parentTopicId
    ? await ensureTopic(circuit.slug, circuit.name, parentTopicId)
    : null

  const pageSize = Math.min(limit, 100)
  const firstUrl =
    `/clusters/?docket__court=${circuit.code}` +
    `&citation_count__gte=${minCitations}` +
    `&precedential_status=Published` +
    `&order_by=-citation_count` +
    `&page_size=${pageSize}`

  let nextUrl: string | null = firstUrl

  while (nextUrl && result.fetched < limit) {
    await sleep(REQUEST_DELAY_MS)

    const page = (await clFetch(nextUrl, token)) as CLPage
    const clusters: CLCluster[] = page.results ?? []

    const need = limit - result.fetched
    const batch = clusters.slice(0, need)
    result.fetched += batch.length

    console.log(`  [${circuit.code}] page — ${batch.length} clusters (${result.fetched} total, ${page.count ?? '?'} available)`)

    for (const cluster of batch) {
      await sleep(REQUEST_DELAY_MS)

      const clusterId    = String(cluster.id)
      const clusterIdStr = `courtlistener_circuits_v1-${clusterId}`
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
      const displayYear = year ? ` (${circuit.shortName} ${year})` : ` (${circuit.shortName})`
      const countStr    = citationCount !== null ? String(citationCount) : 'unknown'

      const sourceName = `${caseName}${displayCit} — ${circuit.shortName}${year ? ` ${year}` : ''}`
      const claimText  =
        `The ${circuit.name} in ${caseName}${displayYear} issued a published opinion on the legal questions presented in the case.`

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
              ingestedBy:      'courtlistener_circuits_v1',
              externalId:      `courtlistener_circuits_v1-source-${clusterId}`,
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
              ingestedBy:            'courtlistener_circuits_v1',
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
              ingestedBy:   'courtlistener_circuits_v1',
              ...reviewFields,
            },
          })

          // Circuit courts sit one step below SCOTUS in precedential authority.
          await tx.edgeRevision.create({
            data: {
              edgeId:     edge.id,
              priorScore: null,
              newScore:   80,
              reason:     `${circuit.shortName} published opinion — federal court of appeals (binding circuit precedent)`,
              changedAt:  filedDate,
            },
          })

          await tx.thresholdEvent.create({
            data: {
              claimId:             claim.id,
              triggeredBy:         `${circuit.name} published opinion — ${caseName}`,
              triggeredBySourceId: source.id,
              confirmedBy:         'courtlistener_circuits_v1',
              note:                `${circuit.name} issued its published opinion in ${caseName}${displayCit}. Citation count as of ingestion: ${countStr}.`,
              evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 80 }]),
              createdAt:           filedDate,
              ingestedBy:          'courtlistener_circuits_v1',
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
          if (circuitTopicId) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: circuitTopicId } },
              update: {},
              create: { claimId: claim.id, topicId: circuitTopicId },
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
  const courtFilter = parseCourtFilter()
  const dryRun = parseDryRun()

  const targets = courtFilter
    ? CIRCUITS.filter(c => c.code === courtFilter)
    : CIRCUITS

  if (targets.length === 0) {
    console.error(`\nError: --court ${courtFilter} did not match any known circuit.\nKnown codes: ${CIRCUITS.map(c => c.code).join(', ')}\n`)
    process.exit(1)
  }

  console.log(
    `\n=== CourtListener Federal Circuit Ingestion — limit/court: ${limit}, ` +
    `min-citations: ${minCitations}, courts: ${targets.map(t => t.code).join(',')}` +
    `${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  // Parent "federal-courts" topic — created if missing
  const parentTopicId = dryRun
    ? null
    : await ensureTopic('federal-courts', 'Federal Courts', null)

  const totals: CircuitResult = { fetched: 0, ingested: 0, skipped: 0, errors: 0 }

  for (const circuit of targets) {
    console.log(`\n--- ${circuit.shortName} (${circuit.code}) ---`)
    const r = await ingestCircuit(circuit, token, limit, minCitations, dryRun, parentTopicId)
    totals.fetched  += r.fetched
    totals.ingested += r.ingested
    totals.skipped  += r.skipped
    totals.errors   += r.errors
    console.log(`  → ${circuit.code}: ingested=${r.ingested} skipped=${r.skipped} errors=${r.errors}`)
  }

  console.log(`\n=== Totals ===`)
  console.log(`  Fetched  : ${totals.fetched}`)
  console.log(`  Ingested : ${totals.ingested}`)
  console.log(`  Skipped  : ${totals.skipped}`)
  console.log(`  Errors   : ${totals.errors}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
