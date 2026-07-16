// Enrichment: epistemic trajectory for Roger B. Myerson (1981),
// "Optimal Auction Design"
// (Mathematics of Operations Research 6(1):58–73, DOI 10.1287/moor.6.1.58,
// OpenAlex W2029050771).
//
// This is the foundational optimal-auction / mechanism-design paper: it solves
// the revenue-maximizing seller's problem under incomplete information, deriving
// optimal auctions for a wide class of design problems (the "Myerson auction",
// virtual valuations, and the revenue-equivalence machinery). It is a theoretical
// result, not an empirical finding — there is no retraction, expression of
// concern, failed replication, or methodological rebuttal (Retraction Watch,
// the INFORMS publisher page, and the citing literature show none).
//
// Post-publication event (verified):
//   RECORDED -> SETTLED (2007-10-15, INSTITUTIONAL) — On 15 October 2007 the
//   Royal Swedish Academy of Sciences awarded the Sveriges Riksbank Prize in
//   Economic Sciences in Memory of Alfred Nobel jointly to Leonid Hurwicz,
//   Eric S. Maskin and Roger B. Myerson "for having laid the foundations of
//   mechanism design theory." Myerson's optimal-auction analysis is the canonical
//   application of that theory, and the prize represents a durable institutional
//   consensus that this line of work is a settled foundation of the field rather
//   than a contested proposal. There was no intervening contest, so the arc goes
//   RECORDED -> SETTLED directly (field-consensus / institutional recognition).
//
// The claim already has its baseline null -> RECORDED (publication, 1981-02-01)
// first entry — do NOT duplicate it. This script adds one downstream arc.
//
// Community: INSTITUTIONAL.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-myerson-1981-optimal-auction-design.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-myerson-1981-optimal-auction-design.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w57ka00qrsa8hvri3evs5'

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

// Do NOT duplicate the existing null -> RECORDED (publication) first entry;
// start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2007-10-15',
    datePrecision: 'DAY',
    reason:
      'On 15 October 2007 the Royal Swedish Academy of Sciences awarded the Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel jointly to Leonid Hurwicz, Eric S. Maskin and Roger B. Myerson "for having laid the foundations of mechanism design theory." Myerson\'s "Optimal Auction Design" (1981) is the canonical application of mechanism design to the revenue-maximizing seller\'s problem, and the Academy\'s scientific background credits this optimal-mechanism work directly. The prize marks a durable institutional consensus that the result is a settled foundation of the field rather than a contested proposal — there was no intervening contest, so the trajectory moves RECORDED -> SETTLED.',
    source: {
      externalId: 'src:nobel-economics-2007-mechanism-design-press-release',
      name:
        'The Royal Swedish Academy of Sciences. The Sveriges Riksbank Prize in Economic Sciences in Memory of Alfred Nobel 2007 — Press release: awarded jointly to Leonid Hurwicz, Eric S. Maskin and Roger B. Myerson "for having laid the foundations of mechanism design theory." 15 October 2007.',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2007/press-release/',
      publishedAt: '2007-10-15',
      methodologyType: 'derivative',
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
        ingestedBy: 'enrich:openalex_v1',
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
