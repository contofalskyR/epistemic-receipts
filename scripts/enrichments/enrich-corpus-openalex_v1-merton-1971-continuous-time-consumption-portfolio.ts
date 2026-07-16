// Epistemic-receipt enrichment: post-publication trajectory for
// Merton, R.C. (1971), "Optimum consumption and portfolio rules in a
// continuous-time model", Journal of Economic Theory 3(4):373–413.
// DOI: 10.1016/0022-0531(71)90038-x
// OpenAlex: W2005158847. Claim id: cmq2w570l00qfsa8hfi3h9e0y.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1971-12-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (1973-04, EXPERT_LITERATURE)
//     Merton published a signed "Erratum" (Journal of Economic Theory 6(2):
//     213–214, April 1973, DOI 10.1016/0022-0531(73)90037-9) correcting genuine
//     errors in the original derivation — most notably in the treatment of the
//     HARA utility family and the associated boundary conditions. This is a
//     specific, dated, citable document establishing that the paper as first
//     published contained technical errors requiring correction. The corrected
//     model went on to become foundational, but the erratum is the concrete
//     post-publication adjudication of the paper's correctness.
//
// No retraction or expression of concern exists. A CONTESTED->SETTLED step via
// Merton's 1997 Nobel Memorial Prize was considered and DISCARDED: that prize
// was awarded "for a new method to determine the value of derivatives" (the
// Black–Scholes–Merton option-pricing work, a different paper), so attributing
// it to this 1971 consumption-portfolio paper would be a misidentification.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-merton-1971-continuous-time-consumption-portfolio.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w570l00qfsa8hfi3h9e0y'

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

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: {
    externalId: string
    name: string
    url: string
    publishedAt: string
    methodologyType: 'primary' | 'derivative' | 'opinion'
  }
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1973-04-01',
    datePrecision: 'MONTH',
    reason:
      'Merton published a signed "Erratum" (Journal of Economic Theory 6(2):213–214, April 1973) correcting genuine errors in the original 1971 derivation, most notably in the treatment of the HARA utility family and its boundary conditions. This is a specific, dated document from the author establishing that the paper as first published contained technical errors requiring correction. The corrected continuous-time model subsequently became foundational to financial economics, but the erratum is the concrete post-publication adjudication of the paper\'s correctness.',
    source: {
      externalId: 'src:merton-1973-erratum-jet-6-213',
      name: 'Merton RC. Erratum [to "Optimum consumption and portfolio rules in a continuous-time model"]. Journal of Economic Theory 1973;6(2):213–214.',
      url: 'https://doi.org/10.1016/0022-0531(73)90037-9',
      publishedAt: '1973-04-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
