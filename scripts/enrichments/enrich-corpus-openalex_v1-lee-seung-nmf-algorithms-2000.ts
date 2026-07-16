// Epistemic-receipt enrichment: post-publication trajectory for
// Lee & Seung (2000), "Algorithms for Non-negative Matrix Factorization",
// Advances in Neural Information Processing Systems (NIPS) 13:556–562.
// OpenAlex: W2135029798 (DOI not available). Claim id: cmq2w5i3800wxsa8hf5mw8ye3.
// Citations (OpenAlex): 5474.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2000-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2007-11, EXPERT_LITERATURE)
//     Chih-Jen Lin, "On the Convergence of Multiplicative Update Algorithms for
//     Nonnegative Matrix Factorization" (IEEE Trans. Neural Networks 18(6):
//     1589–1596). Lin shows that the auxiliary-function argument invoked in this
//     claim proves only that the objective is monotonically non-increasing — it
//     does NOT establish convergence of the iterates to a stationary (KKT) point
//     of the NMF problem, and the updates are not even defined for all nonnegative
//     pairs. He proposes a modified update with provable convergence, directly
//     contesting the "monotonic convergence of both algorithms can be proven"
//     framing as insufficient.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lee-seung-nmf-algorithms-2000.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5i3800wxsa8hf5mw8ye3'

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
    occurredAt: '2007-11-01',
    datePrecision: 'MONTH',
    reason:
      'Chih-Jen Lin\'s "On the Convergence of Multiplicative Update Algorithms for Nonnegative Matrix Factorization" (IEEE Trans. Neural Networks 18(6):1589–1596, Nov 2007) is the canonical challenge to the convergence claim asserted here. Lin shows that the auxiliary-function argument establishes only that the objective is monotonically non-increasing, which does NOT guarantee that the iterates converge to a stationary (KKT) point of the NMF problem — and that the multiplicative updates are not even well defined for all nonnegative pairs. He proposes modified updates with a rigorous global-convergence proof, directly contesting the paper\'s framing that "the monotonic convergence of both algorithms can be proven using an auxiliary function."',
    source: {
      externalId: 'src:lin-nmf-mult-update-convergence-2007',
      name: 'Lin C-J. On the Convergence of Multiplicative Update Algorithms for Nonnegative Matrix Factorization. IEEE Transactions on Neural Networks 2007;18(6):1589–1596. DOI:10.1109/TNN.2007.895831.',
      url: 'https://www.csie.ntu.edu.tw/~cjlin/papers/multconv.pdf',
      publishedAt: '2007-11-01',
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
