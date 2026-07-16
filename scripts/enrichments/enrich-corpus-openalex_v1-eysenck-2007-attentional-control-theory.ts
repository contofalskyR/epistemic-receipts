// Epistemic-receipt enrichment for claim cmplxmqg60107sa7f093kc37w
// Eysenck, Derakshan, Santos & Calvo (2007), "Anxiety and cognitive performance:
// Attentional control theory," Emotion 7(2):336–353. DOI 10.1037/1528-3542.7.2.336.
// OpenAlex W2143114368. Verified via Crossref: no retraction / update-to / updated-by.
//
// Baseline row (fromAxis=null -> RECORDED at 2007 publication) already exists; not duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2016-08, EXPERT_LITERATURE)
//   Moran, T. P. (2016). "Anxiety and working memory capacity: A meta-analysis and
//   narrative review." Psychological Bulletin, 142(8), 831–864. DOI 10.1037/bul0000051.
//   A meta-analysis of 177 samples (N = 22,061) found anxiety reliably related to poorer
//   working-memory-capacity performance (g = -.334, p < 10^-29), adjudicating and largely
//   vindicating ACT's central prediction that anxiety impairs the executive/goal-directed
//   control of working memory.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-eysenck-2007-attentional-control-theory.ts
// Dry-run: append --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmplxmqg60107sa7f093kc37w'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2016-08-01',
    datePrecision: 'MONTH',
    reason:
      "Moran's meta-analysis and narrative review in Psychological Bulletin (142(8):831–864) pooled 177 samples (N = 22,061) and found self-reported anxiety reliably related to poorer working-memory-capacity performance (g = -.334, p < 10^-29). The effect was concentrated where tasks taxed executive control, directly adjudicating and largely vindicating attentional control theory's core claim that anxiety impairs the goal-directed/executive control of processing. This established broad expert-literature support for the finding beyond its original theoretical statement.",
    source: {
      externalId: 'src:moran-2016-anxiety-working-memory-meta-analysis',
      name: 'Moran TP. Anxiety and working memory capacity: A meta-analysis and narrative review. Psychological Bulletin 2016;142(8):831–864.',
      url: 'https://doi.org/10.1037/bul0000051',
      publishedAt: '2016-08-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${tr.source.externalId}`)
      console.log(`[dry-run] would upsert history ${histId}: ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt}`)
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
        ingestedBy: 'enrich:openalex_v1-eysenck-2007-act',
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
