// Epistemic-receipt enrichment for claim cmq2w4yg000l9sa8hdk81x110
// "Stochastic gradient boosting" — Jerome H. Friedman,
//   Computational Statistics & Data Analysis 38(4):367–378 (Feb 2002)
//   DOI: 10.1016/S0167-9473(01)00065-2 · OpenAlex W2070493638
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2002-02-01) already
// exists — do NOT duplicate it. This script adds the post-publication arc.
//
// Post-publication finding:
//   No retraction, expression of concern, failed replication, or methodological
//   reversal exists for this paper. It is a foundational statistical-methods
//   paper: stochastic subsampling of the training set at each boosting iteration
//   became standard practice and was codified in the subsequent expert
//   literature. The single verifiable adjudicating document is the peer-reviewed
//   review/tutorial by Natekin & Knoll (Frontiers in Neurorobotics, 2013), an
//   independent (non-author) synthesis that presents gradient boosting machines —
//   including Friedman's stochastic subsampling — as an established, standard
//   method. This supports one transition: RECORDED -> SETTLED.
//   (The method is likewise textbook-canonical in Hastie/Tibshirani/Friedman,
//   The Elements of Statistical Learning, 2nd ed., 2009, Ch.10; that text is
//   noted in the reason but not used as the anchor source because Friedman is a
//   co-author and independence is weaker.)
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-friedman-2002-stochastic-gradient-boosting.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-friedman-2002-stochastic-gradient-boosting.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

const CLAIM_ID = 'cmq2w4yg000l9sa8hdk81x110'

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
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2013-12-04',
    datePrecision: 'DAY',
    reason:
      'Natekin & Knoll, "Gradient boosting machines, a tutorial" (Frontiers in Neurorobotics 7:21, 4 Dec 2013), is an independent peer-reviewed review that presents gradient boosting machines — including Friedman\'s stochastic subsampling of the training set at each iteration — as an established, standard machine-learning method with settled theory and practice. The technique had by then also become textbook-canonical (Hastie, Tibshirani & Friedman, The Elements of Statistical Learning, 2nd ed., 2009, Ch. 10). No retraction, failed replication, or methodological reversal exists; the finding is settled in expert literature.',
    source: {
      externalId: 'src:natekin-knoll-2013-gbm-tutorial',
      name: 'Natekin A, Knoll A. Gradient boosting machines, a tutorial. Frontiers in Neurorobotics 2013;7:21.',
      url: 'https://doi.org/10.3389/fnbot.2013.00021',
      publishedAt: '2013-12-04',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] source upsert: ${tr.source.externalId}`)
      console.log(`[dry-run] history upsert: ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
      continue
    }

    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-friedman-2002-stochastic-gradient-boosting',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

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

    console.log(`✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
