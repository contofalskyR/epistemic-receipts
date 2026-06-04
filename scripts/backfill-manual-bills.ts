// One-off script: ingest specific bills via the tracker pipeline that the
// perpetual loop missed (e.g. bills whose official title differs from their
// short title, making them invisible to the API's full-text search).
//
// Run:
//   npx dotenv-cli -e .env.local -- npx tsx scripts/backfill-manual-bills.ts
//
// Add entries to MANUAL_BILLS to backfill additional bills.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const INGESTED_BY = 'congress_bills_tracker_v1'
const CONGRESS_BASE = 'https://api.congress.gov/v3'
const CURRENT_CONGRESS = 119
const API_KEY = process.env.CONGRESS_API_KEY
if (!API_KEY) { console.error('CONGRESS_API_KEY not set'); process.exit(1) }

// ── Bills to backfill ────────────────────────────────────────────────────────
// Add entries here: { type: 'hr'|'s'|'hjres'|etc, number: '4405' }
const MANUAL_BILLS = [
  { type: 'hr', number: '4405' }, // Epstein Files Transparency Act (Public Law 119-38)
]

// ── Helpers (mirrors ingest-congress-bills-tracker.ts) ────────────────────────

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
  'status-introduced', 'status-passed-house', 'status-passed-senate',
  'status-enacted', 'status-vetoed', 'status-failed', 'status-in-progress',
] as const

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]!)
}

function statusSlug(actionText: string | undefined): typeof STATUS_SLUGS[number] {
  const t = actionText ?? ''
  if (/became public law|signed by president/i.test(t)) return 'status-enacted'
  if (/vetoed/i.test(t)) return 'status-vetoed'
  if (/failed of passage|failed to pass|on passage.*failed|motion to suspend the rules.*failed|bill rejected|cloture motion rejected/i.test(t)) return 'status-failed'
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

interface BillSponsor { fullName?: string; firstName?: string; lastName?: string; party?: string; state?: string }

function buildSponsorString(s: BillSponsor | undefined): string {
  if (!s) return 'Unknown sponsor'
  const name = (s.fullName?.trim()) || `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || 'Unknown sponsor'
  const partyState = [s.party, s.state].filter(Boolean).join('-')
  return partyState ? `${name} (${partyState})` : name
}

interface BillDetailBill {
  congress: number; number: string; type: string; title?: string
  introducedDate?: string; latestAction?: { actionDate?: string; text?: string }
  sponsors?: BillSponsor[]; policyArea?: { name?: string }; updateDate?: string
}

async function fetchBillDetail(billType: string, number: string): Promise<BillDetailBill> {
  const url = `${CONGRESS_BASE}/bill/${CURRENT_CONGRESS}/${billType}/${number}?api_key=${API_KEY}&format=json`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Congress API ${res.status} at ${url}`)
  const data = await res.json() as { bill: BillDetailBill }
  return data.bill
}

type TxClient = Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>
const topicIdCache = new Map<string, string>()

async function ensureTopic(tx: TxClient, slug: string, name: string, domain: string, parentSlug?: string): Promise<string> {
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

async function syncTopicTags(tx: TxClient, claimId: string, billType: string, status: typeof STATUS_SLUGS[number]): Promise<void> {
  const typeDisplay = BILL_TYPE_DISPLAY[billType] ?? billType.toUpperCase()
  const tags = [
    { slug: 'legislation', name: 'Legislation' },
    { slug: 'us-federal', name: 'US Federal', parent: 'legislation' },
    { slug: `congress-${CURRENT_CONGRESS}`, name: `${ordinal(CURRENT_CONGRESS)} Congress`, parent: 'us-federal' },
    { slug: `bill-type-${billType}`, name: `Bill Type ${typeDisplay}`, parent: `congress-${CURRENT_CONGRESS}` },
    { slug: status, name: statusName(status), parent: `congress-${CURRENT_CONGRESS}` },
  ]

  const desiredIds = new Set<string>()
  for (const t of tags) {
    const id = await ensureTopic(tx, t.slug, t.name, 'government', t.parent)
    desiredIds.add(id)
  }

  // Drop stale status topics
  const staleStatusSlugs = STATUS_SLUGS.filter(s => s !== status)
  const staleTopics = await tx.topic.findMany({ where: { slug: { in: [...staleStatusSlugs] } }, select: { id: true } })
  if (staleTopics.length > 0) {
    await tx.claimTopic.deleteMany({ where: { claimId, topicId: { in: staleTopics.map(t => t.id) } } })
  }

  for (const topicId of desiredIds) {
    await tx.claimTopic.upsert({
      where: { claimId_topicId: { claimId, topicId } },
      update: {},
      create: { claimId, topicId },
    })
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  for (const { type, number } of MANUAL_BILLS) {
    console.log(`\nFetching ${BILL_TYPE_DISPLAY[type] ?? type} ${number}...`)
    const detail = await fetchBillDetail(type, number)

    const billType = detail.type.toLowerCase()
    const status = statusSlug(detail.latestAction?.text)
    const introducedDate = detail.introducedDate ?? detail.latestAction?.actionDate ?? null
    const emergedAt = introducedDate ? new Date(introducedDate + 'T00:00:00Z') : null
    const typeDisplay = BILL_TYPE_DISPLAY[billType] ?? billType.toUpperCase()
    const sponsor = buildSponsorString(detail.sponsors?.[0])
    const latestAction = detail.latestAction?.text ?? 'No action recorded'
    const latestActionDate = detail.latestAction?.actionDate ?? 'unknown date'
    const policyArea = detail.policyArea?.name ? ` Policy area: ${detail.policyArea.name}.` : ''
    const title = detail.title ?? '(no title)'
    const claimText = `${typeDisplay} ${detail.number} (${ordinal(CURRENT_CONGRESS)} Congress) — "${title}". Sponsored by ${sponsor}. Latest action: ${latestAction} (${latestActionDate}).${policyArea}`
    const sourceUrl = `https://www.congress.gov/bill/${ordinal(CURRENT_CONGRESS)}-congress/${BILL_TYPE_URL_PATH[billType] ?? billType}/${number}`
    const externalId = `${INGESTED_BY}_${CURRENT_CONGRESS}_${billType}_${number}`

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

    console.log(`  Title: ${title}`)
    console.log(`  Status: ${status} (${latestAction})`)
    console.log(`  ExternalId: ${externalId}`)

    await prisma.$transaction(async tx => {
      const existing = await tx.claim.findUnique({ where: { externalId }, select: { id: true } })

      if (existing) {
        console.log(`  → Updating existing claim ${existing.id}`)
        await tx.claim.update({ where: { id: existing.id }, data: { text: claimText, metadata, ...(emergedAt ? { claimEmergedAt: emergedAt, claimEmergedPrecision: 'DAY' } : {}) } })
        await syncTopicTags(tx, existing.id, billType, status)
      } else {
        console.log(`  → Creating new claim`)
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
        await tx.edge.create({
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
        await syncTopicTags(tx, claim.id, billType, status)
        console.log(`  → Created claim ${claim.id}`)
      }
    }, { timeout: 30000 })

    console.log(`  ✓ Done`)
  }

  await prisma.$disconnect()
  console.log('\nAll manual bills backfilled.')
}

main().catch(e => { console.error(e); process.exit(1) })
