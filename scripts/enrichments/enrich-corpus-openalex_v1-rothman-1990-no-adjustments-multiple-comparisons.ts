// Enrichment: post-publication epistemic trajectory for
// Rothman KJ. "No Adjustments Are Needed for Multiple Comparisons." Epidemiology 1990;1(1):43–46.
// DOI: 10.1097/00001648-199001000-00010 · OpenAlex: W1984486655
//
// Claim (already seeded with baseline null->RECORDED at 1990 publication):
//   cmpm14b7k0ntasa86crh40xrm
//
// Post-publication event added here:
//   RECORDED -> CONTESTED (July 1991) — Greenland & Robins publish a substantive
//   methodological rebuttal in the same journal, directly disputing Rothman's
//   "no adjustments needed" thesis and showing empirical-Bayes adjustments are
//   sometimes useful. Rothman's paper triggered a 1991 Epidemiology symposium;
//   the debate remains unresolved to this day, so the current axis is CONTESTED.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rothman-1990-no-adjustments-multiple-comparisons.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rothman-1990-no-adjustments-multiple-comparisons.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmpm14b7k0ntasa86crh40xrm'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '1991-07-01',
    datePrecision: 'MONTH',
    reason:
      'In July 1991 Sander Greenland and James M. Robins published "Empirical-Bayes Adjustments for Multiple Comparisons Are Sometimes Useful" in Epidemiology (2(4):244–251), a direct methodological rebuttal to Rothman\'s "no adjustments" thesis. They argued that when analysis aims at decisions rather than pure reporting, empirical-Bayes / hierarchical shrinkage adjustments can outperform Rothman\'s unadjusted procedure. The paper was part of a 1991 Epidemiology symposium responding to Rothman (1990); the adjust-or-not debate it opened remains unresolved in the epidemiologic literature.',
    source: {
      externalId: 'src:greenland-robins-1991-empirical-bayes-multiple-comparisons',
      name: 'Greenland S, Robins JM. Empirical-Bayes adjustments for multiple comparisons are sometimes useful. Epidemiology. 1991 Jul;2(4):244–251.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/1912039/',
      publishedAt: '1991-07-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  console.log(`Enriching claim ${CLAIM_ID} with ${TRANSITIONS.length} post-publication transition(s)...`)

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
        ingestedBy: 'enrich:openalex_v1-rothman-1990-multiple-comparisons',
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

    const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'AGAINST' } })
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
