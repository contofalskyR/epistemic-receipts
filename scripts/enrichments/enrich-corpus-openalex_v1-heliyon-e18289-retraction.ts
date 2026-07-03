// Enrichment: epistemic trajectory for the Heliyon retraction notice claim.
//
// Claim 851745f1-6dbf-42f7-bbf9-9b5e5d9b91ea is the retraction notice for the
// article DOI 10.1016/j.heliyon.2023.e18289 (Heliyon, Elsevier, 2023). The
// notice itself was published 2024-12-18.
//
// The corpus already holds the first ClaimStatusHistory entry (null -> RECORDED,
// the article's original entry into the peer-reviewed literature). This script
// adds only the downstream reversal: RECORDED -> REVERSED, marked by the
// publication of the retraction notice on 2024-12-18.
//
// Only facts confirmed by the DOI record itself are asserted here — the article
// is a Heliyon (Elsevier) 2023 publication and it was formally retracted on
// 2024-12-18. The specific editorial reason for retraction is not asserted.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-heliyon-e18289-retraction.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = '851745f1-6dbf-42f7-bbf9-9b5e5d9b91ea'

interface Transition {
  fromAxis: 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
  toAxis: 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
  community: 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
  occurredAt: string
  datePrecision: 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'
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
    community: 'EXPERT_LITERATURE',
    occurredAt: '2024-12-18',
    datePrecision: 'DAY',
    reason:
      'The article published in the journal Heliyon (Elsevier) under DOI 10.1016/j.heliyon.2023.e18289 was formally retracted. The retraction notice — the claim under this trajectory — was published on 18 December 2024, withdrawing the article from the peer-reviewed record and reversing its standing as a recorded finding. A retraction is the scholarly literature\'s formal instrument for removing a published result from the accepted record.',
    source: {
      externalId: 'src:heliyon-e18289-retraction-2024',
      name: 'Retraction notice for "10.1016/j.heliyon.2023.e18289," Heliyon (Elsevier), published 18 December 2024.',
      url: 'https://doi.org/10.1016/j.heliyon.2023.e18289',
      publishedAt: '2024-12-18',
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
        ingestedBy: 'enrich:openalex_v1-heliyon-e18289-retraction',
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

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId: CLAIM_ID, sourceId: source.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}`)
  }

  await prisma.$disconnect()
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
