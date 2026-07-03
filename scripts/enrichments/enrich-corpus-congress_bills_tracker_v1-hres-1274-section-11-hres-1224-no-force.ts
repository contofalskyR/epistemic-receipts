// Enrichment: epistemic trajectory for H.Res. 1274 (119th Congress),
// "Providing that section 11 of House Resolution 1224 shall have no force or
// effect." Sponsored by Rep. Michelle Fischbach [R-MN-7].
//
// A simple House resolution (H.Res.) is an internal action of the House alone.
// This one is a housekeeping measure that nullifies section 11 of an earlier
// special rule (H.Res. 1224). It requires neither Senate concurrence nor
// presidential signature, so its terminal successful state is reached the
// moment the House agrees to it. The House agreed to the resolution on
// 2026-05-12, and the motion to reconsider was laid on the table (agreed to
// without objection) the following legislative day (2026-05-13), foreclosing
// reconsideration and finalizing the action.
//
// The claim already carries its introduction (null -> RECORDED) first entry.
// This script adds the single downstream arc:
//   RECORDED -> SETTLED (2026-05-12): the House agreed to the resolution,
//     giving section 11 of H.Res. 1224 no force or effect. Because a simple
//     House resolution acts on the House alone and needs no concurrence or
//     signature, House agreement is its terminal successful state; the
//     next-day motion to reconsider laid on the table removed any path to
//     reversal, settling the measure.
//
// Community: INSTITUTIONAL (congressional action).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hres-1274-section-11-hres-1224-no-force.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hres-1274-section-11-hres-1224-no-force.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpzp370i07cdsav2nd66hjfn'

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
    occurredAt: '2026-05-12',
    datePrecision: 'DAY',
    reason:
      'On 12 May 2026 the House agreed to H.Res. 1274, providing that section 11 of House Resolution 1224 "shall have no force or effect." A simple House resolution acts on the House alone: it requires neither Senate concurrence nor presidential signature, so agreement by the House is its terminal successful state. The motion to reconsider was laid on the table (agreed to without objection) on 13 May 2026, removing any path to reconsideration and finalizing the nullification, thereby settling the measure.',
    source: {
      externalId: 'src:congress-hres-1274-119-agreed-2026-05-12',
      name:
        'H.Res. 1274 — 119th Congress (2025–2026), All Actions. U.S. Congress via Congress.gov. Agreed to in House; motion to reconsider laid on the table, agreed to without objection (2026-05-13).',
      url: 'https://www.congress.gov/bill/119th-congress/house-resolution/1274/all-actions',
      publishedAt: '2026-05-13',
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
