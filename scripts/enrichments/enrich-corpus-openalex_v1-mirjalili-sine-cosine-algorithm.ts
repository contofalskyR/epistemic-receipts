// Epistemic-receipt enrichment for claim cmq2w5gnd00w9sa8h2jbxsolo
// "SCA: A Sine Cosine Algorithm for solving optimization problems"
// Mirjalili S. Knowledge-Based Systems 2016;96:120–133. DOI 10.1016/j.knosys.2015.12.022
// OpenAlex W2232317135.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 2016-01-06) already exists;
// this script does NOT duplicate it.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2020-07-08) — Askari, Younas & Saeed, "Critical evaluation of
//   sine cosine algorithm and a few recommendations" (GECCO '20 Companion, DOI
//   10.1145/3377929.3389982). A specific, dated methodological critique showing that (a) the
//   sine/cosine operators can be replaced by a single uniform random variable in [-1, 1]
//   without degrading performance, undercutting the novelty claim; (b) the position-update
//   model does not behave as described in the original paper; and (c) SCA is biased toward
//   problems whose global optimum sits at the origin. Community: EXPERT_LITERATURE.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-mirjalili-sine-cosine-algorithm.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5gnd00w9sa8h2jbxsolo'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: string
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface Transition {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-07-08',
    datePrecision: 'DAY',
    reason:
      'Askari, Younas & Saeed published a critical evaluation of the Sine Cosine Algorithm at GECCO 2020, showing the algorithm\'s defining sine and cosine operators can be replaced by a single uniform random variable in [-1, 1] without degrading performance, which undercuts the novelty claim of the original paper. They further demonstrated that the position-updating model does not behave as the original paper describes and that SCA\'s search is biased toward benchmark functions whose global optimum lies at the origin. This is a specific, dated, peer-reviewed methodological critique of the finding, not a retraction — the algorithm remains widely used but its central methodological claims are contested.',
    source: {
      externalId: 'src:askari-sca-critical-evaluation-2020',
      name: 'Askari Q, Younas I, Saeed M. Critical evaluation of sine cosine algorithm and a few recommendations. Proceedings of the 2020 Genetic and Evolutionary Computation Conference Companion (GECCO \'20 Companion) 2020:151–152.',
      url: 'https://doi.org/10.1145/3377929.3389982',
      publishedAt: '2020-07-08',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUniqueOrThrow({ where: { id: CLAIM_ID } })
  console.log(`Enriching claim ${claim.id}: ${claim.text.slice(0, 60)}...`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-sine-cosine-algorithm',
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

    console.log(`  ✓ ${tr.fromAxis} -> ${tr.toAxis} @ ${tr.occurredAt} (${tr.source.externalId})`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
