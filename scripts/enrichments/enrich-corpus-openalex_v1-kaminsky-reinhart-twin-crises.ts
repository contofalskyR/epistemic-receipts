// Epistemic-receipt enrichment for Kaminsky & Reinhart (1999),
// "The Twin Crises: The Causes of Banking and Balance-of-Payments Problems,"
// American Economic Review 89(3):473–500. DOI 10.1257/aer.89.3.473
// OpenAlex W2112559425. Claim id cmpm0wx6o0kivsa86acftiwod.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 1999-06
// publication date) already exists and is NOT duplicated here.
//
// Post-publication arc added: RECORDED -> SETTLED.
// The paper is foundational both for the "twin crises" causal regularity and for
// its signals / leading-indicator early-warning framework. Frankel & Saravelos
// (Journal of International Economics, 2012) systematically assessed that
// early-warning-indicators literature against the 2008–09 global financial crisis
// as a large out-of-sample test and found the paper's core indicators
// (reserves, real-exchange-rate overvaluation) among the most reliable predictors,
// reaffirming the framework as an enduring tool in the crisis-prediction literature.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kaminsky-reinhart-twin-crises.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kaminsky-reinhart-twin-crises.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const claimId = 'cmpm0wx6o0kivsa86acftiwod'

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
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-07-01',
    datePrecision: 'YEAR',
    reason:
      'Frankel and Saravelos (Journal of International Economics, 2012) systematically assessed the early-warning-indicators literature that Kaminsky & Reinhart\'s signals approach helped found, using the 2008–09 global financial crisis as a large cross-country out-of-sample test. They found that the level of foreign-exchange reserves and past real-exchange-rate overvaluation — two of the central indicators in the twin-crises early-warning framework — were among the most statistically reliable predictors of which countries were hit hardest, reaffirming the paper\'s leading-indicator methodology after mid-2000s doubts about crisis predictability. This established the signals-based approach as an enduring, validated tool in the crisis-prediction literature.',
    source: {
      externalId: 'src:frankel-saravelos-leading-indicators-2012',
      name: 'Frankel JA, Saravelos G. Can leading indicators assess country vulnerability? Evidence from the 2008–09 global financial crisis. Journal of International Economics 2012;87(2):216–231.',
      url: 'https://doi.org/10.1016/j.jinteco.2011.12.009',
      publishedAt: '2012-07-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  for (const tr of TRANSITIONS) {
    const slug = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`

    if (DRY_RUN) {
      console.log(`[dry-run] would upsert source ${tr.source.externalId}`)
      console.log(`[dry-run] would upsert claimStatusHistory ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
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
        claimId,
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

    console.log(`✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
