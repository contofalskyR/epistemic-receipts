// CourtListener federal judges financial-disclosures ingester (Tier 2A).
//
// Two-pass design (per docs/courtlistener-roadmap.md § 3 Tier 2A):
//   1) Each /financial-disclosures/ form → Source (the filed PDF) linked to its
//      judge (person) + an INSTITUTIONAL form-level Claim that the judge filed
//      a disclosure for a given year.
//   2) For forms where has_been_extracted=true, pull line items from /gifts/
//      and /reimbursements/, and mint individual Claims for those above the
//      editorial threshold: gifts whose value upper-bound ≥ $5,000, and
//      reimbursements whose location is non-empty and not unambiguously
//      domestic (i.e. likely foreign).
//
// Per AGENTS.md, the schema does not yet have Source.metadata, so disclosure
// provenance lives on Claim.metadata under a `dataset` key.
//
// Requires: COURTLISTENER_TOKEN in .env.local
// Run: npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-courtlistener-disclosures.ts \
//        --slow --limit 200 [--min-year 2020] [--extracted-only] [--dry-run]

import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const BASE_URL = 'https://www.courtlistener.com/api/rest/v4'
const CL_ROOT  = 'https://www.courtlistener.com'

// Gifts: include when the upper bound of the value range is at least this much.
const GIFT_VALUE_THRESHOLD = 5_000

// ── Types ─────────────────────────────────────────────────────────────────────

interface CLDisclosure {
  id:                   number | string
  person:               string | null      // URL like /api/rest/v4/people/123/
  year:                 number | string | null
  pdf:                  string | null
  filepath:             string | null
  download_url:         string | null
  thumbnail:            string | null
  has_been_extracted:   boolean | null
  is_amended:           boolean | null
  addendum_redacted:    boolean | null
  addendum_content_raw: string | null
  date_created:         string | null
  date_modified:        string | null
  date_received:        string | null
}

interface CLGift {
  id:                   number | string
  financial_disclosure: string | null
  source:               string | null
  description:          string | null
  value:                string | null
  redacted:             boolean | null
  date_received:        string | null
}

interface CLReimbursement {
  id:                       number | string
  financial_disclosure:     string | null
  source:                   string | null
  date_raw:                 string | null
  location:                 string | null
  purpose:                  string | null
  items_paid_or_provided:   string | null
  redacted:                 boolean | null
}

interface CLPerson {
  id:          number | string
  name_full:   string | null
  name_first:  string | null
  name_middle: string | null
  name_last:   string | null
  name_suffix: string | null
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
  return 100
}

function parseMinYear(): number | null {
  const args = process.argv.slice(2)
  const idx = args.findIndex(a => a === '--min-year')
  if (idx !== -1 && args[idx + 1]) {
    const n = parseInt(args[idx + 1], 10)
    if (!isNaN(n) && n > 1900 && n <= 2100) return n
  }
  return null
}

function parseDryRun(): boolean        { return process.argv.includes('--dry-run') }
function parseSlow(): boolean          { return process.argv.includes('--slow') }
function parseExtractedOnly(): boolean { return process.argv.includes('--extracted-only') }

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ── API fetch with retry (matches SCOTUS/circuits ingesters) ──────────────────

const TRANSIENT_STATUSES = new Set([502, 503, 504])
const MAX_429_WAIT_MS    = 120_000

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

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractPersonId(personUrl: string | null): string | null {
  if (!personUrl) return null
  const m = personUrl.match(/\/people\/(\d+)\/?$/)
  return m ? m[1] : null
}

function toYear(raw: number | string | null | undefined): number | null {
  if (raw === null || raw === undefined) return null
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw
  return isNaN(n) || n < 1900 || n > 2100 ? null : n
}

function buildPersonName(p: CLPerson): string | null {
  if (p.name_full && p.name_full.trim()) return p.name_full.trim()
  const parts = [p.name_first, p.name_middle, p.name_last, p.name_suffix]
    .filter(Boolean)
    .map(s => (s as string).trim())
    .filter(s => s.length > 0)
  if (parts.length > 0) return parts.join(' ')
  if (p.name_last?.trim()) return p.name_last.trim()
  return null
}

