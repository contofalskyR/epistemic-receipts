// Epistemic-receipt enrichment: post-publication trajectory for
// Kavraki, Švestka, Latombe & Overmars (1996), "Probabilistic roadmaps for
// path planning in high-dimensional configuration spaces",
// IEEE Transactions on Robotics and Automation 12(4):566–580.
// DOI: 10.1109/70.508439  OpenAlex: W2128990851
// Claim id: cmq2w55x800prsa8h8vxmee2p
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1996-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (1998-02, EXPERT_LITERATURE)
//     Kavraki, Kolountzakis & Latombe, "Analysis of probabilistic roadmaps for
//     path planning" (IEEE T-RA 14(1):166–171) gave the formal theoretical
//     adjudication of the method proposed here: under an ε-goodness geometric
//     assumption on the free configuration space, the probability that the PRM
//     roadmap fails to answer a query decays exponentially in the number of
//     sampled milestones. This established the probabilistic completeness and
//     performance guarantees of the two-phase learning/query roadmap method,
//     settling its soundness as the foundation of sampling-based motion planning.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kavraki-1996-probabilistic-roadmaps.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w55x800prsa8h8vxmee2p'

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
    occurredAt: '1998-02-01',
    datePrecision: 'MONTH',
    reason:
      'Kavraki, Kolountzakis & Latombe, "Analysis of probabilistic roadmaps for path planning" (IEEE Transactions on Robotics and Automation 14(1):166–171, Feb 1998) provided the formal theoretical adjudication of the two-phase roadmap method proposed in this claim. Under an ε-goodness assumption on the free configuration space, they proved that the probability the probabilistic roadmap fails to connect a valid query decays exponentially with the number of sampled milestones. This established the probabilistic completeness and performance guarantees of PRM, settling its soundness as the foundation of the sampling-based motion-planning paradigm that came to dominate the field.',
    source: {
      externalId: 'src:kavraki-prm-analysis-1998',
      name: 'Kavraki LE, Kolountzakis MN, Latombe J-C. Analysis of probabilistic roadmaps for path planning. IEEE Transactions on Robotics and Automation 1998;14(1):166–171.',
      url: 'https://doi.org/10.1109/70.660866',
      publishedAt: '1998-02-01',
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
