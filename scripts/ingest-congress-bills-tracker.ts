// Congress Bills Status Tracker — perpetual ingestion of 119th Congress bill states.
// Source: Congress.gov API v3 (api.congress.gov/v3). Requires CONGRESS_API_KEY in .env.local.
// Scope: ALL bill types in the current congress, sorted by updateDate desc.
// Upsert semantics: existing claims are refreshed when latestAction changes.
// Filename: separate from the shipped enacted-bills pipeline (ingest-congress-bills.ts /
// congress_bills_v1) — this tracker uses INGESTED_BY=congress_bills_tracker_v1 and
// emits PROVISIONAL claims so the two pipelines coexist without trampling each other.
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-bills-tracker.ts
//   npx dotenv-cli -e .env.local -- npx tsx scripts/ingest-congress-bills-tracker.ts --limit 100 --offset 250 --verbose

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_bills_tracker_v1'
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const CURRENT_CONGRESS = 119
const API_KEY = process.env.CONGRESS_API_KEY
if (!API_KEY) { console.error('CONGRESS_API_KEY not set'); process.exit(1) }

const PAGE_SIZE = 250
const REQUEST_DELAY_MS = 200
const DEFAULT_LIMIT = 0 // 0 = no limit (pull all bills)

const BILL_TYPES = ['hr', 's', 'hjres', 'sjres', 'hconres', 'sconres', 'hres', 'sres'] as const
type BillType = typeof BILL_TYPES[number]

const BILL_TYPE_DISPLAY: Record<string, string> = {
  hr: 'H.R.', s: 'S.',
  hjres: 'H.J.Res.', sjres: 'S.J.Res.',
  hconres: 'H.Con.Res.', sconres: 'S.Con.Res.',
  hres: 'H.Res.', sres: 'S.Res.',
}

const BILL_TYPE_URL_PATH: Record<string, string> = {
  hr: 'house-bill', s: 'senate-bill',
  hjres: 'house-joint-resolution', sjres: 'senate-joint-resolution',
  hconres: 'house-concurrent-resolution', sconres: 'senate-concurrent-resolution',
  hres: 'house-resolution', sres: 'senate-resolution',
}

const STATUS_SLUGS = [
  'status-introduced',
  'status-passed-house',
  'status-passed-senate',
  'status-enacted',
  'status-vetoed',
  'status-failed',
  'status-in-progress',
] as const

// ── CLI ───────────────────────────────────────────────────────────────────────

interface CliArgs { limit: number; offset: number; verbose: boolean }

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const li = args.indexOf('--limit')
  const oi = args.indexOf('--offset')
  return {
    limit: li !== -1 ? parseInt(args[li + 1] ?? String(DEFAULT_LIMIT), 10) : DEFAULT_LIMIT,
    offset: oi !== -1 ? parseInt(args[oi + 1] ?? '0', 10) : 0,
    verbose: args.includes('--verbose'),
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}

function statusSlug(actionText: string | undefined): typeof STATUS_SLUGS[number] {
  const t = actionText ?? ''
  if (/became public law|signed by president/i.test(t)) return 'status-enacted'
  if (/vetoed/i.test(t)) return 'status-vetoed'
  if (/failed of passage|failed to pass|on passage.*failed|motion to suspend the rules.*failed|on motion to suspend the rules.*not agreed to|bill rejected|cloture motion rejected/i.test(t)) return 'status-failed'
  if (/passed senate|agreed to in senate/i.test(t)) return 'status-passed-senate'
  if (/passed house|agreed to in house/i.test(t)) return 'status-passed-house'
  if (/^introduced|introduced in/i.test(t)) return 'status-introduced'
  return 'status-in-progress'
}

function statusName(slug: typeof STATUS_SLUGS[number]): string {
  switch (slug) {
    case 'status-introduced': return 'Status: Introduced'
    case 'status-passed-house': return 'Status: Passed House'
    case 'status-passed-senate': return 'Status: Passed Senate'
    case 'status-enacted': return 'Status: Enacted'
    case 'status-vetoed': return 'Status: Vetoed'
    case 'status-failed': return 'Status: Failed'
    case 'status-in-progress': return 'Status: In Progress'
  }
}

function buildSourceUrl(billType: string, number: string): string {
  const path = BILL_TYPE_URL_PATH[billType] ?? billType
  return `https://www.congress.gov/bill/${ordinal(CURRENT_CONGRESS)}-congress/${path}/${number}`
}

