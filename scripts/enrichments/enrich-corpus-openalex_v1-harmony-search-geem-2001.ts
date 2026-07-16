// Epistemic-receipt enrichment: post-publication trajectory for
// Geem, Kim & Loganathan (2001), "A New Heuristic Optimization Algorithm:
// Harmony Search", SIMULATION 76(2):60–68. DOI: 10.1177/003754970107600201
// OpenAlex: W1993885071. Claim id: cmq2w567200pxsa8hv5xcy03i.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2001-02-01) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2010-04, EXPERT_LITERATURE)
//     Weyland, "A Rigorous Analysis of the Harmony Search Algorithm: How the
//     Research Community can be Misled by a 'Novel' Methodology" — a specific,
//     dated critique giving formal evidence that Harmony Search is a special
//     case of Evolution Strategies, directly disputing the "new heuristic
//     optimization algorithm" novelty framing this claim asserts. The critique
//     touched off a sustained methodological dispute (Sörensen 2015; Geem/Kim
//     rebuttals) that leaves the finding contested rather than settled.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-harmony-search-geem-2001.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w567200pxsa8hv5xcy03i'

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
    occurredAt: '2010-04-01',
    datePrecision: 'MONTH',
    reason:
      'Dennis Weyland\'s "A Rigorous Analysis of the Harmony Search Algorithm" (Int. J. of Applied Metaheuristic Computing 1(2):50–60) gives formal, compelling evidence that Harmony Search is a special case of the long-established Evolution Strategies, arguing that its music-improvisation metaphor merely relabels existing operators and that the field was misled by a "novel" methodology. This directly contests the paper\'s central claim to be a genuinely new heuristic optimization algorithm. The critique opened a sustained methodological dispute (extended by Sörensen 2015 and answered by Geem/Kim rebuttals), leaving the novelty claim contested rather than settled.',
    source: {
      externalId: 'src:weyland-harmony-search-rigorous-analysis-2010',
      name: 'Weyland D. A Rigorous Analysis of the Harmony Search Algorithm: How the Research Community can be Misled by a "Novel" Methodology. International Journal of Applied Metaheuristic Computing 2010;1(2):50–60.',
      url: 'https://people.idsia.ch/~weyland/harmony_search.pdf',
      publishedAt: '2010-04-01',
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
