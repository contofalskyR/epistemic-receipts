// Enrichment: epistemic trajectory for H.Res. 1399 (119th Congress),
// "Directing the Committee on Ethics to preserve and publicly release records
// relating to monetary settlements involving acts of sexual harassment."
// Sponsored by Rep. Thomas Massie [R-KY-4].
//
// A simple House resolution (H.Res.) requires only agreement by the House —
// there is no Senate concurrence or presidential signature. Its terminal
// successful state is therefore reached the moment the House agrees to it.
//
// The claim already has its introduction (null -> RECORDED) first entry.
// This script adds the single downstream arc:
//   RECORDED -> SETTLED (2026-06-30): the House agreed to the resolution
//     without objection. The recorded action "Motion to reconsider laid on the
//     table / Agreed to without objection" is the standard House journal
//     language logged immediately after a simple resolution is adopted,
//     confirming final House action on the measure.
//
// Community: INSTITUTIONAL (congressional action).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hres-1399-ethics-harassment-records.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-hres-1399-ethics-harassment-records.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmr2etuu3000dsarjdwaurikq'

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
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2026-06-30',
    datePrecision: 'DAY',
    reason:
      'The House of Representatives agreed to H.Res. 1399 without objection on 30 June 2026. The final recorded action — "Motion to reconsider laid on the table Agreed to without objection" — is the standard House journal entry logged immediately after a simple resolution is adopted, foreclosing further reconsideration. Because a House simple resolution (H.Res.) requires neither Senate concurrence nor presidential signature, House agreement is its terminal successful state: the directive to the Committee on Ethics to preserve and publicly release records relating to monetary settlements involving sexual harassment took effect as an act of the House, settling the measure.',
    source: {
      externalId: 'src:congress-hres-1399-119-agreed-2026-06-30',
      name:
        'H.Res. 1399 — 119th Congress (2025–2026), All Actions. U.S. Congress via Congress.gov. Agreed to in House without objection, 30 June 2026.',
      url: 'https://www.congress.gov/bill/119th-congress/house-resolution/1399/all-actions',
      publishedAt: '2026-06-30',
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