interface BillSponsor {
  fullName?: string
  firstName?: string
  lastName?: string
  party?: string
  state?: string
}

function buildSponsorString(s: BillSponsor | undefined): string {
  if (!s) return 'Unknown sponsor'
  const name = (s.fullName && s.fullName.trim()) || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Unknown sponsor'
  const partyState = [s.party, s.state].filter(Boolean).join('-')
  return partyState ? `${name} (${partyState})` : name
}

// ── Rate-limited HTTP ─────────────────────────────────────────────────────────

let lastReqAt = 0
function sleep(ms: number): Promise<void> { return new Promise(r => setTimeout(r, ms)) }
async function throttle(): Promise<void> {
  const wait = REQUEST_DELAY_MS - (Date.now() - lastReqAt)
  if (wait > 0) await sleep(wait)
  lastReqAt = Date.now()
}

async function apiFetch<T>(url: string, retries = 3): Promise<T> {
  let delay = 2000
  for (let attempt = 0; attempt <= retries; attempt++) {
    await throttle()
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if ([429, 502, 503, 504].includes(res.status) && attempt < retries) {
      console.warn(`  HTTP ${res.status} — retrying in ${delay}ms`)
      await sleep(delay)
      delay *= 2
      continue
    }
    if (!res.ok) throw new Error(`Congress API ${res.status} at ${url}`)
    return res.json() as Promise<T>
  }
  throw new Error(`Failed after ${retries} retries: ${url}`)
}

// ── API types ─────────────────────────────────────────────────────────────────

interface BillListItem {
  congress: number
  number: string
  type: string
  title?: string
  latestAction?: { actionDate?: string; text?: string }
  updateDate?: string
  url?: string
}

interface BillListResponse {
  bills?: BillListItem[]
  pagination?: { count?: number; next?: string }
}

interface BillDetailBill {
  congress: number
  number: string
  type: string
  title?: string
  introducedDate?: string
  latestAction?: { actionDate?: string; text?: string }
  sponsors?: BillSponsor[]
  policyArea?: { name?: string }
  updateDate?: string
}

interface BillDetailResponse {
  bill: BillDetailBill
}

async function fetchBillList(offset: number): Promise<BillListResponse> {
  const url = `${CONGRESS_BASE}/bill/${CURRENT_CONGRESS}?sort=updateDate+desc&limit=${PAGE_SIZE}&offset=${offset}&api_key=${API_KEY}&format=json`
  return apiFetch<BillListResponse>(url)
}

async function fetchBillDetail(billType: string, number: string): Promise<BillDetailResponse> {
  const url = `${CONGRESS_BASE}/bill/${CURRENT_CONGRESS}/${billType}/${number}?api_key=${API_KEY}&format=json`
  return apiFetch<BillDetailResponse>(url)
}

// ── Claim text + metadata ────────────────────────────────────────────────────

function buildClaimText(d: BillDetailBill): string {
  const billType = d.type.toLowerCase()
  const typeDisplay = BILL_TYPE_DISPLAY[billType] ?? billType.toUpperCase()
  const sponsor = buildSponsorString(d.sponsors?.[0])
  const latestAction = d.latestAction?.text ?? 'No action recorded'
  const latestActionDate = d.latestAction?.actionDate ?? 'unknown date'
  const policyArea = d.policyArea?.name ? ` Policy area: ${d.policyArea.name}.` : ''
  const title = d.title ?? '(no title)'
  return `${typeDisplay} ${d.number} (${ordinal(CURRENT_CONGRESS)} Congress) — "${title}". Sponsored by ${sponsor}. Latest action: ${latestAction} (${latestActionDate}).${policyArea}`
}

// ── Topic management ──────────────────────────────────────────────────────────

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>

const topicIdCache = new Map<string, string>()

async function ensureTopic(
  tx: TxClient,
  slug: string,
  name: string,
  domain: string,
  parentSlug?: string,
): Promise<string> {
  if (topicIdCache.has(slug)) return topicIdCache.get(slug)!
  const existing = await tx.topic.findUnique({ where: { slug } })
  if (existing) { topicIdCache.set(slug, existing.id); return existing.id }

  let parentTopicId: string | null = null
  if (parentSlug) {
    const parent = await tx.topic.findUnique({ where: { slug: parentSlug } })
    parentTopicId = parent?.id ?? null
  }
  const created = await tx.topic.create({ data: { slug, name, domain, parentTopicId } })
  topicIdCache.set(slug, created.id)
  return created.id
}

