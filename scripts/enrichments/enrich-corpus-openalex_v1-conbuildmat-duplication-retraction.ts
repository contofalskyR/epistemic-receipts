// Enrichment: epistemic trajectory for a retracted response-surface-methodology (RSM)
// paper whose text/format was reproduced from an earlier paper.
//
// Claim 74bc158b-... is itself the Elsevier retraction notice (ingested via openalex_v1,
// claim emerged 2025-03-11). The initial status-history entry (fromAxis=null -> RECORDED)
// is already seeded. This script adds the substantive arc: the paper's scientific standing
// was REVERSED by editorial retraction on 2025-03-11, after an Editor-in-Chief investigation
// (triggered by a reader complaint) determined the format and textual content duplicated an
// earlier paper (doi:10.1016/j.conbuildmat.2024.138037). Both report response surface methodology.
//
// Only the RECORDED -> REVERSED transition is added. Both cited URLs are quoted verbatim in the
// retraction notice text, so they are high-confidence.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-conbuildmat-duplication-retraction.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = '74bc158b-73c9-496d-8dc2-16e4b44400d1'

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
    toAxis: 'REVERSED',
    community: 'INSTITUTIONAL',
    occurredAt: '2025-03-11',
    datePrecision: 'DAY',
    reason:
      'The paper was retracted at the request of the Editor-in-Chief. Following a reader complaint, an editorial investigation determined that the format and textual content had been reproduced from an earlier paper (doi:10.1016/j.conbuildmat.2024.138037); both report response surface methodology. The retraction, published per the Elsevier article-withdrawal policy, reverses the paper\'s standing in the scientific record from a recorded result to a withdrawn one.',
    source: {
      externalId: 'src:retraction-74bc158b-conbuildmat-duplication-2025',
      name: 'Elsevier retraction notice (Editor-in-Chief): format and textual content reproduced from an earlier paper reporting response surface methodology (Construction and Building Materials 2024, doi:10.1016/j.conbuildmat.2024.138037); retracted under the Elsevier article-withdrawal policy.',
      url: 'https://doi.org/10.1016/j.conbuildmat.2024.138037',
      publishedAt: '2025-03-11',
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
        ingestedBy: 'enrich:openalex_v1-conbuildmat-duplication-retraction',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
