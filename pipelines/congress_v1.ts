// Pilot pipeline 1: Congress.gov Enacted Laws
// Archetype: paginated JSON API with auth key
// Migrated from scripts/ingest-congress.ts (now in scripts/legacy/)

import { definePipeline, type Adapter } from '@/lib/ingest/definePipeline'
import { prisma } from '@/lib/prisma'

const TAG = 'congress_v1'
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const PAGE_SIZE = 250
const ALL_CONGRESSES = Array.from({ length: 23 }, (_, i) => 97 + i)

interface CongressBill {
  number: string
  type: string
  congress: number
  title: string
  originChamber: string
  originChamberCode: string
  latestAction: { actionDate: string; text: string }
  url: string
}

interface CongressLawPage {
  bills: CongressBill[]
  pagination: { count: number; next?: string }
}

interface RawCongressItem {
  bill: CongressBill
  congressIndex: number
}

function parseCursor(cursor: string | null): { congressIndex: number; offset: number } {
  if (!cursor) return { congressIndex: 0, offset: 0 }
  const m = /^CONGRESS:(\d+):OFFSET:(\d+)$/.exec(cursor)
  if (!m) return { congressIndex: 0, offset: 0 }
  return { congressIndex: parseInt(m[1]!), offset: parseInt(m[2]!) }
}

function encodeCursor(congressIndex: number, offset: number): string {
  return `CONGRESS:${congressIndex}:OFFSET:${offset}`
}

const BILL_TYPE_URL: Record<string, string> = {
  HR: 'house-bill', S: 'senate-bill', HJRES: 'house-joint-resolution',
  SJRES: 'senate-joint-resolution', HCONRES: 'house-concurrent-resolution',
  SCONRES: 'senate-concurrent-resolution', HRES: 'house-simple-resolution',
  SRES: 'senate-simple-resolution',
}

const BILL_TYPE_PREFIX: Record<string, string> = {
  HR: 'H.R.', S: 'S.', HJRES: 'H.J.Res.', SJRES: 'S.J.Res.',
  HCONRES: 'H.Con.Res.', SCONRES: 'S.Con.Res.', HRES: 'H.Res.', SRES: 'S.Res.',
}

function billDisplayNumber(type: string, number: string): string {
  return `${BILL_TYPE_PREFIX[type.toUpperCase()] ?? type} ${number}`
}

function billSourceUrl(congress: number, type: string, number: string): string {
  const urlType = BILL_TYPE_URL[type.toUpperCase()] ?? type.toLowerCase()
  return `https://www.congress.gov/bill/${congress}th-congress/${urlType}/${number}`
}

const ORDINAL_SUFFIXES = ['th', 'st', 'nd', 'rd']
function ordinalCongress(n: number): string {
  const v = n % 100
  return n + (ORDINAL_SUFFIXES[(v - 20) % 10] ?? ORDINAL_SUFFIXES[v] ?? ORDINAL_SUFFIXES[0]!)
}

const PRESIDENT_ERA: Record<number, string> = {
  97: 'era-reagan', 98: 'era-reagan', 99: 'era-reagan', 100: 'era-reagan',
  101: 'era-bush-sr', 102: 'era-bush-sr',
  103: 'era-clinton', 104: 'era-clinton', 105: 'era-clinton', 106: 'era-clinton',
  107: 'era-bush-jr', 108: 'era-bush-jr', 109: 'era-bush-jr', 110: 'era-bush-jr',
  111: 'era-obama', 112: 'era-obama', 113: 'era-obama', 114: 'era-obama',
  115: 'era-trump-1', 116: 'era-trump-1',
  117: 'era-biden', 118: 'era-biden',
  119: 'era-trump-2',
}

let lastReqAt = 0
const MIN_INTERVAL_MS = 500

async function throttle() {
  const wait = MIN_INTERVAL_MS - (Date.now() - lastReqAt)
  if (wait > 0) await new Promise(r => setTimeout(r, wait))
  lastReqAt = Date.now()
}