interface DesiredTag { slug: string; name: string; parent?: string }

function desiredTagsFor(billType: string, status: typeof STATUS_SLUGS[number]): DesiredTag[] {
  const typeDisplay = BILL_TYPE_DISPLAY[billType] ?? billType.toUpperCase()
  return [
    { slug: 'legislation', name: 'Legislation' },
    { slug: 'us-federal', name: 'US Federal', parent: 'legislation' },
    { slug: `congress-${CURRENT_CONGRESS}`, name: `${ordinal(CURRENT_CONGRESS)} Congress`, parent: 'us-federal' },
    { slug: `bill-type-${billType}`, name: `Bill Type ${typeDisplay}`, parent: `congress-${CURRENT_CONGRESS}` },
    { slug: status, name: statusName(status), parent: `congress-${CURRENT_CONGRESS}` },
  ]
}

async function syncTopicTags(
  tx: TxClient,
  claimId: string,
  billType: string,
  status: typeof STATUS_SLUGS[number],
): Promise<void> {
  const tags = desiredTagsFor(billType, status)

  const desiredIds = new Set<string>()
  for (const t of tags) {
    const id = await ensureTopic(tx, t.slug, t.name, 'government', t.parent)
    desiredIds.add(id)
  }

  // Drop stale status topic links (status may have transitioned since last pass)
  const staleStatusSlugs = STATUS_SLUGS.filter(s => s !== status)
  const staleTopics = await tx.topic.findMany({
    where: { slug: { in: [...staleStatusSlugs] } },
    select: { id: true },
  })
  if (staleTopics.length > 0) {
    await tx.claimTopic.deleteMany({
      where: { claimId, topicId: { in: staleTopics.map(t => t.id) } },
    })
  }

  for (const topicId of desiredIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Upsert ────────────────────────────────────────────────────────────────────

interface UpsertInput {
  detail: BillDetailBill
  sourceUrl: string
  externalId: string
}

type UpsertResult = 'created' | 'updated'

async function upsertBillClaim(tx: TxClient, input: UpsertInput): Promise<UpsertResult> {
  const { detail, sourceUrl, externalId } = input
  const billType = detail.type.toLowerCase()
  const status = statusSlug(detail.latestAction?.text)
  const introducedDate = detail.introducedDate ?? detail.latestAction?.actionDate ?? null
  const emergedAt = introducedDate ? new Date(introducedDate + 'T00:00:00Z') : null
  const claimText = buildClaimText(detail)

  const metadata = {
    dataset: INGESTED_BY,
    congress: CURRENT_CONGRESS,
    billType,
    billNumber: detail.number,
    title: detail.title ?? null,
    sponsor: detail.sponsors?.[0]?.fullName ?? null,
    sponsorParty: detail.sponsors?.[0]?.party ?? null,
    sponsorState: detail.sponsors?.[0]?.state ?? null,
    latestActionText: detail.latestAction?.text ?? null,
    latestActionDate: detail.latestAction?.actionDate ?? null,
    policyArea: detail.policyArea?.name ?? null,
    introducedDate,
    statusSlug: status,
    lastTrackedAt: new Date().toISOString(),
  }

  const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })

  if (existing) {
    await tx.claim.update({
      where: { id: existing.id },
      data: {
        text: claimText,
        metadata,
        ...(emergedAt ? { claimEmergedAt: emergedAt, claimEmergedPrecision: 'DAY' } : {}),
      },
    })
    await syncTopicTags(tx, existing.id, billType, status)
    return 'updated'
  }

  const typeDisplay = BILL_TYPE_DISPLAY[billType] ?? billType.toUpperCase()
  const source = await tx.source.create({
    data: {
      name: `Congress.gov: ${typeDisplay} ${detail.number} (${ordinal(CURRENT_CONGRESS)} Congress)`,
      url: sourceUrl,
      publishedAt: emergedAt ?? undefined,
      methodologyType: 'primary',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: false,
      externalId: `${externalId}_source`,
    },
  })

  const claim = await tx.claim.create({
    data: {
      text: claimText,
      claimType: 'INSTITUTIONAL',
      currentStatus: 'DISPUTED',
      verificationStatus: 'PROVISIONAL',
      claimEmergedAt: emergedAt ?? undefined,
      claimEmergedPrecision: emergedAt ? 'DAY' : undefined,
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: false,
      externalId,
      metadata,
    },
  })

  const edge = await tx.edge.create({
    data: {
      sourceId: source.id,
      claimId: claim.id,
      type: 'FOR',
      evidenceType: 'PROCEDURAL',
      ingestedBy: INGESTED_BY,
      humanReviewed: false,
      autoApproved: false,
    },
  })

  await tx.edgeRevision.create({
    data: {
      edgeId: edge.id,
      priorScore: null,
      newScore: 70,
      reason: 'Congress.gov bill status tracker — provisional record of current bill state',
    },
  })

  await syncTopicTags(tx, claim.id, billType, status)
  return 'created'
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface ExistingMetadataShape { latestActionDate?: string | null }

function readPriorActionDate(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== 'object') return null
  const m = metadata as ExistingMetadataShape
  return typeof m.latestActionDate === 'string' ? m.latestActionDate : null
}

