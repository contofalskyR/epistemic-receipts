// Enrichment: post-publication epistemic trajectory for Zitzler, Deb & Thiele (2000),
// "Comparison of Multiobjective Evolutionary Algorithms: Empirical Results,"
// Evolutionary Computation 8(2):173–195. This paper introduced the six ZDT test
// functions still used as a de facto benchmark suite for MOEAs.
// DOI 10.1162/106365600568202 · OpenAlex W2125899728 · Claim cmq2w5egm00uxsa8h67n3ouhq
//
// The baseline row (fromAxis=null -> RECORDED at 2000-06-01) already exists and is
// NOT recreated here. No retraction or expression of concern exists. This adds one
// verified post-publication transition:
//
//   1) RECORDED -> CONTESTED (2006-10) — Huband, Hingston, Barone & While, "A review of
//      multiobjective test problems and a scalable test problem toolkit" (IEEE TEVC
//      10(5):477–506). A major methodological critique that directly cites the ZDT paper
//      and shows the ZDT suite's stated goal — isolating problem features (multimodality,
//      deception, non-separability) to predict when a technique is suited — is only
//      partially met: every ZDT problem is bi-objective, its sole deceptive problem is
//      binary-encoded, and none is non-separable. The authors propose the WFG toolkit as
//      a corrective, contesting the ZDT suite's completeness as a feature-isolating
//      benchmark.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-zitzler-deb-thiele-moea-test-functions.ts
// Dry-run: append --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmq2w5egm00uxsa8h67n3ouhq'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
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
    occurredAt: '2006-10-01',
    datePrecision: 'MONTH',
    reason:
      'Huband, Hingston, Barone & While published a major review of multiobjective test problems that directly cites Zitzler, Deb & Thiele (2000) and critiques the ZDT suite it introduced. They show the paper\'s central promise — isolating individual difficulty-causing features (multimodality, deception, non-separability) so one can predict the problems a technique suits — is only partially delivered: every ZDT problem is bi-objective, its only deceptive problem is binary-encoded rather than real-valued, and none of the problems is non-separable. Proposing the scalable WFG toolkit as a corrective benchmark, they contest the completeness of the ZDT functions as a feature-isolating test suite.',
    source: {
      externalId: 'src:huband-2006-review-moea-test-problems',
      name: 'Huband S, Hingston P, Barone L, While L. A review of multiobjective test problems and a scalable test problem toolkit. IEEE Transactions on Evolutionary Computation 2006;10(5):477–506.',
      url: 'https://doi.org/10.1109/TEVC.2005.861417',
      publishedAt: '2006-10-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} transitions${DRY_RUN ? ' [DRY RUN]' : ''}...`)

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    console.log(`  • ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${slug})`)
    if (DRY_RUN) continue

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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
