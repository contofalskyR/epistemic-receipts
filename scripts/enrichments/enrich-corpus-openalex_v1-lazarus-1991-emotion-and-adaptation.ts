// Enrichment: post-publication epistemic trajectory for
// Richard S. Lazarus, "Emotion and Adaptation" (Oxford University Press, 1991).
//
// Claim ID:    cmpm17te6049psadnfacixa8h
// DOI:         https://doi.org/10.1093/oso/9780195069945.001.0001
// OpenAlex:    W1984186949
//
// DOI confirmed via Crossref: title "Emotion And Adaptation", author Lazarus,
// issued 1991-08-29, book, Oxford University Press — the correct work.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 1991-08-29 publication date) already exists; this script does NOT duplicate it.
// It adds the single verified post-publication transition:
//
//   RECORDED -> CONTESTED (2003-01): James A. Russell's "Core affect and the
//   psychological construction of emotion" (Psychological Review, 2003) launched
//   the psychological-construction challenge to appraisal theory. It directly
//   disputes the premise at the heart of Lazarus's cognitive-motivational-
//   relational theory — that discrete emotions are elicited by specific cognitive
//   appraisals of person-environment relationships — arguing instead that
//   emotional episodes are constructed from a more basic dimension (core affect)
//   and are not natural kinds triggered by appraisal. Cited ~3,970 times, it made
//   appraisal theory a genuinely contested paradigm in emotion science.
//
// No retraction or expression of concern exists (theoretical monograph). The
// appraisal vs. psychological-construction dispute remains live in the literature
// (e.g. Moors 2017 explicitly frames both as "skeptical" theories still being
// integrated), so no SETTLED/REVERSED transition is asserted.
//
// Idempotent: upserts on source externalId and claimStatusHistory id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lazarus-1991-emotion-and-adaptation.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm17te6049psadnfacixa8h'

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
    toAxis: 'CONTESTED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2003-01-01',
    datePrecision: 'MONTH',
    reason:
      'James A. Russell\'s "Core affect and the psychological construction of emotion" (Psychological Review, January 2003) advanced the psychological-construction account of emotion as a direct competitor to appraisal theory. It contests the central claim of Lazarus\'s cognitive-motivational-relational theory — that discrete emotions are elicited and differentiated by specific cognitive appraisals — by arguing that emotional episodes are not natural kinds but are constructed from a more basic, continuously varying dimension (core affect) together with cognitive attribution. As the seminal, heavily cited (~3,970) statement of the construction paradigm, it made the appraisal framework a genuinely contested position in the science of emotion rather than the settled consensus.',
    source: {
      externalId: 'src:russell-2003-core-affect-psychological-construction',
      name: 'Russell JA. Core affect and the psychological construction of emotion. Psychological Review. 2003 Jan;110(1):145–172.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/12529060/',
      publishedAt: '2003-01-01',
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
        ingestedBy: 'enrich:openalex_v1-lazarus-1991',
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
