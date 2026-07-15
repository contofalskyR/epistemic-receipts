// Epistemic-receipt enrichment for the PRISMA statement (Liberati, Altman, Tetzlaff,
// Mulrow, Gøtzsche, et al., 2009), "The PRISMA statement for reporting systematic
// reviews and meta-analyses of studies that evaluate healthcare interventions:
// explanation and elaboration." BMJ 2009;339:b2700.
// Claim: cmplypnnh014tsaqksto2ce3j · DOI 10.1136/bmj.b2700 · OpenAlex W2134833483
//
// Baseline row (fromAxis=null -> RECORDED @ 2009-07-21) already exists; NOT duplicated here.
// This adds the post-publication arc:
//   RECORDED -> SETTLED (2021-03-29): PRISMA 2009 was adopted as the de facto reporting
//               standard for systematic reviews (endorsed by the EQUATOR Network and
//               hundreds of journals) and was reaffirmed and updated a decade later by
//               PRISMA 2020 (Page et al., BMJ 2021;372:n71), developed by a large expert
//               panel. The 2020 statement explicitly refreshes rather than overturns the
//               2009 guideline, institutionalising transparent SR reporting as the norm.
//
// There is NO retraction or expression of concern (Crossref relation/update fields empty;
// no PubMed retraction notice). PRISMA 2009 was never contested as invalid — it was
// adopted and updated — so no RECORDED->CONTESTED step is added.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-prisma-2009-reporting-systematic-reviews.ts
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplypnnh014tsaqksto2ce3j'

type FactStatus = 'OPEN' | 'RECORDED' | 'SETTLED' | 'CONTESTED' | 'REVERSED' | 'ABANDONED' | 'UNRESOLVABLE'
type RatifyingCommunity = 'EXPERT_LITERATURE' | 'INSTITUTIONAL' | 'JUDICIAL' | 'PUBLIC' | 'MARKET'
type DatePrecision = 'DAY' | 'MONTH' | 'QUARTER' | 'YEAR'

interface Transition {
  fromAxis: FactStatus
  toAxis: FactStatus
  community: RatifyingCommunity
  occurredAt: string // YYYY-MM-DD
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
    community: 'INSTITUTIONAL',
    occurredAt: '2021-03-29',
    datePrecision: 'DAY',
    reason:
      'The PRISMA 2020 statement (Page JE, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, et al. "The PRISMA 2020 statement: an updated guideline for reporting systematic reviews." BMJ 2021;372:n71, published 29 March 2021) reaffirmed and updated the 2009 guideline after a decade of methodological advances, developed by a large multidisciplinary expert panel. The update refreshes the checklist rather than overturning it, confirming that transparent, standardised reporting of systematic reviews is essential and institutionally established. Combined with PRISMA 2009\'s endorsement by the EQUATOR Network and adoption by hundreds of journals, this settles the finding as accepted practice.',
    source: {
      externalId: 'src:prisma-2020-page-bmj-n71',
      name: 'Page MJ, McKenzie JE, Bossuyt PM, et al. The PRISMA 2020 statement: an updated guideline for reporting systematic reviews. BMJ 2021;372:n71.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33782057/',
      publishedAt: '2021-03-29',
      methodologyType: 'derivative',
    },
  },
]

async function main() {
  const claim = await prisma.claim.findUnique({ where: { id: CLAIM_ID } })
  if (!claim) throw new Error(`Claim ${CLAIM_ID} not found — refusing to enrich a missing claim.`)

  for (const tr of TRANSITIONS) {
    const source = await prisma.source.upsert({
      where: { externalId: tr.source.externalId },
      create: {
        externalId: tr.source.externalId,
        name: tr.source.name,
        url: tr.source.url,
        publishedAt: new Date(tr.source.publishedAt),
        methodologyType: tr.source.methodologyType,
        ingestedBy: 'enrich:openalex_v1-prisma-2009-reporting-systematic-reviews',
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

    console.log(`  ✓ ${histId} (${tr.fromAxis} -> ${tr.toAxis})`)
  }

  console.log(`Done: ${TRANSITIONS.length} transitions upserted for ${CLAIM_ID}.`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
