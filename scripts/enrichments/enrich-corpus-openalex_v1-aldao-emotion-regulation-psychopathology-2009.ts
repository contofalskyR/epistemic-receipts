// Epistemic-receipt enrichment: post-publication trajectory for
// Aldao, Nolen-Hoeksema & Schweizer (2010), "Emotion-regulation strategies
// across psychopathology: A meta-analytic review", Clinical Psychology Review
// 30(2):217–237. DOI: 10.1016/j.cpr.2009.11.004. OpenAlex: W2074503869.
// Claim id: cmplzpiq904p7sat0veylzmy6.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2009-11-21) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2016-10-12, EXPERT_LITERATURE)
//     Schäfer, Naumann, Holmes, Tuschen-Caffier & Samson (2017), "Emotion
//     Regulation Strategies in Depressive and Anxiety Symptoms in Youth: A
//     Meta-Analytic Review", Journal of Youth and Adolescence 46(2):261–276
//     (published online 12 Oct 2016). An independent research group applied
//     Aldao et al.'s exact six-strategy adaptive/maladaptive framework
//     (reappraisal, problem solving, acceptance vs. avoidance, suppression,
//     rumination) to a distinct youth population (68 effect sizes, 35 studies)
//     and reproduced the core pattern: adaptive strategies negatively and
//     maladaptive strategies positively associated with depression and anxiety,
//     with avoidance and rumination showing the strongest positive associations.
//     This independent replication of the transdiagnostic emotion-regulation
//     finding, with no intervening contest of the original meta-analysis,
//     settles the finding within the expert literature.
//
// No retraction, expression of concern, or failed replication was found
// (checked Retraction Watch, PubMed, publisher). The adaptive/maladaptive
// *labels* were later nuanced by context/flexibility work (e.g. Aldao 2013),
// but the underlying strategy–psychopathology associations were reproduced,
// so only the SETTLED transition is recorded.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aldao-emotion-regulation-psychopathology-2009.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplzpiq904p7sat0veylzmy6'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-10-12',
    datePrecision: 'DAY',
    reason:
      'Schäfer, Naumann, Holmes, Tuschen-Caffier & Samson, "Emotion Regulation Strategies in Depressive and Anxiety Symptoms in Youth: A Meta-Analytic Review" (Journal of Youth and Adolescence 2017;46(2):261–276; published online 12 Oct 2016), an independent group, applied Aldao et al.\'s exact six-strategy adaptive/maladaptive framework (reappraisal, problem solving, acceptance vs. avoidance, suppression, rumination) to a distinct youth population (68 effect sizes from 35 studies) and reproduced the core result: adaptive strategies were negatively and maladaptive strategies positively associated with depressive and anxiety symptoms, with avoidance and rumination showing the strongest positive associations. This independent replication of the transdiagnostic emotion-regulation finding, absent any retraction or contesting critique of the original meta-analysis, settles the finding within the expert literature.',
    source: {
      externalId: 'src:schafer-er-strategies-youth-meta-2017',
      name: 'Schäfer JÖ, Naumann E, Holmes EA, Tuschen-Caffier B, Samson AC. Emotion Regulation Strategies in Depressive and Anxiety Symptoms in Youth: A Meta-Analytic Review. Journal of Youth and Adolescence 2017;46(2):261–276.',
      url: 'https://doi.org/10.1007/s10964-016-0585-0',
      publishedAt: '2016-10-12',
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
