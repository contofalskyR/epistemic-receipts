// Epistemic-receipt enrichment: post-publication trajectory for
// Karaboğa (2005), "An Idea Based on Honey Bee Swarm for Numerical Optimization"
// (Technical Report TR06, Erciyes University) — the founding paper of the
// Artificial Bee Colony (ABC) algorithm.
// OpenAlex: W2287814884 (DOI not available). Claim id: cmq2w5iwo00xfsa8hsjzuhvjr.
// Citations (OpenAlex): 5441.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2005-01-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2013-02-08, EXPERT_LITERATURE)
//     Kenneth Sörensen, "Metaheuristics—the metaphor exposed" (International
//     Transactions in Operational Research 22(1):3–18; online first 2013-02-08,
//     print 2015). Sörensen argues that the flood of metaphor-inspired
//     metaheuristics — insect/bee/water/music analogies — is leading the field
//     away from scientific rigor, that such methods are frequently repackagings
//     of existing ideas cloaked in novel terminology, and that the metaphor
//     provides neither justification nor genuine novelty. The paper's reference
//     list explicitly cites Karaboğa's ABC report (OpenAlex confirms W2287814884
//     is among its referenced works), placing ABC squarely within the class of
//     algorithms whose scientific standing this critique contests.
//
// No retraction or expression of concern exists (technical report; ABC has not
// been shown equivalent to a prior algorithm the way Harmony Search was). Only
// the RECORDED -> CONTESTED arc is high-confidence and dated, so it is the only
// transition emitted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-karaboga-abc-swarm-2005.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5iwo00xfsa8hsjzuhvjr'

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
    occurredAt: '2013-02-08',
    datePrecision: 'DAY',
    reason:
      'Kenneth Sörensen\'s "Metaheuristics—the metaphor exposed" (Int. Trans. in Operational Research 22(1):3–18; online first 2013-02-08, print 2015) is the canonical methodological critique of metaphor-based metaheuristics, of which the Artificial Bee Colony algorithm introduced here is a prime example. Sörensen argues this "tsunami of novel metaheuristics" — insect, bee, water, and music analogies — is drawing the field away from scientific rigor, that the biological metaphor confers neither justification nor genuine novelty, and that many such algorithms are relabeled versions of existing methods. OpenAlex confirms the paper directly references Karaboğa\'s ABC report (W2287814884) among its cited works, so this critique contests the scientific standing of the ABC contribution specifically, not merely the genre in the abstract.',
    source: {
      externalId: 'src:sorensen-metaphor-exposed-2013',
      name: 'Sörensen K. Metaheuristics—the metaphor exposed. International Transactions in Operational Research 2015;22(1):3–18 (online first 2013-02-08). DOI:10.1111/itor.12001.',
      url: 'https://doi.org/10.1111/itor.12001',
      publishedAt: '2013-02-08',
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