async function congressFetch(url: string): Promise<CongressLawPage> {
  await throttle()
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Congress API ${res.status} at ${url.replace(/api_key=[^&]+/, 'api_key=REDACTED')}`)
  return res.json() as Promise<CongressLawPage>
}

const congressAdapter: Adapter<RawCongressItem> = {
  async fetchBatch(cursor) {
    const apiKey = process.env.CONGRESS_API_KEY ?? 'DEMO_KEY'
    const { congressIndex, offset } = parseCursor(cursor)

    if (congressIndex >= ALL_CONGRESSES.length) {
      return { items: [], nextCursor: null }
    }

    const congressNum = ALL_CONGRESSES[congressIndex]!
    const url = `${CONGRESS_BASE}/law/${congressNum}?api_key=${encodeURIComponent(apiKey)}&limit=${PAGE_SIZE}&offset=${offset}&format=json`
    const data = await congressFetch(url)
    const bills = data.bills ?? []

    const items: RawCongressItem[] = bills.map(bill => ({ bill, congressIndex }))

    let nextCursor: string | null
    if (data.pagination?.next && bills.length === PAGE_SIZE) {
      nextCursor = encodeCursor(congressIndex, offset + PAGE_SIZE)
    } else if (congressIndex + 1 < ALL_CONGRESSES.length) {
      nextCursor = encodeCursor(congressIndex + 1, 0)
    } else {
      nextCursor = null
    }

    return { items, nextCursor }
  },
}

function transform(raw: RawCongressItem) {
  const { bill } = raw
  const typeUpper = bill.type.toUpperCase()
  const displayNumber = billDisplayNumber(typeUpper, bill.number)
  const sourceUrl = billSourceUrl(bill.congress, typeUpper, bill.number)
  const externalId = `congress_law_${bill.congress}_${bill.type.toLowerCase()}_${bill.number}`

  let claimEmergedAt: Date | null = null
  let claimEmergedPrecision: string | null = null
  if (bill.latestAction?.actionDate) {
    const d = new Date(bill.latestAction.actionDate + 'T00:00:00Z')
    if (!isNaN(d.getTime())) {
      claimEmergedAt = d
      claimEmergedPrecision = 'DAY'
    }
  }

  const ordinal = ordinalCongress(bill.congress)
  const claimText = `${displayNumber} (${ordinal} Congress) enacted — ${bill.title}`

  const eraSlug = PRESIDENT_ERA[bill.congress]
  const topicSlugs = [eraSlug, `congress-${bill.congress}th-enacted`].filter(Boolean) as string[]

  return {
    externalId,
    claim: {
      text: claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'HARD_FACT',
      verificationStatus: 'VERIFIED',
      claimEmergedAt,
      claimEmergedPrecision,
      metadata: {
        dataset: TAG,
        billNumber: bill.number,
        congress: bill.congress,
        billType: typeUpper,
        enactedDate: bill.latestAction?.actionDate ?? null,
        sponsor: null,
        sponsorState: null,
      },
    },
    sources: [{
      externalId: `congress_law_source_${bill.congress}_${bill.type.toLowerCase()}_${bill.number}`,
      name: `Congress.gov: ${displayNumber} (${ordinal} Congress)`,
      url: sourceUrl,
      publishedAt: claimEmergedAt,
      methodologyType: 'primary',
    }],
    edges: [{ sourceIndex: 0, type: 'FOR', evidenceType: 'EVIDENTIARY', score: 95, scoreReason: 'Congress.gov enacted public law — HARD_FACT' }],
    topicSlugs,
  }
}

function validate(t: ReturnType<typeof transform>): { ok: true } | { ok: false; reason: string } {
  if (!t.externalId) return { ok: false, reason: 'missing externalId' }
  if (!t.claim.text?.trim()) return { ok: false, reason: 'empty claim text' }
  if (!t.sources[0]?.url) return { ok: false, reason: 'missing source url' }
  return { ok: true }
}

export const pipeline = definePipeline({
  tag: TAG,
  adapter: congressAdapter,
  batchSize: PAGE_SIZE,
  rateLimitMs: 0,
  autoApproved: false,
  transform,
  validate,
})

export async function setup(): Promise<void> {
  const topicCache = new Map<string, string>()

  async function ensureTopic(slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
    if (topicCache.has(slug)) return topicCache.get(slug)!
    const existing = await prisma.topic.findUnique({ where: { slug } })
    if (existing) { topicCache.set(slug, existing.id); return existing.id }
    let parentTopicId: string | undefined
    if (parentSlug) {
      const parent = await prisma.topic.findUnique({ where: { slug: parentSlug } })
      if (parent) parentTopicId = parent.id
    }
    const created = await prisma.topic.create({ data: { slug, name, domain, parentTopicId } })
    topicCache.set(slug, created.id)
    return created.id
  }

  const PARENT_SLUG = 'congress-enacted-bills'
  await ensureTopic(PARENT_SLUG, 'Congress — Enacted Bills', 'government')

  const ERA_NAMES: Record<string, string> = {
    'era-reagan': 'Reagan Era — Enacted Legislation',
    'era-bush-sr': 'Bush Sr. Era — Enacted Legislation',
    'era-clinton': 'Clinton Era — Enacted Legislation',
    'era-bush-jr': 'Bush Jr. Era — Enacted Legislation',
    'era-obama': 'Obama Era — Enacted Legislation',
    'era-trump-1': 'Trump Era (2017–21) — Enacted Legislation',
    'era-biden': 'Biden Era — Enacted Legislation',
    'era-trump-2': 'Trump Era (2025–) — Enacted Legislation',
  }

  for (const [slug, name] of Object.entries(ERA_NAMES)) {
    await ensureTopic(slug, name, 'government', PARENT_SLUG)
  }

  for (const num of ALL_CONGRESSES) {
    const eraSlug = PRESIDENT_ERA[num]
    await ensureTopic(
      `congress-${num}th-enacted`,
      `${ordinalCongress(num)} Congress — Enacted Bills`,
      'government',
      eraSlug,
    )
  }
}
