// Enrichment: post-publication epistemic trajectory for King & Levine (1993),
// "Finance and Growth: Schumpeter Might Be Right," Quarterly Journal of
// Economics 108(3):717-737. DOI 10.2307/2118406. OpenAlex W2102897370.
//
// Baseline (fromAxis=null -> RECORDED at the 1993-08 publication date) already
// exists on the claim and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2015-05-08) — Arcand, Berkes & Panizza, "Too Much
//   Finance?" (Journal of Economic Growth 20(2):105-148) reports that the
//   finance-growth relationship is non-monotonic: financial depth stops
//   contributing to, and eventually harms, growth once private credit exceeds
//   ~100% of GDP. This directly contests King & Levine's implied monotonic
//   positive finance -> growth prediction.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-king-levine-finance-growth.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-king-levine-finance-growth.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm0521307kjsa869xtgd2oo'

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
    occurredAt: '2015-05-08',
    datePrecision: 'DAY',
    reason:
      'Arcand, Berkes & Panizza, "Too Much Finance?" (Journal of Economic Growth 20(2):105-148, 2015) found the finance-growth relationship to be non-monotonic rather than the positive-and-monotonic link implied by King & Levine: the marginal effect of financial depth on growth turns negative once private credit exceeds roughly 100% of GDP. Using both cross-country and panel evidence, the paper directly challenges the extrapolation that more financial development always predicts faster growth, opening a sustained "too much finance" debate that contests the original claim.',
    source: {
      externalId: 'src:arcand-too-much-finance-2015',
      name: 'Arcand, Berkes & Panizza, "Too Much Finance?", Journal of Economic Growth 20(2):105-148 (2015)',
      url: 'https://doi.org/10.1007/s10887-015-9115-2',
      publishedAt: '2015-05-08',
      methodologyType: 'primary',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found`)

  for (const tr of TRANSITIONS) {
    const histId = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`  [dry] ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
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
        ingestedBy: 'enrich:king-levine-finance-growth',
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
        claimId: claim.id,
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: claim.id, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: 'AGAINST' } })
    }

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${histId})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
