// Enrichment: epistemic trajectory for S.Res. 765 (119th Congress),
// "A resolution expressing support for the designation of July 2026 as
// 'National Sarcoma Awareness Month'." Sponsored by Sen. Ron Johnson [R-WI].
//
// A simple Senate resolution (S.Res.) expresses the sentiment of the Senate
// alone. It requires neither House concurrence nor presidential signature, so
// its terminal successful state is reached the moment the Senate agrees to it.
//
// Per the Congressional Record, S.Res. 765 was submitted in the Senate,
// considered, and agreed to without amendment and with a preamble by Unanimous
// Consent — all on the same legislative day, 9 June 2026 (text: CR S2703;
// consideration: CR S2705).
//
// The claim already carries its introduction (null -> RECORDED) first entry
// (submitted 2026-06-09). This script adds the single downstream arc:
//   RECORDED -> SETTLED (2026-06-09): the Senate agreed to the resolution
//     without amendment and with a preamble by Unanimous Consent. A designation
//     resolution agreed to by UC is adopted in full; no further chamber action,
//     concurrence, or executive signature is possible or required, settling the
//     measure.
//
// Community: INSTITUTIONAL (congressional action).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-sres-765-national-sarcoma-awareness-month.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-congress_bills_tracker_v1-sres-765-national-sarcoma-awareness-month.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq8ihl13000psaez23lak59j'

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

// Do NOT duplicate the existing null -> RECORDED (submission/introduction) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2026-06-09',
    datePrecision: 'DAY',
    reason:
      'On 9 June 2026 the Senate submitted, considered, and agreed to S.Res. 765 without amendment and with a preamble by Unanimous Consent, formally expressing support for the designation of July 2026 as "National Sarcoma Awareness Month" (text: CR S2703; consideration: CR S2705). Because a simple Senate resolution expresses only the sentiment of the Senate and requires neither House concurrence nor presidential signature, agreement by the Senate is its terminal successful state. Adoption by Unanimous Consent means no Senator objected and the measure was adopted in full, foreclosing further chamber action and settling the measure.',
    source: {
      externalId: 'src:congress-sres-765-119-agreed-2026-06-09',
      name:
        'S.Res. 765 — 119th Congress (2025–2026), All Actions. U.S. Congress via Congress.gov. Resolution submitted, considered, and agreed to in Senate without amendment and with a preamble by Unanimous Consent, 9 June 2026.',
      url: 'https://www.congress.gov/bill/119th-congress/senate-resolution/765/all-actions',
      publishedAt: '2026-06-09',
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
