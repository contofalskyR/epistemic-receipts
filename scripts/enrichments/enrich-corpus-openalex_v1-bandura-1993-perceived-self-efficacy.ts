// Enrichment: post-publication epistemic trajectory for
// Bandura, A. "Perceived Self-Efficacy in Cognitive Development and Functioning."
// Educational Psychologist 28(2):117-148 (March 1993).
//
// Claim ID:    cmplxkp6k001jsa7f3kpb6bb8
// DOI:         https://doi.org/10.1207/s15326985ep2802_3
// OpenAlex:    W2021765444
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the 1993-03-01
// publication date recorded in the corpus) already exists; this script does NOT
// duplicate it. It adds the single verified post-publication transition:
//
//   RECORDED -> SETTLED (2012): Richardson, Abraham & Bond's systematic review and
//   meta-analysis in Psychological Bulletin (138(2):353-387) synthesized ~241
//   studies of the psychological correlates of university students' academic
//   performance and found "performance self-efficacy" to be the single strongest
//   correlate of GPA among all measured antecedents. This independently adjudicates
//   and vindicates Bandura's central claim that perceived self-efficacy is an
//   important contributor to academic development.
//
// No retraction or expression of concern exists (Bandura 1993 is an unretracted,
// foundational theoretical/review article; CrossRef and the publisher record it as
// active). There was no dated, citable contest of the core self-efficacy->academic
// performance link, so no CONTESTED transition is asserted — the meta-analytic
// review takes the claim directly RECORDED -> SETTLED.
//
// Idempotent: upserts on source externalId and claimStatusHistory id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-bandura-1993-perceived-self-efficacy.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxkp6k001jsa7f3kpb6bb8'

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
    community: 'EXPERT_LITERATURE',
    occurredAt: '2012-01-01',
    datePrecision: 'YEAR',
    reason:
      'Richardson, Abraham & Bond, "Psychological correlates of university students\' academic performance: A systematic review and meta-analysis" (Psychological Bulletin, 2012, 138(2):353-387), synthesized roughly 241 studies covering ~50 psychological constructs and found "performance self-efficacy" to be the strongest single correlate of university grade-point average of any antecedent examined (a large effect). This top-tier, independent meta-analytic review adjudicates and vindicates Bandura\'s central claim that perceived self-efficacy is an important contributor to students\' academic development and functioning.',
    source: {
      externalId: 'src:richardson-abraham-bond-2012-psychbull-meta',
      name: 'Richardson M, Abraham C, Bond R. Psychological correlates of university students\' academic performance: A systematic review and meta-analysis. Psychological Bulletin. 2012;138(2):353-387.',
      url: 'https://doi.org/10.1037/a0026838',
      publishedAt: '2012-01-01',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  // Confirm the target claim exists; never create a new Claim.
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — aborting.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-bandura-1993-self-efficacy',
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

    console.log(`Upserted transition ${slug} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
