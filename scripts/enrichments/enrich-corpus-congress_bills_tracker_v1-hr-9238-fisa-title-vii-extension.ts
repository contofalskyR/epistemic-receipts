// Enrichment: epistemic trajectory for H.R. 9238 (119th Congress),
// "To amend the FISA Amendments Act of 2008 to extend the authorities of
// title VII of the Foreign Intelligence Surveillance Act of 1978, and for
// other purposes." Sponsored by Rep. Eric A. "Rick" Crawford [R-AR-1].
//
// The bill was brought to the House floor under suspension of the rules — a
// procedure requiring a two-thirds supermajority to pass. On the motion to
// suspend the rules and pass the bill, the House FAILED to reach two-thirds:
// 198 Yeas to 218 Nays (Roll no. 221). A failed suspension motion means the
// measure did not advance in that form; the bill dies as brought to the floor.
// The correct terminal epistemic state is therefore ABANDONED — the House
// declined to pass it, and there was no enactment, Senate action, or
// presidential signature.
//
// The claim already has its introduction/referral (null -> RECORDED) first
// entry. This script adds the single downstream arc:
//   RECORDED -> ABANDONED (2026-06-11): failed suspension vote, 198-218.
//
// Community: INSTITUTIONAL (congressional floor action).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hr-9238-fisa-title-vii-extension.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hr-9238-fisa-title-vii-extension.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq9yic0l0001sa5k9vxlw2du'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

// Do NOT duplicate the existing null -> RECORDED (introduction/referral) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'ABANDONED',
    community: 'INSTITUTIONAL',
    occurredAt: '2026-06-11',
    datePrecision: 'DAY',
    reason:
      'On 11 June 2026 the House considered H.R. 9238 under suspension of the rules — a procedure requiring a two-thirds majority to pass. On the motion to suspend the rules and pass the bill, the House FAILED to reach two-thirds by the Yeas and Nays: 198 Yeas to 218 Nays (Roll no. 221). Because the supermajority threshold was not met, the bill did not pass the House in that form and advanced no further — there was no Senate action or presidential signature. The measure to extend the authorities of title VII of the Foreign Intelligence Surveillance Act therefore reached a terminal ABANDONED state: the House declined to enact it as brought to the floor.',
    source: {
      externalId: 'src:congress-hr-9238-119-failed-suspension-2026-06-11',
      name:
        'H.R. 9238 — 119th Congress (2025–2026), All Actions. U.S. Congress via Congress.gov. Motion to suspend the rules and pass the bill Failed by the Yeas and Nays (2/3 required): 198 - 218 (Roll no. 221), 11 June 2026.',
      url: 'https://www.congress.gov/bill/119th-congress/house-bill/9238/all-actions',
      publishedAt: '2026-06-11',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  console.log(
    `Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transition(s)${
      DRY_RUN ? ' (DRY RUN)' : ''
    }`,
  )

  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — aborting (will not create a new Claim).`)
  }

  for (const t of TRANSITIONS) {
    const s = t.source
    const historyId = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.slice(0, 10)}`

    console.log(
      `  ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${t.occurredAt} (${s.externalId})`,
    )
    if (DRY_RUN) continue

    const source = await prisma.source.upsert({
      where: { externalId: s.externalId },
      create: {
        externalId: s.externalId,
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
        ingestedBy: 'enrich:congress_bills_tracker_v1',
        autoApproved: true,
      },
      update: {
        name: s.name,
        url: s.url,
        publishedAt: new Date(s.publishedAt),
        methodologyType: s.methodologyType,
      },
    })

    await prisma.claimStatusHistory.upsert({
      where: { id: historyId },
      create: {
        id: historyId,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: new Date(t.occurredAt),
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })
  }

  console.log('Done.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
