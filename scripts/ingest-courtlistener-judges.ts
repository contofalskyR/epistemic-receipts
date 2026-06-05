// CourtListener federal judges ingester.
// Pulls judicial appointments (positions) for Article III federal courts.
// One Claim per appointment — president, court, dates, judge name.
// Polity link: US polity at confirmation year surfaces partisan composition.
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-judges.ts \
//        --limit 500 [--court scotus] [--dry-run]

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'

// ── Federal court catalogue (Article III only) ────────────────────────────────
// These are the courts for which we want to ingest judge appointments.
// Extends as needed; start with SCOTUS + circuits.

const FEDERAL_COURTS = new Set([
  'scotus',
  'ca1', 'ca2', 'ca3', 'ca4', 'ca5', 'ca6', 'ca7', 'ca8', 'ca9', 'ca10', 'ca11', 'cadc', 'cafc',
])

// Friendly name lookup for known courts
const COURT_NAMES: Record<string, string> = {
  scotus: 'Supreme Court of the United States',
  ca1: 'U.S. Court of Appeals for the First Circuit',
  ca2: 'U.S. Court of Appeals for the Second Circuit',
  ca3: 'U.S. Court of Appeals for the Third Circuit',
  ca4: 'U.S. Court of Appeals for the Fourth Circuit',
  ca5: 'U.S. Court of Appeals for the Fifth Circuit',
  ca6: 'U.S. Court of Appeals for the Sixth Circuit',
  ca7: 'U.S. Court of Appeals for the Seventh Circuit',
  ca8: 'U.S. Court of Appeals for the Eighth Circuit',
  ca9: 'U.S. Court of Appeals for the Ninth Circuit',
  ca10: 'U.S. Court of Appeals for the Tenth Circuit',
  ca11: 'U.S. Court of Appeals for the Eleventh Circuit',
  cadc: 'U.S. Court of Appeals for the D.C. Circuit',
  cafc: 'U.S. Court of Appeals for the Federal Circuit',
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CLPosition {
  id:                    number
  person:                string            // URL like /api/rest/v4/people/456/
  court:                 string            // URL like /api/rest/v4/courts/scotus/
  court_str:             string | null     // e.g. "scotus" — short code sometimes included
  position_type:         string | null     // "jud", "c-jud", "pres-jud", etc.
  job_title:             string | null
  appointing_president:  string | null
  nomination_process:    string | null
  date_nominated:        string | null
  date_confirmed:        string | null
  date_start:            string | null
  date_retirement:       string | null
  date_termination:      string | null
  judicial_committee_action: string | null
  person_str:            string | null     // sometimes included inline
}

interface CLPerson {
  id:                number
  name_full:         string | null
  name_last:         string | null
  name_first:        string | null
  date_dob:          string | null
  political_affiliation: string | null
}

interface CLPage<T> {
  count:   number
  next:    string | null
  results: T[]
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

// ── Date helpers ──────────────────────────────────────────────────────────────

type Precision = 'DAY' | 'MONTH' | 'YEAR'

function parseDate(raw: string | null): { date: Date; precision: Precision } | null {
  if (!raw) return null
  if (/^\d{4}$/.test(raw)) {
    const d = new Date(`${raw}-01-01T00:00:00Z`)
    return isNaN(d.getTime()) ? null : { date: d, precision: 'YEAR' }
  }
  const normalised = /T/.test(raw) ? raw : `${raw}T00:00:00Z`
  const d = new Date(normalised)
  return isNaN(d.getTime()) ? null : { date: d, precision: 'DAY' }
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
      const reason  = (networkErr as Error)?.name === 'AbortError' ? `fetch timeout (${FETCH_TIMEOUT_MS / 1000}s)` : 'network error'
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
      if (attempt > MAX_RETRIES) throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText}`)
      console.log(`  Retrying after ${res.status} (attempt ${attempt}/${MAX_RETRIES})...`)
      await sleep(2 ** attempt * 1000)
      continue
    }

    if (!res.ok) throw new Error(`CourtListener fetch failed: ${res.status} ${res.statusText} — ${url}`)

    return res.json()
  }

  throw new Error('clFetch: exhausted retries')
}

// ── Extract court code from court URL ─────────────────────────────────────────

function extractCourtCode(courtUrl: string): string | null {
  // /api/rest/v4/courts/scotus/ → scotus
  const m = courtUrl.match(/\/courts\/([^/]+)\/?$/)
  return m ? m[1].toLowerCase() : null
}

// Extract person ID from person URL
function extractPersonId(personUrl: string): string | null {
  const m = personUrl.match(/\/people\/(\d+)\/?$/)
  return m ? m[1] : null
}

// ── Person cache ──────────────────────────────────────────────────────────────

const personCache = new Map<string, CLPerson | null>()

async function fetchPerson(personUrl: string, token: string): Promise<CLPerson | null> {
  const id = extractPersonId(personUrl)
  if (!id) return null
  if (personCache.has(id)) return personCache.get(id)!

  await sleep(REQUEST_DELAY_MS)
  try {
    const p = (await clFetch(personUrl, token)) as CLPerson
    personCache.set(id, p)
    return p
  } catch {
    personCache.set(id, null)
    return null
  }
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

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error('\nError: COURTLISTENER_TOKEN not set in .env\n')
    process.exit(1)
  }

  const limit       = parseLimit()
  const courtFilter = parseCourtFilter()
  const dryRun      = parseDryRun()
  const slow        = parseSlow()

  if (slow) {
    MAX_RETRIES      = 10
    REQUEST_DELAY_MS = 10_000
    FETCH_TIMEOUT_MS = 90_000
    console.log('  [slow mode] timeout=90s, delay=10s, retries=10')
  }

  // Limit to federal Article III judges confirmed by Senate
  const positionTypes = 'jud,c-jud,pres-jud'
  const nominationProcess = 'fed_senate'

  let filterClause = `&nomination_process=${nominationProcess}&position_type__in=${positionTypes}`
  if (courtFilter) {
    // CL court filter on positions uses court__id or court (short code works via court_str)
    filterClause += `&court=${courtFilter}`
  }

  const firstUrl = `/positions/?page_size=100&order_by=-date_start${filterClause}`

  console.log(
    `\n=== CourtListener Federal Judges Ingestion — limit: ${limit}` +
    `${courtFilter ? `, court: ${courtFilter}` : ', all federal Article III courts'}` +
    `${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  const parentTopicId = dryRun
    ? null
    : await ensureTopic('federal-judiciary', 'Federal Judiciary', null)

  let fetched  = 0
  let ingested = 0
  let skipped  = 0
  let errors   = 0
  let nextUrl: string | null = firstUrl

  while (nextUrl && fetched < limit) {
    await sleep(REQUEST_DELAY_MS)

    let page: CLPage<CLPosition>
    try {
      page = (await clFetch(nextUrl, token)) as CLPage<CLPosition>
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Page fetch failed — stopping: ${msg}`)
      errors++
      break
    }

    const positions = page.results ?? []
    const need      = limit - fetched
    const batch     = positions.slice(0, need)
    fetched        += batch.length

    console.log(`Page — ${batch.length} positions (${fetched} total, ${page.count ?? '?'} available)`)

    for (const pos of batch) {
      const courtCode = pos.court_str ?? extractCourtCode(pos.court)
      if (!courtCode) {
        skipped++
        continue
      }

      // Skip non-Article III federal courts unless explicitly requested
      if (!courtFilter && !FEDERAL_COURTS.has(courtCode)) {
        skipped++
        continue
      }

      const externalId = `courtlistener_judges_v1-pos-${pos.id}`

      const existing = await prisma.claim.findUnique({ where: { externalId } })
      if (existing) {
        console.log(`  Skipped (already ingested): ${externalId}`)
        skipped++
        continue
      }

      // Fetch person details for full name
      let judgeName = pos.person_str ?? null
      let personId: string | null = null
      if (!judgeName && pos.person) {
        const person = await fetchPerson(pos.person, token)
        judgeName = person?.name_full ?? person?.name_last ?? null
        personId  = person?.id != null ? String(person.id) : extractPersonId(pos.person)
      }

      if (!judgeName) {
        console.log(`  Skipped (no judge name): position ${pos.id}`)
        skipped++
        continue
      }

      const courtName    = COURT_NAMES[courtCode] ?? `the ${courtCode.toUpperCase()} court`
      const president    = pos.appointing_president ?? 'an unknown president'
      const jobTitle     = pos.job_title ?? 'Judge'
      const dateStr      = pos.date_confirmed ?? pos.date_start ?? pos.date_nominated
      const parsed       = parseDate(dateStr)
      const appointDate  = parsed?.date ?? new Date()
      const precision    = parsed?.precision ?? 'YEAR'
      const year         = appointDate.getUTCFullYear()

      const claimText = `${judgeName} was appointed as ${jobTitle} of the ${courtName} in ${year} by President ${president}.`
      const sourceName = `${judgeName} — ${jobTitle}, ${courtName} (${year})`
      const sourceUrl  = `https://www.courtlistener.com/person/${personId ?? pos.id}/`

      const reviewFields = { humanReviewed: false, autoApproved: false }

      if (dryRun) {
        console.log(`  [DRY RUN] Would ingest: ${claimText}`)
        ingested++
        continue
      }

      // Ensure per-president topic
      const presidentSlug  = `appointing-president-${president.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
      const presidentName  = `Appointed by President ${president}`
      const presidentTopicId = parentTopicId
        ? await ensureTopic(presidentSlug, presidentName, parentTopicId)
        : null

      try {
        await prisma.$transaction(async tx => {
          const source = await tx.source.create({
            data: {
              name:            sourceName,
              url:             sourceUrl,
              publishedAt:     appointDate,
              methodologyType: 'primary',
              ingestedBy:      'courtlistener_judges_v1',
              externalId:      `courtlistener_judges_v1-source-pos-${pos.id}`,
              ...reviewFields,
            },
          })

          const claim = await tx.claim.create({
            data: {
              text:                  claimText,
              claimType:             'INSTITUTIONAL',
              claimEmergedAt:        appointDate,
              claimEmergedPrecision: precision,
              currentStatus:         'HARD_FACT',
              verificationStatus:    'PROVISIONAL',
              parentClaimId:         null,
              ingestedBy:            'courtlistener_judges_v1',
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
              ingestedBy:   'courtlistener_judges_v1',
              ...reviewFields,
            },
          })

          // Executive appointment confirmed by Senate — procedural hard fact.
          await tx.edgeRevision.create({
            data: {
              edgeId:     edge.id,
              priorScore: null,
              newScore:   70,
              reason:     `Federal judicial appointment — ${jobTitle}, ${courtName} (${year})`,
              changedAt:  appointDate,
            },
          })

          await tx.thresholdEvent.create({
            data: {
              claimId:             claim.id,
              triggeredBy:         `Appointment of ${judgeName} as ${jobTitle} — ${courtName} ${year}`,
              triggeredBySourceId: source.id,
              confirmedBy:         'courtlistener_judges_v1',
              note:                claimText,
              evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 70 }]),
              createdAt:           appointDate,
              ingestedBy:          'courtlistener_judges_v1',
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
          if (presidentTopicId) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: presidentTopicId } },
              update: {},
              create: { claimId: claim.id, topicId: presidentTopicId },
            })
          }
        }, { timeout: 30000 })

        console.log(`  Ingested: ${claimText}`)
        ingested++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed: position ${pos.id} — ${msg}`)
        errors++
      }
    }

    nextUrl = page.next && fetched < limit ? page.next : null
  }

  const dbTotal = await prisma.claim.count({ where: { ingestedBy: 'courtlistener_judges_v1' } })
  console.log(`\n=== Totals ===`)
  console.log(`  Fetched  : ${fetched}`)
  console.log(`  Ingested : ${ingested}`)
  console.log(`  Skipped  : ${skipped}`)
  console.log(`  Errors   : ${errors}`)
  console.log(`  DB total : ${dbTotal}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
