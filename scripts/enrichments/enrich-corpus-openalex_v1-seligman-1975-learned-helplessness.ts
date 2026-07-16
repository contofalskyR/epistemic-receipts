// Epistemic-receipt enrichment: post-publication trajectory for
// Seligman, M.E.P. (1975), "Helplessness: On Depression, Development, and Death",
// W.H. Freeman. OpenAlex: W1561644443. Claim id: cmpm2vqsm0w8psadn53n7dckh.
// (No DOI assigned; identity confirmed via OpenAlex title/author/year.)
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1975-01-01) already exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (1978-02, EXPERT_LITERATURE)
//     Abramson, Seligman & Teasdale, "Learned helplessness in humans: Critique
//     and reformulation" (Journal of Abnormal Psychology 87(1):49–74). The
//     original authors themselves judge the 1975 animal-derived learned-
//     helplessness model inadequate as a theory of human depression and
//     reformulate it around causal attributions (attributional style). A
//     dated, citable critique that puts the original formulation in contest.
//
//   CONTESTED -> REVERSED (2016-07, EXPERT_LITERATURE)
//     Maier & Seligman, "Learned helplessness at fifty: Insights from
//     neuroscience" (Psychological Review 123(4):349–367). Reviewing five
//     decades of neuroscience, the authors conclude the original interpretation
//     was backwards: passivity and heightened anxiety are the DEFAULT, unlearned
//     reaction to prolonged aversive stimulation, mediated by the dorsal raphe
//     nucleus; what is actually learned/detected is the presence of CONTROL, via
//     the ventromedial prefrontal cortex. "Helplessness" is not learned — control
//     is. The core mechanistic claim of the 1975 theory is explicitly overturned
//     by the original author, while the behavioral phenomenon is preserved.
//
// No retraction or expression of concern exists.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-seligman-1975-learned-helplessness.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm2vqsm0w8psadn53n7dckh'

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
    occurredAt: '1978-02-01',
    datePrecision: 'MONTH',
    reason:
      'Abramson, Seligman & Teasdale, "Learned helplessness in humans: Critique and reformulation" (Journal of Abnormal Psychology 87(1):49–74), argue that the original animal-derived learned-helplessness model of 1975 is inadequate as an account of human depression and requires reformulation around causal attributions (the attributional/explanatory-style model). Coming from the original theorist and collaborators, this dated critique places the book\'s core formulation in active contest rather than settled acceptance.',
    source: {
      externalId: 'src:abramson-seligman-teasdale-lh-critique-1978',
      name: 'Abramson LY, Seligman MEP, Teasdale JD. Learned helplessness in humans: Critique and reformulation. Journal of Abnormal Psychology 1978;87(1):49–74.',
      url: 'https://doi.org/10.1037/0021-843X.87.1.49',
      publishedAt: '1978-02-01',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'REVERSED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-07-01',
    datePrecision: 'MONTH',
    reason:
      'Maier & Seligman, "Learned helplessness at fifty: Insights from neuroscience" (Psychological Review 123(4):349–367), review five decades of neuroscience and explicitly overturn the original mechanistic interpretation: passivity and heightened anxiety are the DEFAULT, unlearned response to prolonged aversive events (mediated by the dorsal raphe nucleus), and what the animal actually learns/detects is the presence of CONTROL (mediated by the ventromedial prefrontal cortex). In their words, helplessness is not learned — control is. The 1975 theory\'s central causal claim is reversed by the original author while the behavioral phenomenon is retained.',
    source: {
      externalId: 'src:maier-seligman-lh-at-fifty-2016',
      name: 'Maier SF, Seligman MEP. Learned helplessness at fifty: Insights from neuroscience. Psychological Review 2016;123(4):349–367.',
      url: 'https://doi.org/10.1037/rev0000033',
      publishedAt: '2016-07-01',
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
