// Enrichment: post-publication epistemic trajectory for
// Sweller, van Merriënboer & Paas (1998), "Cognitive Architecture and
// Instructional Design," Educational Psychology Review 10(3):251–296.
// DOI 10.1023/A:1022193728205 · OpenAlex W2096036274 · claim cmplxkysr0067sa7fvecdh564
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 1998-09 publication date) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> CONTESTED (2010-03, EXPERT_LITERATURE)
//     de Jong, T. (2010) "Cognitive load theory, educational research, and
//     instructional design: some food for thought," Instructional Science
//     38:105–134. A widely-cited (~1,000+ citations) major methodological
//     critique that identifies "problematic conceptual, methodological and
//     application-related issues" — most centrally, whether the theory's core
//     load constructs (intrinsic/extraneous/germane) can be empirically
//     distinguished or measured, and whether the framework is falsifiable.
//
// No retraction or expression of concern exists, and no independent
// systematic review / meta-analysis re-adjudicates the contest, so no
// SETTLED/REVERSED transition is asserted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sweller-cognitive-architecture-instructional-design.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxkysr0067sa7fvecdh564'

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

interface SourceDef {
  externalId: string
  name: string
  url: string
  publishedAt: Date
  methodologyType: 'primary' | 'derivative' | 'opinion'
}

interface TransitionDef {
  fromAxis: FactStatus | null
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: Date
  datePrecision: DatePrecision
  reason: string
  source: SourceDef
}

const TRANSITIONS: TransitionDef[] = [
  {
    fromAxis: 'RECORDED',
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: new Date('2010-03-01'),
    datePrecision: 'MONTH',
    reason:
      'Ton de Jong\'s review "Cognitive load theory, educational research, and instructional design: some food for thought" (Instructional Science 38:105–134, 2010) mounted a widely-cited methodological critique of the framework Sweller et al. codified in 1998. It argued that the theory\'s central load constructs — intrinsic, extraneous and germane — cannot be cleanly distinguished or independently measured, and that this measurement circularity threatens the theory\'s falsifiability. The paper opened a sustained expert-literature contest over the empirical status of cognitive load theory\'s core claims rather than overturning them.',
    source: {
      externalId: 'src:dejong-2010-cognitive-load-critique',
      name: 'de Jong T. Cognitive load theory, educational research, and instructional design: some food for thought. Instructional Science. 2010;38(2):105–134.',
      url: 'https://doi.org/10.1007/s11251-009-9110-0',
      publishedAt: new Date('2010-03-01'),
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) {
    throw new Error(`Claim ${CLAIM_ID} not found — refusing to enrich a missing claim.`)
  }

  for (const t of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: t.source.externalId },
      create: {
        externalId: t.source.externalId,
        name: t.source.name,
        url: t.source.url,
        publishedAt: t.source.publishedAt,
        methodologyType: t.source.methodologyType,
        ingestedBy: 'enrich-corpus-openalex_v1',
        autoApproved: true,
      },
      update: {
        name: t.source.name,
        url: t.source.url,
        publishedAt: t.source.publishedAt,
        methodologyType: t.source.methodologyType,
      },
    })

    const id = `${CLAIM_ID}-${t.toAxis}-${t.occurredAt.toISOString().slice(0, 10)}`

    await prisma.claimStatusHistory.upsert({
      where: { id },
      create: {
        id,
        claimId: CLAIM_ID,
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: t.occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
      update: {
        fromAxis: t.fromAxis,
        toAxis: t.toAxis,
        community: t.community,
        reason: t.reason,
        occurredAt: t.occurredAt,
        datePrecision: t.datePrecision,
        sourceId: source.id,
      },
    })

    console.log(`upserted ${t.fromAxis ?? 'null'} -> ${t.toAxis} @ ${id}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
