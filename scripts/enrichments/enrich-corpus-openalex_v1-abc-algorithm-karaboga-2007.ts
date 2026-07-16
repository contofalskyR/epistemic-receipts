// Epistemic-receipt enrichment: post-publication trajectory for
// Karaboga & Basturk (2007), "A powerful and efficient algorithm for numerical
// function optimization: artificial bee colony (ABC) algorithm",
// Journal of Global Optimization 39(3):459–471. DOI: 10.1007/s10898-007-9149-x
// OpenAlex: W2143560894. Claim id: cmq2w4vfn00jfsa8ha21t1pzc.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2007-04-13) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2015-01, EXPERT_LITERATURE)
//     Sörensen, "Metaheuristics—the metaphor exposed" — the canonical, highly
//     cited methodological critique of nature-metaphor metaheuristics (of which
//     the artificial bee colony algorithm is a flagship example), disputing the
//     novelty and "powerful/efficient" superiority framing this paper asserts.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-abc-algorithm-karaboga-2007.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4vfn00jfsa8ha21t1pzc'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2015-01-01',
    datePrecision: 'MONTH',
    reason:
      'Kenneth Sörensen\'s "Metaheuristics—the metaphor exposed" (Int. Trans. in Operational Research 22(1):3–18) is the canonical methodological critique of the wave of nature-metaphor metaheuristics, of which the artificial bee colony algorithm is a flagship example. It argues that such metaphor-based methods rarely introduce genuinely novel optimization ideas beyond relabeled existing operators, and that their claims of being uniquely "powerful and efficient" lack scientific rigor. The paper became the reference point for a sustained methodological dispute that directly contests the novelty-and-superiority framing this claim asserts.',
    source: {
      externalId: 'src:sorensen-metaphor-exposed-2015',
      name: 'Sörensen K. Metaheuristics—the metaphor exposed. International Transactions in Operational Research 2015;22(1):3–18.',
      url: 'https://doi.org/10.1111/itor.12001',
      publishedAt: '2015-01-01',
      methodologyType: 'opinion',
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
