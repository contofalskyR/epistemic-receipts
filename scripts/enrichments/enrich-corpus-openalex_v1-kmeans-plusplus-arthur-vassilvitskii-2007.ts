// Epistemic-receipt enrichment: post-publication trajectory for
// Arthur & Vassilvitskii (2007), "k-means++: The Advantages of Careful Seeding",
// SODA '07, Proceedings of the 18th ACM-SIAM Symposium on Discrete Algorithms,
// pp. 1027–1035. DOI: 10.5555/1283383.1283494
// OpenAlex: W2073459066. Claim id: cmq2w553o00p9sa8hu2yyuhkd.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2007-01-07) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2011-05, EXPERT_LITERATURE)
//     Brunsch & Röglin, "A Bad Instance for k-Means++" (TAMC 2011; journal
//     version in Theoretical Computer Science 505 (2013):19–26). They exhibit
//     instances on which k-means++ achieves an approximation ratio no better
//     than (2/3 − ε)·log k with probability exponentially close to 1, proving a
//     matching Ω(log k) lower bound. This settles the paper's central theoretical
//     claim: the O(log k)-competitive guarantee is asymptotically TIGHT — exactly
//     Θ(log k) — and cannot be improved. The characterization is vindicated as the
//     precise, unimprovable truth rather than a merely sufficient upper bound.
//
// No retraction, expression of concern, or failed replication exists; this is a
// celebrated, heavily built-upon algorithms result (e.g. scalable k-means|| ,
// Bahmani et al. 2012, extends rather than overturns it).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-kmeans-plusplus-arthur-vassilvitskii-2007.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w553o00p9sa8hu2yyuhkd'

type FactStatus =
  | 'OPEN'
  | 'RECORDED'
  | 'SETTLED'
  | 'CONTESTED'
  | 'REVERSED'
  | 'ABANDONED'
  | 'UNRESOLVABLE'
type RatifyingCommunity =
  | 'EXPERT_LITERATURE'
  | 'INSTITUTIONAL'
  | 'JUDICIAL'
  | 'PUBLIC'
  | 'MARKET'
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
    occurredAt: '2011-05-01',
    datePrecision: 'MONTH',
    reason:
      'Brunsch & Röglin, "A Bad Instance for k-Means++" (TAMC 2011, LNCS 6648:344–352; journal version in Theoretical Computer Science 505 (2013):19–26), prove a matching Ω(log k) lower bound for k-means++: they construct instances on which the algorithm attains an approximation ratio no better than (2/3 − ε)·log k with probability exponentially close to 1. This settles the central theoretical claim of the paper — that k-means++ is O(log k)-competitive with the optimal clustering — by showing the bound is asymptotically TIGHT (exactly Θ(log k)) and therefore unimprovable. The result vindicates the paper\'s competitive-ratio characterization as the precise truth rather than a possibly-loose upper bound.',
    source: {
      externalId: 'src:brunsch-roglin-bad-instance-kmeans-2011',
      name: 'Brunsch T, Röglin H. A Bad Instance for k-Means++. TAMC 2011, LNCS 6648:344–352 (journal version: Theoretical Computer Science 505 (2013):19–26).',
      url: 'https://doi.org/10.1007/978-3-642-20877-5_34',
      publishedAt: '2011-05-01',
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
        ingestedBy: 'enrich:corpus-openalex_v1',
      },
      update: {
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
      },
    })

    const slug = `${CLAIM_ID}-${tr.toAxis}-${tr.occurredAt.slice(0, 10)}`
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
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

    console.log(`  ✓ ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