// Disclosure value strings look like:
//   "$1,001 - $15,000", "$15,001 - $50,000", "$5,000", "Over $50,000,000"
// We parse all dollar amounts; lower = first, upper = last (or same if single).
function parseValueRange(raw: string | null | undefined): { lower: number; upper: number } | null {
  if (!raw) return null
  const matches = raw.match(/[\d,]+/g)
  if (!matches || matches.length === 0) return null
  const nums = matches
    .map(s => parseInt(s.replace(/,/g, ''), 10))
    .filter(n => !isNaN(n) && n > 0)
  if (nums.length === 0) return null
  return { lower: nums[0], upper: nums[nums.length - 1] }
}

// Editorial heuristic for "foreign" reimbursements: include when location is
// non-empty AND does not contain an unambiguous US marker. False positives are
// acceptable — every claim is PROVISIONAL and is a review-queue candidate.
const US_MARKERS = [
  'united states', 'u.s.', 'u. s.', 'usa', ' us ', ', us', '(us)',
  'washington, dc', 'washington d.c.', 'washington dc',
]
function looksForeign(location: string | null | undefined): boolean {
  if (!location) return false
  const trimmed = location.trim()
  if (trimmed.length === 0) return false
  const padded = ` ${trimmed.toLowerCase()} `
  return !US_MARKERS.some(m => padded.includes(m))
}

function disclosureSourceUrl(personId: string | null, disclosureId: string): string {
  if (personId) return `${CL_ROOT}/person/${personId}/#tab-disclosures`
  return `${CL_ROOT}/financial-disclosures/${disclosureId}/`
}

// ── Person cache ──────────────────────────────────────────────────────────────

const personCache = new Map<string, CLPerson | null>()