async function main(): Promise<void> {
  const { limit, offset, verbose } = parseArgs()
  console.log(`\n── Congress Bills Status Tracker ───────────────────────────────────`)
  console.log(`Congress: ${CURRENT_CONGRESS} | Limit: ${limit === 0 ? 'none (full sweep)' : limit} | Offset: ${offset}`)

  const startTime = Date.now()
  let processed = 0
  let created = 0
  let updated = 0
  let unchanged = 0
  let skippedType = 0
  let errors = 0
  let currentOffset = offset

  outer: while (limit === 0 || processed < limit) {
    let page: BillListResponse
    try {
      page = await fetchBillList(currentOffset)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  List fetch failed at offset=${currentOffset}: ${msg}`)
      break
    }

    const bills = page.bills ?? []
    if (bills.length === 0) break

    for (const bill of bills) {
      if (limit > 0 && processed >= limit) break outer

      const billType = bill.type?.toLowerCase() ?? ''
      if (!BILL_TYPES.includes(billType as BillType)) {
        skippedType++
        processed++
        continue
      }
      if (!bill.number) { errors++; processed++; continue }

      const externalId = `congress_bill_tracker_${CURRENT_CONGRESS}_${billType}_${bill.number}`
      const listActionDate = bill.latestAction?.actionDate ?? null

      try {
        const existing = await prisma.claim.findUnique({
          where: { externalId },
          select: { metadata: true },
        })
        const priorActionDate = existing ? readPriorActionDate(existing.metadata) : null

        if (existing && listActionDate && priorActionDate === listActionDate) {
          unchanged++
          processed++
          if (verbose) console.log(`  [unchanged] ${externalId}`)
          if (processed % 50 === 0) logProgress()
          continue
        }

        const detail = await fetchBillDetail(billType, bill.number)
        const sourceUrl = buildSourceUrl(billType, bill.number)

        const result = await prisma.$transaction(
          async (tx) => upsertBillClaim(tx as TxClient, { detail: detail.bill, sourceUrl, externalId }),
          { timeout: 30000 },
        )

        if (result === 'created') created++
        else updated++
        processed++

        if (verbose) console.log(`  [${result}] ${externalId} — ${bill.title?.slice(0, 70) ?? ''}`)
        if (processed % 50 === 0) logProgress()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`  Failed ${billType} ${bill.number}: ${msg}`)
        errors++
        processed++
      }
    }

    if (bills.length < PAGE_SIZE) break
    currentOffset += bills.length
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log(`\nPass complete in ${elapsed}s`)
  console.log(`  Processed: ${processed} | Created: ${created} | Updated: ${updated} | Unchanged: ${unchanged} | Skipped (type): ${skippedType} | Errors: ${errors}`)

  const dbClaims = await prisma.claim.count({ where: { ingestedBy: INGESTED_BY } })
  console.log(`  DB claims for ${INGESTED_BY}: ${dbClaims}`)

  function logProgress(): void {
    console.log(`  Progress: ${processed}/${limit} — created=${created} updated=${updated} unchanged=${unchanged} errors=${errors}`)
  }
}

main()
  .catch(async (err) => {
    console.error(err)
    await prisma.$disconnect()
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
