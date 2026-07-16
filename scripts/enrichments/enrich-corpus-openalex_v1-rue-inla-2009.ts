// Epistemic-receipt enrichment: post-publication trajectory for
// Rue, Martino & Chopin (2009), "Approximate Bayesian inference for latent
// Gaussian models by using integrated nested Laplace approximations"
// (Journal of the Royal Statistical Society: Series B 71(2):319–392).
// DOI: 10.1111/j.1467-9868.2008.00700.x. OpenAlex: W2144898279.
// Claim id: cmq2w5ku500ylsa8hrzuyxwbn. Citations (OpenAlex): 5412.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at publication,
// 2009-04-01) already exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (2013-04-18, EXPERT_LITERATURE)
//     Taylor & Diggle, "INLA or MCMC? A tutorial and comparative evaluation for
//     spatial prediction in log-Gaussian Cox processes" (Journal of Statistical
//     Computation and Simulation 84(10):2266–2284; DOI
//     10.1080/00949655.2013.788653; online first 18 Apr 2013). A dated,
//     peer-reviewed methodological critique from a prominent spatial
//     statistician that directly tested INLA's headline advantages. Its
//     simulation study found that a well-tuned MCMC scheme (MALA) could deliver
//     greater predictive accuracy than the default INLA strategy, "question[ing]
//     the notion that INLA is both significantly faster and more robust than
//     MCMC in this setting" — placing the method's claimed superiority in dispute.
//
//   CONTESTED -> SETTLED (2020-02, EXPERT_LITERATURE)
//     Virgilio Gómez-Rubio, "Bayesian Inference with INLA" (Chapman & Hall/CRC,
//     2020; DOI 10.1201/9781315175584). An independent, book-length treatment by
//     an author outside the originating group, published by a major academic
//     press and devoted entirely to teaching INLA as established practice
//     (alongside its known limits and MCMC-based extensions). This textbook
//     consensus marks INLA's settling as a standard, validated tool for
//     approximate Bayesian inference in latent Gaussian models, resolving the
//     earlier dispute over its status rather than overturning the method.
//
// No retraction or expression of concern exists. Both transitions rest on
// specific, dated, citable documents whose DOIs were verified to resolve
// (Crossref, HTTP 200).
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-rue-inla-2009.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5ku500ylsa8hrzuyxwbn'

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
    occurredAt: '2013-04-18',
    datePrecision: 'DAY',
    reason:
      'Taylor & Diggle, "INLA or MCMC? A tutorial and comparative evaluation for spatial prediction in log-Gaussian Cox processes" (Journal of Statistical Computation and Simulation 84(10):2266–2284, 2014; online first 18 Apr 2013), is a dated, peer-reviewed methodological critique that directly tested INLA\'s headline advantages. Its simulation study found that a well-tuned MCMC sampler (MALA) could deliver greater predictive accuracy than the default INLA strategy, explicitly questioning "the notion that INLA is both significantly faster and more robust than MCMC in this setting." This put the paper\'s claim of INLA\'s computational superiority into active dispute within the spatial-statistics community.',
    source: {
      externalId: 'src:taylor-diggle-inla-or-mcmc-2014',
      name: 'Taylor BM, Diggle PJ. INLA or MCMC? A tutorial and comparative evaluation for spatial prediction in log-Gaussian Cox processes. Journal of Statistical Computation and Simulation 2014;84(10):2266–2284. DOI:10.1080/00949655.2013.788653.',
      url: 'https://doi.org/10.1080/00949655.2013.788653',
      publishedAt: '2013-04-18',
      methodologyType: 'primary',
    },
  },
  {
    fromAxis: 'CONTESTED',
    toAxis: 'SETTLED',
    community: 'EXPERT_LITERATURE',
    occurredAt: '2020-02-01',
    datePrecision: 'MONTH',
    reason:
      'Virgilio Gómez-Rubio\'s "Bayesian Inference with INLA" (Chapman & Hall/CRC, 2020) is an independent, book-length treatment by an author outside the originating group, published by a major academic press and devoted entirely to teaching INLA as established practice — including its known limitations and MCMC-based extensions. This textbook consensus marks INLA\'s settling as a standard, validated tool for approximate Bayesian inference in latent Gaussian models, resolving the earlier dispute over its relative standing rather than overturning the method.',
    source: {
      externalId: 'src:gomez-rubio-bayesian-inference-inla-2020',
      name: 'Gómez-Rubio V. Bayesian Inference with INLA. Boca Raton: Chapman & Hall/CRC, 2020. DOI:10.1201/9781315175584.',
      url: 'https://doi.org/10.1201/9781315175584',
      publishedAt: '2020-02-01',
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
