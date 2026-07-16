// Epistemic-receipt enrichment for OpenAlex claim cmplyp9ek00xnsaqkj6s2axig
// Slovic, P. "Perception of Risk." Science 236(4799):280–285, 17 Apr 1987.
// DOI 10.1126/science.3563507 · OpenAlex W2091069417
//
// Baseline row (fromAxis=null -> RECORDED @ 1987-04-17) already exists — NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> CONTESTED (Feb 2000): Sjöberg's "Factors in Risk Perception" (Risk Analysis
//   20(1):1–11) is the canonical methodological critique of the psychometric paradigm this paper
//   established, arguing the psychometric model explains only a small fraction of the variance in
//   perceived risk. No later meta-analysis cleanly adjudicates the dispute, so no SETTLED/REVERSED
//   transition is asserted.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-perception-of-risk.ts
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplyp9ek00xnsaqkj6s2axig'

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
    occurredAt: '2000-02-01',
    datePrecision: 'MONTH',
    reason:
      'Lennart Sjöberg\'s "Factors in Risk Perception" (Risk Analysis 20(1):1–11, Feb 2000) is the most prominent methodological critique of the psychometric paradigm Slovic established in this paper. Sjöberg showed that the psychometric model — factor scores such as dread and unknown-ness derived from aggregated group means — explains only a modest share (on the order of 20%) of the variance in individually perceived risk, and argued that reliance on averaged data inflated its apparent explanatory power. The critique opened a sustained scholarly dispute over the sufficiency of the psychometric approach, moving the finding from RECORDED to genuinely CONTESTED in the expert literature.',
    source: {
      externalId: 'src:sjoberg-factors-risk-perception-2000',
      name: 'Sjöberg L. "Factors in Risk Perception." Risk Analysis 2000;20(1):1–11.',
      url: 'https://doi.org/10.1111/0272-4332.00001',
      publishedAt: '2000-02-01',
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

    console.log(`upserted ${histId} (${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt})`)
  }

  await prisma.$disconnect()
}

main().catch(async e => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
