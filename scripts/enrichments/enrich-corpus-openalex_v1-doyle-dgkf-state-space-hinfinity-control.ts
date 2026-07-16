// Epistemic-receipt enrichment for claim cmq2w5g3l00vxsa8hdcelwe4o
// "State-space solutions to standard H2 and H-infinity control problems"
// Doyle J, Glover K, Khargonekar P, Francis B. IEEE Trans. Automatic Control 1989;34(8):831–847.
// DOI 10.1109/9.29425. OpenAlex W2042106612. (The "DGKF" paper.)
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at 1989-01-01) already exists;
// this script does NOT duplicate it.
//
// Post-publication event added:
//   RECORDED -> SETTLED (1990) — the paper received the 1990 IEEE Control Systems Society
//   George S. Axelby Outstanding Paper Award. The field's governing professional society
//   formally recognized the DGKF state-space H-infinity/H2 solution as the outstanding paper
//   of the period, an institutional adjudication that the result is a valid, foundational
//   contribution. The DGKF two-Riccati formulas subsequently became the canonical, universally
//   taught solution to the standard H-infinity control problem. Community: INSTITUTIONAL.
//   The award year (1990) is the precision the award record supports; datePrecision = YEAR.
//
// This is a mathematical/engineering theorem: no retraction, expression of concern, failed
// replication, or overturning critique exists. The single verifiable adjudicating event is the
// society award, so only one transition is added.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-doyle-dgkf-state-space-hinfinity-control.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5g3l00vxsa8hdcelwe4o'

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
  edgeType: string
  source: SourceDef
}

const TRANSITIONS: Transition[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'SETTLED',
    community: 'INSTITUTIONAL',
    occurredAt: '1990-01-01',
    datePrecision: 'YEAR',
    reason:
      'The DGKF paper received the 1990 IEEE Control Systems Society George S. Axelby Outstanding Paper Award, the field\'s highest paper honor. The professional society formally recognized the state-space H-infinity/H2 solution — two algebraic Riccati equations with an LQG-like separation structure — as the outstanding contribution of the period. The two-Riccati formulas became the canonical, universally taught solution to the standard H-infinity control problem, so this institutional recognition marks the finding as settled established theory rather than a contested claim.',
    edgeType: 'FOR',
    source: {
      externalId: 'src:axelby-award-dgkf-1990',
      name: 'IEEE Control Systems Society George S. Axelby Outstanding Paper Award, 1990 recipients: John Doyle, Keith Glover, Pramod Khargonekar, Bruce Francis (for "State-space solutions to standard H2 and H-infinity control problems").',
      url: 'https://ieeecss.org/awards/ieee-css-george-s-axelby-outstanding-paper-award/recipient/john-doyle-keith-glover-pramod',
      publishedAt: '1990-01-01',
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
        ingestedBy: 'enrich:openalex_v1-dgkf-state-space-hinfinity-control',
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
      await prisma.edge.create({ data: { claimId: claim.id, sourceId: source.id, type: tr.edgeType } })
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
