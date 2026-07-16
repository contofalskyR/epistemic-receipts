// Epistemic-receipt enrichment for OpenAlex claim cmplyndeu000hsaqkplqyjp6d
// Taylor, J.B. "Discretion versus policy rules in practice."
// Carnegie-Rochester Conference Series on Public Policy 39:195–214, Dec 1993.
// DOI 10.1016/0167-2231(93)90009-l · OpenAlex W2140898820
//
// Baseline row (fromAxis=null -> RECORDED @ 1993-12-01) already exists — NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> SETTLED (2017-07-07): The Federal Reserve's Monetary Policy Report to
//   Congress (submitted 7 Jul 2017) introduced a standing section, "Monetary Policy Rules
//   and Their Role in the Federal Reserve's Policy Process," which institutionalizes the
//   "Taylor (1993) rule" as the anchor benchmark against which the FOMC's federal funds
//   rate is evaluated (alongside the balanced-approach and adjusted-Taylor variants derived
//   from it). This is a field-consensus shift into formal institutional use — the central
//   bank whose behavior the paper described now cites it by name as a reference framework.
//   Community INSTITUTIONAL. No retraction, failed replication, or adjudicating meta-analysis
//   exists (this is a policy-rule contribution, not an empirical result), so no CONTESTED or
//   REVERSED transition is asserted.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-taylor-rule.ts
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplyndeu000hsaqkplqyjp6d'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus | null
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
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '2017-07-07',
    datePrecision: 'DAY',
    reason:
      'The Federal Reserve\'s Monetary Policy Report submitted to Congress on 7 July 2017 introduced a standing section, "Monetary Policy Rules and Their Role in the Federal Reserve\'s Policy Process," which establishes the "Taylor (1993) rule" — the rule defined in this paper — as the anchor benchmark against which the FOMC\'s federal funds rate is evaluated, alongside balanced-approach and adjusted-Taylor variants derived from it. The central bank whose conduct the paper described now formally names the rule as a reference framework in its statutory report to Congress, marking a field-consensus shift into institutional use. This settles the paper\'s core contribution as a canonical policy benchmark rather than overturning or contesting it.',
    source: {
      externalId: 'src:fed-mpr-2017-07-monetary-policy-rules',
      name: 'Board of Governors of the Federal Reserve System, Monetary Policy Report submitted to the Congress on July 7, 2017 — "Monetary Policy Rules and Their Role in the Federal Reserve\'s Policy Process."',
      url: 'https://www.federalreserve.gov/monetarypolicy/2017-07-mpr-part2.htm',
      publishedAt: '2017-07-07',
      methodologyType: 'derivative',
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
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId: CLAIM_ID,
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: tr.fromAxis ?? undefined,
        toAxis: tr.toAxis,
        community: tr.community,
        occurredAt: new Date(tr.occurredAt),
        datePrecision: tr.datePrecision,
        reason: tr.reason,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
