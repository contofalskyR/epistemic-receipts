// Enrichment: post-publication epistemic trajectory for
// Porter, "The Competitive Advantage of Nations" (1990) — reviewed in
// Journal of Marketing 55(4):118 (Oct 1991), DOI 10.2307/1251962
// OpenAlex W2013386523 · claim cmplysr7y02nbsaqk0lv22oa3
//
// Baseline row (fromAxis=null -> RECORDED at 1991-10-01) already exists; not duplicated here.
//
// Arc added:
//   RECORDED -> CONTESTED (2000-12) via Davies & Ellis (2000), Journal of Management
//   Studies 37(8):1189-1214, "Porter's competitive advantage of nations: time for the
//   final judgement?" A sustained, well-cited methodological critique synthesizing a
//   decade of papers, concluding that the central assertions of Porter's "diamond" model
//   have been refuted: sustained prosperity is achievable without becoming
//   "innovation-driven," strong home-base diamonds are absent for many successful
//   industries, and Porter conflated industry-level market-share success with
//   national-level productivity. This is a dated, citable contestation event — not mere
//   citation accumulation. The framework remains widely taught/cited, so the axis is
//   CONTESTED rather than REVERSED.
//
// No retraction (management-theory book), no vindicating meta-analysis, so no further arc.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-porter-1990-competitive-advantage-nations.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-porter-1990-competitive-advantage-nations.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplysr7y02nbsaqk0lv22oa3'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
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

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2000-12-01',
    datePrecision: 'MONTH',
    reason:
      'Davies and Ellis synthesized a decade of post-publication critiques in the Journal of Management Studies and concluded that the central assertions of Porter\'s "diamond" model of national competitive advantage have been refuted: sustained prosperity can be achieved without a nation becoming "innovation-driven," strong home-base "diamonds" are not in place for many internationally successful industries, and inward FDI does not signal low competitiveness. They identified a foundational elision in which industry-level market-share success was conflated with national-level productivity, plus misunderstandings of comparative advantage and flaws in method. This is a specific, dated, and heavily cited adjudicating critique that moved the diamond thesis into contested status in the expert literature; the framework nonetheless remains widely taught and cited, so the axis is CONTESTED rather than REVERSED.',
    source: {
      externalId: 'src:davies-ellis-2000-porter-final-judgement',
      name: 'Davies H, Ellis P (2000), "Porter\'s competitive advantage of nations: time for the final judgement?" Journal of Management Studies 37(8), 1189–1214',
      url: 'https://doi.org/10.1111/1467-6486.00221',
      publishedAt: '2000-12-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} (Porter 1990, The Competitive Advantage of Nations)`)
  console.log(DRY_RUN ? '[DRY RUN — no writes]\n' : '')

  for (const tr of TRANSITIONS) {
    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  would upsert source  ${tr.source.externalId}`)
      console.log(`  would upsert history ${slug}  (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
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
        ingestedBy: 'enrich:openalex_v1-porter-1990-competitive-advantage-nations',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${slug}  (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  console.log('\nDone.')
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
