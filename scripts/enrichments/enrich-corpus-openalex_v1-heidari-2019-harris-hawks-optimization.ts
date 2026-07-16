// Epistemic-receipt enrichment: post-publication trajectory for
// Heidari, Mirjalili, Faris, Aljarah, Mafarja & Chen (2019),
// "Harris hawks optimization: Algorithm and applications",
// Future Generation Computer Systems 97:849–872.
// DOI: 10.1016/j.future.2019.02.028. OpenAlex: W2919979744.
// Claim id: cmq2w59sp00s3sa8hq0uqo9qt.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2019-02-28) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2023-01-05, EXPERT_LITERATURE)
//     Kudela, "The Evolutionary Computation Methods No One Should Use"
//     (arXiv:2301.01984). This dated critique identifies Harris Hawks
//     Optimization by name as one of the methods carrying the center-bias
//     (zero-bias) operator — a structural defect that lets an algorithm
//     trivially "optimize" benchmark functions whose optima sit at the centre
//     of the feasible set, inflating reported performance. HHO appears in the
//     paper's Table 3 of center-biased methods, with the exact Heidari et al.
//     2019 reference, and the text states the defect was found for HHO in 2022.
//     This directly contests the paper's core performance/effectiveness claim,
//     leaving it contested rather than settled. No retraction or vindicating
//     meta-analysis exists, so no further transition is asserted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-heidari-2019-harris-hawks-optimization.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w59sp00s3sa8hq0uqo9qt'

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
    occurredAt: '2023-01-05',
    datePrecision: 'DAY',
    reason:
      'Kudela, "The Evolutionary Computation Methods No One Should Use" (arXiv:2301.01984, 5 Jan 2023), applies a formal procedure across 90 evolutionary-computation methods (1987–2022) to detect the center-bias (zero-bias) operator, which lets a method trivially optimize benchmark functions whose optima lie at the centre of the feasible set and thereby inflates reported performance. Harris Hawks Optimization is named directly as one of the ~47 flagged methods — it appears in the paper\'s Table 3 of center-biased algorithms with the exact Heidari et al. 2019 citation, and the text states the defect was identified for HHO in 2022. This specific, dated methodological critique disputes the paper\'s central performance/effectiveness claim, moving it from recorded to contested; no retraction or vindicating meta-analysis of the original algorithm exists.',
    source: {
      externalId: 'src:kudela-ec-methods-no-one-should-use-2023',
      name: 'Kudela J. The Evolutionary Computation Methods No One Should Use. arXiv:2301.01984, 2023.',
      url: 'https://doi.org/10.48550/arXiv.2301.01984',
      publishedAt: '2023-01-05',
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
