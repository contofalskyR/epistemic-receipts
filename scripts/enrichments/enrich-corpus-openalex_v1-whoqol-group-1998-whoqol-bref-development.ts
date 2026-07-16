// Enrichment: post-publication epistemic trajectory for the WHOQOL-BREF development paper.
//
// Claim: cmply53f200i3saihe5c5fbo2
// Paper: The WHOQOL Group. "Development of the World Health Organization WHOQOL-BREF
//        Quality of Life Assessment." Psychological Medicine 1998;28(3):551-558.
//        DOI 10.1017/s0033291798006667 · OpenAlex W2429180991
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at 1998-05) already exists.
// This script adds the single verified adjudicating event AFTER publication:
//   RECORDED -> SETTLED — the WHOQOL Group's own international field trial
//   (Skevington, Lotfy & O'Connell, Quality of Life Research, March 2004, 13:299-310)
//   validated the WHOQOL-BREF's psychometric properties across a large multi-country
//   sample, confirming domain structure, internal consistency and discriminant validity.
//
// No retraction or expression of concern exists (isRetracted=false). No failed replication.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-whoqol-group-1998-whoqol-bref-development.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmply53f200i3saihe5c5fbo2'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Arc {
  fromAxis: FactStatus | null
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

const ARCS: Arc[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2004-03-01',
    datePrecision: 'MONTH',
    reason:
      'The WHOQOL Group\'s international field trial (Skevington, Lotfy & O\'Connell, Quality of Life Research, March 2004, 13:299–310) validated the WHOQOL-BREF\'s psychometric properties across a large multi-country adult sample, confirming its four-domain structure, good internal consistency, and discriminant validity. This report from the instrument\'s own developers settled the WHOQOL-BREF as a validated abbreviated quality-of-life measure in the expert literature.',
    source: {
      externalId: 'src:whoqol-bref-skevington-2004-field-trial',
      name: 'Skevington SM, Lotfy M, O\'Connell KA. The World Health Organization\'s WHOQOL-BREF quality of life assessment: psychometric properties and results of the international field trial. A report from the WHOQOL Group. Quality of Life Research 2004;13(2):299–310.',
      url: 'https://doi.org/10.1023/B:QURE.0000018486.91360.00',
      publishedAt: '2004-03-01',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  for (const arc of ARCS) {
    const source = await prisma.source.upsert({
      where: { externalId: arc.source.externalId },
      create: {
        externalId: arc.source.externalId,
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
        methodologyType: arc.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: arc.source.name,
        url: arc.source.url,
        publishedAt: new Date(arc.source.publishedAt),
      },
    })

    const histId = `${claimId}-${arc.toAxis}-${arc.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: histId },
      create: {
        id: histId,
        claimId,
        fromAxis: arc.fromAxis ?? undefined,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
      update: {
        fromAxis: arc.fromAxis ?? undefined,
        toAxis: arc.toAxis,
        community: arc.community,
        occurredAt: new Date(arc.occurredAt),
        datePrecision: arc.datePrecision,
        reason: arc.reason,
        sourceId: source.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({ where: { claimId, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
    }

    console.log(`  ✓ ${histId}`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
