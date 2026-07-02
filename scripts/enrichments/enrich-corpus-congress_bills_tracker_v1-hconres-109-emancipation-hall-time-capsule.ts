// Enrichment: epistemic trajectory for H.Con.Res. 109 (119th Congress),
// "Allowing Emancipation Hall to be used for a ceremony to dedicate the
// Semiquincentennial Congressional Time Capsule on Wednesday, June 24, 2026."
// Sponsored by Rep. Maria Elvira Salazar [R-FL-27].
//
// A concurrent resolution (H.Con.Res.) expresses a decision of both chambers
// acting together. It requires agreement by BOTH the House and the Senate but
// requires NO presidential signature, so its terminal successful state is
// reached once both chambers have concurred. This measure — a routine
// authorization for use of a Capitol space (Emancipation Hall) for a scheduled
// ceremony — was agreed to in the House and then in the Senate, with the final
// recorded action being the message on Senate action sent to the House on
// 2026-06-18, completing both-chamber concurrence.
//
// The claim already carries its introduction (null -> RECORDED) first entry
// (introduced/considered 2026-06-09). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2026-06-18): both chambers agreed to the concurrent
//     resolution. Because a concurrent resolution requires House and Senate
//     concurrence but no presidential signature, the completion of Senate
//     agreement — communicated to the House on 2026-06-18 as the latest recorded
//     action — is the terminal successful state, foreclosing further legislative
//     action and settling the measure. (The authorized ceremony was scheduled
//     for 2026-06-24.)
//
// Community: INSTITUTIONAL (congressional action).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hconres-109-emancipation-hall-time-capsule.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hconres-109-emancipation-hall-time-capsule.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq8iik1p008dsaezbwswr5u3'

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

// Do NOT duplicate the existing null -> RECORDED (introduction) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2026-06-18',
    datePrecision: 'DAY',
    reason:
      'H.Con.Res. 109 authorized the use of Emancipation Hall in the U.S. Capitol Visitor Center for a ceremony to dedicate the Semiquincentennial Congressional Time Capsule on Wednesday, June 24, 2026. As a concurrent resolution it required agreement by both the House of Representatives and the Senate but no presidential signature. After agreement in the House, the Senate concurred, and the final recorded action — the message on Senate action sent to the House — occurred on 18 June 2026, completing both-chamber concurrence. Because a concurrent resolution reaches its terminal successful state once both chambers have agreed and no executive action is required, completion of Senate agreement settled the measure, foreclosing further legislative action ahead of the authorized 24 June 2026 ceremony.',
    source: {
      externalId: 'src:congress-hconres-109-119-agreed-2026-06-18',
      name:
        'H.Con.Res. 109 — 119th Congress (2025–2026), All Actions. U.S. Congress via Congress.gov. Agreed to in the House and the Senate; message on Senate action sent to the House, 18 June 2026.',
      url: 'https://www.congress.gov/bill/119th-congress/house-concurrent-resolution/109/all-actions',
      publishedAt: '2026-06-18',
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
