// Enrichment: epistemic trajectory for Dick, A.S. & Basu, K. (1994),
// "Customer Loyalty: Toward an Integrated Conceptual Framework,"
// Journal of the Academy of Marketing Science 22(2):99–113.
// DOI: 10.1177/0092070394222001 · OpenAlex: W2102467277
//
// Dick & Basu proposed the now-canonical *integrated* conceptualization of
// customer loyalty: loyalty is the strength of the relationship between an
// individual's relative attitude and repeat patronage (an attitudinal AND a
// behavioral component together), yielding four loyalty conditions (loyalty,
// latent loyalty, spurious loyalty, no loyalty). The paper is not empirical and
// has no retraction, expression of concern, or failed replication.
//
// The claim already carries its publication (null -> RECORDED, 1994-03-01) first
// entry. This script adds the single downstream adjudicating arc:
//   RECORDED -> SETTLED (2015): Watson, Beck, Henderson & Palmatier's
//     meta-analysis of 163 customer-loyalty studies (JAMS 2015) empirically
//     mapped the field's conceptual approaches and concluded that loyalty is
//     best conceptualized as a combination of attitudinal and behavioral
//     elements, and that measures combining the two are more predictive of
//     performance than single-dimension metrics — vindicating the integrated
//     attitudinal-behavioral framework Dick & Basu pioneered. There was no
//     prior contest, so this is a direct RECORDED -> SETTLED.
//
// Community: EXPERT_LITERATURE (peer-reviewed meta-analysis in the same journal).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dick-basu-1994-customer-loyalty-integrated-framework.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-dick-basu-1994-customer-loyalty-integrated-framework.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm10mze00y1sadnf1j7qg03'

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

// Do NOT duplicate the existing null -> RECORDED (publication, 1994-03-01) first
// entry; start from RECORDED.
const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-11-01',
    datePrecision: 'YEAR',
    reason:
      "Watson, Beck, Henderson & Palmatier's meta-analysis of 163 customer-loyalty studies (Journal of the Academy of Marketing Science, 2015) empirically mapped the field's varying conceptual and operational approaches and adjudicated the core question 'What is customer loyalty?'. It concluded that loyalty is best conceptualized as a combination of attitudinal and behavioral elements, and that measures combining both dimensions are more predictive of firm performance than single-dimension metrics. This meta-analytic consensus vindicates the integrated attitudinal-plus-behavioral framework Dick & Basu (1994) pioneered, settling the paper's central conceptual contribution.",
    source: {
      externalId: 'src:watson-2015-building-measuring-profiting-loyalty',
      name:
        'Watson GF IV, Beck JT, Henderson CM, Palmatier RW. Building, measuring, and profiting from customer loyalty. Journal of the Academy of Marketing Science 2015;43(6):790–825.',
      url: 'https://doi.org/10.1007/s11747-015-0439-4',
      publishedAt: '2015-11-01',
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