async function fetchPerson(personUrl: string | null, token: string): Promise<CLPerson | null> {
  const id = extractPersonId(personUrl)
  if (!id) return null
  if (personCache.has(id)) return personCache.get(id)!

  await sleep(REQUEST_DELAY_MS)
  try {
    const p = (await clFetch(personUrl!, token)) as CLPerson
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

// ── Counters ─────────────────────────────────────────────────────────────────

interface Counters {
  formsFetched:  number
  formsIngested: number
  formsSkipped:  number
  giftsIngested: number
  reimbIngested: number
  itemsSkipped:  number
  errors:        number
}

// ── Pass 2: line items for one disclosure ────────────────────────────────────

async function extractLineItems(
  disclosureId: string,
  parentClaimId: string,
  sourceId: string,
  judgeName: string,
  year: number | null,
  filedDate: Date,
  precision: 'DAY' | 'MONTH' | 'YEAR',
  token: string,
  dryRun: boolean,
  topicIds: { ethics: string | null; disclosures: string | null },
  counters: Counters,
): Promise<void> {
  // ── Gifts ─────────────────────────────────────────────────────────────
  await sleep(REQUEST_DELAY_MS)
  let gifts: CLGift[] = []
  try {
    const giftsPage = (await clFetch(
      `/gifts/?financial_disclosure=${disclosureId}&page_size=100`,
      token,
    )) as CLPage<CLGift>
    gifts = giftsPage.results ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`    Line-item fetch (gifts) failed for disclosure ${disclosureId}: ${msg}`)
    counters.errors++
  }

  for (const gift of gifts) {
    const giftId = String(gift.id)
    const range  = parseValueRange(gift.value)
    const upper  = range?.upper ?? 0
    if (upper < GIFT_VALUE_THRESHOLD) { counters.itemsSkipped++; continue }

    const externalId = `courtlistener_disclosures_v1-gift-${giftId}`
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) { counters.itemsSkipped++; continue }

    const donor       = (gift.source ?? '').trim() || 'an undisclosed source'
    const description = (gift.description ?? '').trim()
    const valueStr    = (gift.value ?? '').trim() || 'an undisclosed value'
    const yearStr     = year ? ` in ${year}` : ''
    const descTail    = description ? `, described as "${description}"` : ''
    const claimText   = `${judgeName} reported receiving a gift valued at ${valueStr} from ${donor}${descTail}${yearStr}.`

    if (dryRun) {
      console.log(`    [DRY RUN] Would ingest gift: ${claimText}`)
      counters.giftsIngested++
      continue
    }

    try {
      await prisma.$transaction(async tx => {
        const claim = await tx.claim.create({
          data: {
            text:                  claimText,
            claimType:             'INSTITUTIONAL',
            claimEmergedAt:        filedDate,
            claimEmergedPrecision: precision,
            currentStatus:         'HARD_FACT',
            verificationStatus:    'PROVISIONAL',
            parentClaimId,
            ingestedBy:            'courtlistener_disclosures_v1',
            externalId,
            humanReviewed:         false,
            autoApproved:          false,
            metadata: {
              dataset:                      'courtlistener_financial_disclosures',
              kind:                         'gift',
              courtListenerGiftId:          giftId,
              courtListenerDisclosureId:    disclosureId,
              donor,
              description:                  description || null,
              value:                        valueStr,
              valueLowerBound:              range?.lower ?? null,
              valueUpperBound:              range?.upper ?? null,
              redacted:                     gift.redacted ?? false,
              year,
            },
          },
        })

        const edge = await tx.edge.create({
          data: {
            sourceId,
            claimId:      claim.id,
            type:         'FOR',
            evidenceType: 'PROCEDURAL',
            ingestedBy:   'courtlistener_disclosures_v1',
            humanReviewed: false,
            autoApproved:  false,
          },
        })

        await tx.edgeRevision.create({
          data: {
            edgeId:     edge.id,
            priorScore: null,
            newScore:   70,
            reason:     `Federal judicial financial disclosure — gift line item (${valueStr}) sworn under penalty of perjury`,
            changedAt:  filedDate,
          },
        })

        await tx.thresholdEvent.create({
          data: {
            claimId:             claim.id,
            triggeredBy:         `Financial-disclosure gift line item — ${judgeName}`,
            triggeredBySourceId: sourceId,
            confirmedBy:         'courtlistener_disclosures_v1',
            note:                claimText,
            evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 70 }]),
            createdAt:           filedDate,
            ingestedBy:          'courtlistener_disclosures_v1',
            humanReviewed:       false,
            autoApproved:        false,
          },
        })

        if (topicIds.ethics) {
          await tx.claimTopic.upsert({
            where:  { claimId_topicId: { claimId: claim.id, topicId: topicIds.ethics } },
            update: {},
            create: { claimId: claim.id, topicId: topicIds.ethics },
          })
        }
        if (topicIds.disclosures) {
          await tx.claimTopic.upsert({
            where:  { claimId_topicId: { claimId: claim.id, topicId: topicIds.disclosures } },
            update: {},
            create: { claimId: claim.id, topicId: topicIds.disclosures },
          })
        }
      }, { timeout: 30_000 })

      console.log(`    Gift: ${judgeName} — ${valueStr} from ${donor}`)
      counters.giftsIngested++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`    Failed gift ${giftId}: ${msg}`)
      counters.errors++
    }
  }

  // ── Reimbursements (foreign only, per editorial threshold) ────────────
  await sleep(REQUEST_DELAY_MS)
  let reimbs: CLReimbursement[] = []
  try {
    const reimbPage = (await clFetch(
      `/reimbursements/?financial_disclosure=${disclosureId}&page_size=100`,
      token,
    )) as CLPage<CLReimbursement>
    reimbs = reimbPage.results ?? []
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`    Line-item fetch (reimbursements) failed for disclosure ${disclosureId}: ${msg}`)
    counters.errors++
  }

  for (const reimb of reimbs) {
    const reimbId  = String(reimb.id)
    const location = (reimb.location ?? '').trim()
    if (!looksForeign(location)) { counters.itemsSkipped++; continue }

    const externalId = `courtlistener_disclosures_v1-reimb-${reimbId}`
    const existing = await prisma.claim.findUnique({ where: { externalId } })
    if (existing) { counters.itemsSkipped++; continue }

    const sponsor = (reimb.source ?? '').trim() || 'an undisclosed source'
    const purpose = (reimb.purpose ?? '').trim()
    const items   = (reimb.items_paid_or_provided ?? '').trim()
    const dateRaw = (reimb.date_raw ?? '').trim()
    const purposeTail = purpose ? `, for ${purpose}` : ''
    const itemsTail   = items ? ` (items: ${items})` : ''
    const yearStr     = year ? ` in ${year}` : (dateRaw ? ` (${dateRaw})` : '')
    const claimText   = `${judgeName} reported receiving a foreign travel reimbursement from ${sponsor} for travel to ${location}${purposeTail}${yearStr}${itemsTail}.`

    if (dryRun) {
      console.log(`    [DRY RUN] Would ingest reimb: ${claimText}`)
      counters.reimbIngested++
      continue
    }

    try {
      await prisma.$transaction(async tx => {
        const claim = await tx.claim.create({
          data: {
            text:                  claimText,
            claimType:             'INSTITUTIONAL',
            claimEmergedAt:        filedDate,
            claimEmergedPrecision: precision,
            currentStatus:         'HARD_FACT',
            verificationStatus:    'PROVISIONAL',
            parentClaimId,
            ingestedBy:            'courtlistener_disclosures_v1',
            externalId,
            humanReviewed:         false,
            autoApproved:          false,
            metadata: {
              dataset:                      'courtlistener_financial_disclosures',
              kind:                         'reimbursement',
              courtListenerReimbursementId: reimbId,
              courtListenerDisclosureId:    disclosureId,
              sponsor,
              location,
              purpose:                      purpose || null,
              itemsPaidOrProvided:          items || null,
              dateRaw:                      dateRaw || null,
              redacted:                     reimb.redacted ?? false,
              foreign:                      true,
              year,
            },
          },
        })

        const edge = await tx.edge.create({
          data: {
            sourceId,
            claimId:      claim.id,
            type:         'FOR',
            evidenceType: 'PROCEDURAL',
            ingestedBy:   'courtlistener_disclosures_v1',
            humanReviewed: false,
            autoApproved:  false,
          },
        })

        await tx.edgeRevision.create({
          data: {
            edgeId:     edge.id,
            priorScore: null,
            newScore:   70,
            reason:     `Federal judicial financial disclosure — foreign reimbursement line item sworn under penalty of perjury`,
            changedAt:  filedDate,
          },
        })

        await tx.thresholdEvent.create({
          data: {
            claimId:             claim.id,
            triggeredBy:         `Financial-disclosure reimbursement line item — ${judgeName}`,
            triggeredBySourceId: sourceId,
            confirmedBy:         'courtlistener_disclosures_v1',
            note:                claimText,
            evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 70 }]),
            createdAt:           filedDate,
            ingestedBy:          'courtlistener_disclosures_v1',
            humanReviewed:       false,
            autoApproved:        false,
          },
        })

        if (topicIds.ethics) {
          await tx.claimTopic.upsert({
            where:  { claimId_topicId: { claimId: claim.id, topicId: topicIds.ethics } },
            update: {},
            create: { claimId: claim.id, topicId: topicIds.ethics },
          })
        }
        if (topicIds.disclosures) {
          await tx.claimTopic.upsert({
            where:  { claimId_topicId: { claimId: claim.id, topicId: topicIds.disclosures } },
            update: {},
            create: { claimId: claim.id, topicId: topicIds.disclosures },
          })
        }
      }, { timeout: 30_000 })

      console.log(`    Reimb: ${judgeName} — ${location} from ${sponsor}`)
      counters.reimbIngested++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`    Failed reimb ${reimbId}: ${msg}`)
      counters.errors++
    }
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const token = process.env.COURTLISTENER_TOKEN
  if (!token) {
    console.error('\nError: COURTLISTENER_TOKEN not set in .env.local\n')
    process.exit(1)
  }

  const limit         = parseLimit()
  const minYear       = parseMinYear()
  const dryRun        = parseDryRun()
  const slow          = parseSlow()
  const extractedOnly = parseExtractedOnly()

  if (slow) {
    MAX_RETRIES      = 10
    REQUEST_DELAY_MS = 10_000
    FETCH_TIMEOUT_MS = 90_000
    console.log('  [slow mode] timeout=90s, delay=10s, retries=10')
  }

  console.log(
    `\n=== CourtListener Financial Disclosures Ingestion — limit: ${limit}` +
    `${minYear ? `, min-year: ${minYear}` : ''}` +
    `${extractedOnly ? ', extracted-only' : ''}` +
    `${dryRun ? ' [DRY RUN]' : ''} ===\n`,
  )

  const ethicsTopicId      = dryRun ? null : await ensureTopic('judicial-ethics',       'Judicial Ethics',        null)
  const disclosuresTopicId = dryRun ? null : await ensureTopic('financial-disclosures', 'Financial Disclosures',  ethicsTopicId)
  const topicIds = { ethics: ethicsTopicId, disclosures: disclosuresTopicId }

  const filterParts = [
    `page_size=100`,
    `order_by=-year`,
  ]
  if (minYear)       filterParts.push(`year__gte=${minYear}`)
  if (extractedOnly) filterParts.push(`has_been_extracted=true`)
  const firstUrl = `/financial-disclosures/?${filterParts.join('&')}`

  const counters: Counters = {
    formsFetched: 0, formsIngested: 0, formsSkipped: 0,
    giftsIngested: 0, reimbIngested: 0, itemsSkipped: 0, errors: 0,
  }
  let nextUrl: string | null = firstUrl

  while (nextUrl && counters.formsFetched < limit) {
    await sleep(REQUEST_DELAY_MS)

    let page: CLPage<CLDisclosure>
    try {
      page = (await clFetch(nextUrl, token)) as CLPage<CLDisclosure>
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`Page fetch failed — stopping: ${msg}`)
      counters.errors++
      break
    }

    const disclosures = page.results ?? []
    const need        = limit - counters.formsFetched
    const batch       = disclosures.slice(0, need)
    counters.formsFetched += batch.length

    console.log(`Page — ${batch.length} disclosures (${counters.formsFetched} total, ${page.count ?? '?'} available)`)

    for (const disc of batch) {
      const disclosureId = String(disc.id)
      const externalId   = `courtlistener_disclosures_v1-${disclosureId}`

      // If the form was already ingested, still re-run Pass 2 in case CL has
      // since extracted line items (idempotent via per-item externalIds).
      const existing = await prisma.claim.findUnique({ where: { externalId } })
      if (existing) {
        if (disc.has_been_extracted) {
          const sourceExternalId = `courtlistener_disclosures_v1-source-${disclosureId}`
          const source = await prisma.source.findUnique({ where: { externalId: sourceExternalId } })
          const year   = toYear(disc.year)
          if (source) {
            const person     = await fetchPerson(disc.person, token)
            const judgeName  = (person && buildPersonName(person)) ?? 'A federal judge'
            const filedDate  = existing.claimEmergedAt ?? new Date()
            const precision  = (existing.claimEmergedPrecision as 'DAY' | 'MONTH' | 'YEAR' | null) ?? 'YEAR'
            await extractLineItems(
              disclosureId, existing.id, source.id, judgeName, year,
              filedDate, precision, token, dryRun, topicIds, counters,
            )
          }
        }
        counters.formsSkipped++
        continue
      }

      // Resolve judge name
      const person    = await fetchPerson(disc.person, token)
      const personId  = extractPersonId(disc.person)
      const judgeName = person && buildPersonName(person)
      if (!judgeName) {
        console.log(`  Skipped (no judge name): disclosure ${disclosureId}`)
        counters.formsSkipped++
        continue
      }

      const year = toYear(disc.year)
      if (!year) {
        console.log(`  Skipped (no year): disclosure ${disclosureId}`)
        counters.formsSkipped++
        continue
      }

      // Form filing date: prefer date_received, then date_created, then year-end.
      const rawDate   = disc.date_received ?? disc.date_created ?? `${year}-12-31`
      const parsed    = new Date(/T/.test(rawDate) ? rawDate : `${rawDate}T00:00:00Z`)
      const filedDate = isNaN(parsed.getTime()) ? new Date(`${year}-12-31T00:00:00Z`) : parsed
      const precision: 'DAY' | 'MONTH' | 'YEAR' = disc.date_received ? 'DAY' : 'YEAR'

      const redactedTag   = disc.addendum_redacted ? '[REDACTED ADDENDUM] ' : ''
      const amendedTag    = disc.is_amended ? '[AMENDED] ' : ''
      const extractedNote = disc.has_been_extracted ? '' : ' (line items not yet extracted)'
      const sourceName    = `${redactedTag}${amendedTag}${judgeName} — Financial Disclosure (${year})`
      const sourceUrl     = disc.download_url ?? disc.pdf ?? disclosureSourceUrl(personId, disclosureId)
      const claimText     = `${judgeName} filed a federal judicial Annual Financial Disclosure Report for calendar year ${year}${extractedNote}.`

      const formMetadata = {
        dataset:                  'courtlistener_financial_disclosures',
        kind:                     'form',
        courtListenerDisclosureId: disclosureId,
        courtListenerPersonId:     personId,
        year,
        hasBeenExtracted:         disc.has_been_extracted ?? false,
        isAmended:                disc.is_amended ?? false,
        addendumRedacted:         disc.addendum_redacted ?? false,
        pdfUrl:                   disc.download_url ?? disc.pdf ?? disc.filepath ?? null,
      }

      if (dryRun) {
        console.log(`  [DRY RUN] Would ingest form: ${claimText}`)
        counters.formsIngested++

        if (disc.has_been_extracted) {
          await extractLineItems(
            disclosureId, 'dry-run-claim-id', 'dry-run-source-id',
            judgeName, year, filedDate, precision, token, true, topicIds, counters,
          )
        }
        continue
      }

      let createdClaimId:  string | null = null
      let createdSourceId: string | null = null

      try {
        await prisma.$transaction(async tx => {
          const source = await tx.source.create({
            data: {
              name:            sourceName,
              url:             sourceUrl,
              publishedAt:     filedDate,
              methodologyType: 'primary',
              ingestedBy:      'courtlistener_disclosures_v1',
              externalId:      `courtlistener_disclosures_v1-source-${disclosureId}`,
              humanReviewed:   false,
              autoApproved:    false,
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
              ingestedBy:            'courtlistener_disclosures_v1',
              externalId,
              humanReviewed:         false,
              autoApproved:          false,
              metadata:              formMetadata,
            },
          })

          const edge = await tx.edge.create({
            data: {
              sourceId:     source.id,
              claimId:      claim.id,
              type:         'FOR',
              evidenceType: 'PROCEDURAL',
              ingestedBy:   'courtlistener_disclosures_v1',
              humanReviewed: false,
              autoApproved:  false,
            },
          })

          await tx.edgeRevision.create({
            data: {
              edgeId:     edge.id,
              priorScore: null,
              newScore:   70,
              reason:     `Federal judicial financial disclosure — sworn court-filed document (${year})`,
              changedAt:  filedDate,
            },
          })

          await tx.thresholdEvent.create({
            data: {
              claimId:             claim.id,
              triggeredBy:         `Filed financial disclosure — ${judgeName} (${year})`,
              triggeredBySourceId: source.id,
              confirmedBy:         'courtlistener_disclosures_v1',
              note:                claimText,
              evidenceSnapshot:    JSON.stringify([{ id: edge.id, score: 70 }]),
              createdAt:           filedDate,
              ingestedBy:          'courtlistener_disclosures_v1',
              humanReviewed:       false,
              autoApproved:        false,
            },
          })

          if (ethicsTopicId) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: ethicsTopicId } },
              update: {},
              create: { claimId: claim.id, topicId: ethicsTopicId },
            })
          }
          if (disclosuresTopicId) {
            await tx.claimTopic.upsert({
              where:  { claimId_topicId: { claimId: claim.id, topicId: disclosuresTopicId } },
              update: {},
              create: { claimId: claim.id, topicId: disclosuresTopicId },
            })
          }

          createdClaimId  = claim.id
          createdSourceId = source.id
        }, { timeout: 30_000 })

        console.log(`  Form: ${judgeName} (${year})${disc.addendum_redacted ? ' [REDACTED]' : ''}`)
        counters.formsIngested++

        if (disc.has_been_extracted && createdClaimId && createdSourceId) {
          await extractLineItems(
            disclosureId, createdClaimId, createdSourceId,
            judgeName, year, filedDate, precision, token, dryRun, topicIds, counters,
          )
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed disclosure ${disclosureId} (${judgeName}): ${msg}`)
        counters.errors++
      }
    }

    nextUrl = page.next && counters.formsFetched < limit ? page.next : null
  }

  let dbForms = 0
  try {
    dbForms = await prisma.claim.count({ where: { ingestedBy: 'courtlistener_disclosures_v1' } })
  } catch {
    /* best-effort */
  }

  console.log(`\n=== Totals ===`)
  console.log(`  Forms fetched      : ${counters.formsFetched}`)
  console.log(`  Forms ingested     : ${counters.formsIngested}`)
  console.log(`  Forms skipped      : ${counters.formsSkipped}`)
  console.log(`  Gifts ingested     : ${counters.giftsIngested}`)
  console.log(`  Reimb ingested     : ${counters.reimbIngested}`)
  console.log(`  Items skipped      : ${counters.itemsSkipped}`)
  console.log(`  Errors             : ${counters.errors}`)
  console.log(`  DB total (this tag): ${dbForms}\n`)

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error(err)
  await prisma.$disconnect()
  process.exit(1)
})
