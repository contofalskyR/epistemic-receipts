// Epistemic-receipt enrichment: post-publication trajectory for
// Ortony, Clore & Collins (1988), "The Cognitive Structure of Emotions"
// (Cambridge University Press) — the OCC model of appraisal theory.
// DOI: 10.1017/cbo9780511571299  OpenAlex: W1977137834
// Claim id: cmplxkps5001vsa7ft4zrk7z3.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 1988-07-29) already exists and is NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2013-03-20, EXPERT_LITERATURE)
//     Moors, Ellsworth, Scherer & Frijda, "Appraisal Theories of Emotion: State
//     of the Art and Future Development" (Emotion Review 5(2):119-124), the lead
//     review of Emotion Review's appraisal-theory special issue. It adjudicates
//     appraisal theory — the research program for which the OCC model is a
//     foundational, and in AI the most widely implemented, instantiation — as an
//     established, actively developing paradigm. This consolidates the book's core
//     thesis (that emotions arise from systematic cognitive appraisals of how
//     events, agents, and objects are construed) as mainstream in emotion science.
//
// Only one transition is added. No retraction or expression of concern exists
// (checked publisher/CrossRef; this is a theoretical monograph, not an empirical
// claim), and there is no dated, OCC-specific failed replication or rebuttal that
// would justify a CONTESTED step; the authors' own 2013 reframing
// (Clore & Ortony, "Psychological Construction in the OCC Model of Emotion")
// defends rather than overturns the model, so it is not treated as a contest.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cognitive-structure-emotions-occ-1988.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxkps5001vsa7ft4zrk7z3'

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
    occurredAt: '2013-03-20',
    datePrecision: 'DAY',
    reason:
      'Moors, Ellsworth, Scherer & Frijda\'s "Appraisal Theories of Emotion: State of the Art and Future Development" (Emotion Review 5(2):119-124) reviews appraisal theory as an established, actively developing research program — the paradigm for which the OCC model is a foundational instantiation and, in affective computing, the most widely implemented one. The review adjudicates the book\'s central thesis (that emotions arise from systematic cognitive appraisals of how events, agents, and objects are construed) as mainstream rather than fringe or discredited, consolidating it into settled emotion science even as specific componential details remain debated.',
    source: {
      externalId: 'src:moors-appraisal-theories-state-of-the-art-2013',
      name: 'Moors A, Ellsworth PC, Scherer KR, Frijda NH. Appraisal Theories of Emotion: State of the Art and Future Development. Emotion Review 2013;5(2):119-124.',
      url: 'https://doi.org/10.1177/1754073912468165',
      publishedAt: '2013-03-20',
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
