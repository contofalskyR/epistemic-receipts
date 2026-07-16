// Epistemic-receipt enrichment: post-publication trajectory for
// Caliendo & Kopeinig (2008), "Some Practical Guidance for the Implementation
// of Propensity Score Matching", Journal of Economic Surveys 22(1):31–72.
// DOI: 10.1111/j.1467-6419.2007.00527.x
// OpenAlex: W2159805452. Claim id: cmpm1fpos06nisafwrjdrohqb.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2008-01-31) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2019-05-07, EXPERT_LITERATURE)
//     King & Nielsen, "Why Propensity Scores Should Not Be Used for Matching"
//     (Political Analysis 27(4):435–454) — the canonical, heavily cited
//     methodological critique of propensity score matching, the exact method
//     this paper provides practical implementation guidance for. It argues that
//     PSM approximates complete rather than blocked randomization and thereby
//     tends to INCREASE imbalance, inefficiency, model dependence and bias
//     (the "PSM paradox"), directly disputing the premise that PSM is a sound
//     approach whose main open questions are matters of implementation detail.
//
// No retraction or expression of concern exists for the Caliendo & Kopeinig
// paper, and PSM remains widely used and debated; no adjudicating meta-analysis
// vindicates or overturns it, so no SETTLED/REVERSED step is asserted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-caliendo-kopeinig-2008-propensity-score-matching.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1fpos06nisafwrjdrohqb'

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
    occurredAt: '2019-05-07',
    datePrecision: 'DAY',
    reason:
      'Gary King and Richard Nielsen\'s "Why Propensity Scores Should Not Be Used for Matching" (Political Analysis 27(4):435–454, published online 7 May 2019) is the canonical methodological critique of propensity score matching — the precise method this paper provides practical implementation guidance for. It argues that PSM approximates complete rather than blocked randomization and therefore tends to increase imbalance, inefficiency, model dependence and bias (the "PSM paradox"). Widely cited across economics and political science, it directly contests the paper\'s framing that PSM is a sound approach whose remaining questions are matters of implementation.',
    source: {
      externalId: 'src:king-nielsen-psm-should-not-match-2019',
      name: 'King G, Nielsen R. Why Propensity Scores Should Not Be Used for Matching. Political Analysis 2019;27(4):435–454.',
      url: 'https://doi.org/10.1017/pan.2019.11',
      publishedAt: '2019-05-07',
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
