// Epistemic-receipt enrichment: post-publication trajectory for
// Abadie, Diamond & Hainmueller (2010), "Synthetic Control Methods for
// Comparative Case Studies: Estimating the Effect of California's Tobacco
// Control Program" (Journal of the American Statistical Association 105(490):
// 493–505). DOI: 10.1198/jasa.2009.ap08746.
// OpenAlex: W3125057276. Claim id: cmpm1gnb30t8ksa86fwiqomjp.
// Citations (OpenAlex): 5441.
//
// Identity confirmed via Crossref: title, JASA container, authors
// (Abadie / Diamond / Hainmueller), issued 2010. This is the founding
// applied paper of the synthetic control method (SCM).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication)
// already exists and is NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> CONTESTED (2020-03-25, EXPERT_LITERATURE)
//     Ferman, Pinto & Possebom, "Cherry Picking with Synthetic Controls"
//     (Journal of Policy Analysis and Management 39(2):510–532; online first
//     2020-03-25; DOI 10.1002/pam.22206). Shows that the many degrees of
//     freedom in SCM specification (choice of pre-treatment outcome lags and
//     covariates) let a researcher engaged in specification search generate
//     statistically significant placebo effects even when no true effect
//     exists — a direct, dated challenge to the inferential credibility of the
//     method as applied in the Prop 99 study.
//
//   CONTESTED -> SETTLED (2021-06, EXPERT_LITERATURE)
//     Abadie, "Using Synthetic Controls: Feasibility, Data Requirements, and
//     Methodological Aspects" (Journal of Economic Literature 59(2):391–425;
//     DOI 10.1257/jel.20191450). The definitive methodological review, published
//     in the field's premier survey journal, that consolidates SCM into a
//     standard applied-econometrics tool: it lays out formal feasibility and
//     data requirements and codifies best practices for specification and
//     inference that answer the specification-search critique. Its publication
//     marks the method's settling into canonical status in the expert
//     literature.
//
// No retraction or expression of concern exists. The two transitions above are
// the high-confidence, dated arc; nothing else is emitted.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-abadie-synthetic-control-prop99-2010.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm1gnb30t8ksa86fwiqomjp'

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
    occurredAt: '2020-03-25',
    datePrecision: 'DAY',
    reason:
      'Ferman, Pinto & Possebom, "Cherry Picking with Synthetic Controls" (Journal of Policy Analysis and Management 39(2):510–532; online first 2020-03-25; DOI 10.1002/pam.22206), is a specific, dated methodological critique of the synthetic control method this paper introduced. It demonstrates that the method\'s many researcher degrees of freedom — the choice of pre-treatment outcome lags and covariates used to construct the synthetic control — permit specification searching that can produce statistically significant estimated effects even when no true effect exists, directly contesting the inferential credibility of SCM applications such as the Prop 99 analysis.',
    source: {
      externalId: 'src:ferman-pinto-possebom-cherry-picking-2020',
      name: 'Ferman B, Pinto C, Possebom V. Cherry Picking with Synthetic Controls. Journal of Policy Analysis and Management 2020;39(2):510–532. DOI:10.1002/pam.22206.',
      url: 'https://doi.org/10.1002/pam.22206',
      publishedAt: '2020-03-25',
      methodologyType: 'derivative',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2021-06-01',
    datePrecision: 'MONTH',
    reason:
      'Abadie, "Using Synthetic Controls: Feasibility, Data Requirements, and Methodological Aspects" (Journal of Economic Literature 59(2):391–425, June 2021; DOI 10.1257/jel.20191450), is the definitive methodological review of synthetic control methods, published in the discipline\'s premier survey journal. It formalizes the feasibility conditions and data requirements for SCM and codifies best practices for specification and inference — directly answering the specification-search concerns — thereby consolidating the method into a standard, canonical tool of applied econometrics. Its publication marks the finding\'s settling in the expert literature.',
    source: {
      externalId: 'src:abadie-using-synthetic-controls-2021',
      name: 'Abadie A. Using Synthetic Controls: Feasibility, Data Requirements, and Methodological Aspects. Journal of Economic Literature 2021;59(2):391–425. DOI:10.1257/jel.20191450.',
      url: 'https://doi.org/10.1257/jel.20191450',
      publishedAt: '2021-06-01',
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
