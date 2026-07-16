// Enrichment: post-publication epistemic trajectory for
// Chen, Donoho & Saunders (1998), "Atomic Decomposition by Basis Pursuit",
// SIAM J. Sci. Comput. 20(1):33–61. DOI 10.1137/S1064827596304010.
// OpenAlex W1986931325. Claim cmq2w4yzj00llsa8hokx3565c.
//
// Baseline row (fromAxis=null -> RECORDED at 1998 publication) already exists;
// this script adds only the subsequent arc.
//
// Verified event: SIAM Review selected the paper as a SIGEST reprint —
// "Atomic Decomposition by Basis Pursuit", SIAM Review 43(1):129–159 (2001),
// DOI 10.1137/S003614450037906X. The SIGEST section reprints one outstanding
// paper chosen by the SIAM Review editorial board from SIAM's specialty
// journals, revised for the entire SIAM community — an institutional mark that
// the Basis Pursuit principle had become a field-significant contribution.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-chen-donoho-saunders-1998-basis-pursuit.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmq2w4yzj00llsa8hokx3565c'

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
    community: 'INSTITUTIONAL',
    occurredAt: '2001-01-01',
    datePrecision: 'MONTH',
    reason:
      'In 2001 the SIAM Review editorial board selected the paper for its SIGEST section and reprinted it in full — "Atomic Decomposition by Basis Pursuit", SIAM Review 43(1):129–159 — a distinction reserved for one outstanding paper drawn from SIAM\'s specialty journals and revised for the whole SIAM community. The reprint is an institutional endorsement that the Basis Pursuit principle (ℓ1 decomposition over overcomplete dictionaries) had become a field-significant, broadly adopted method rather than a provisional proposal.',
    source: {
      externalId: 'src:basis-pursuit-siam-review-sigest-2001',
      name: 'Chen SS, Donoho DL, Saunders MA. Atomic Decomposition by Basis Pursuit (SIGEST reprint). SIAM Review 2001;43(1):129–159. DOI 10.1137/S003614450037906X.',
      url: 'https://api.crossref.org/works/10.1137/s003614450037906x',
      publishedAt: '2001-01-01',
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
        ingestedBy: 'enrich:openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const histId = `${claimId}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
