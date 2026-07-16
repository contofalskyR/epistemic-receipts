// Enrichment: post-publication epistemic arc for Lent, Brown & Hackett's SCCT paper.
//
// Claim: cmplxkuk40041sa7fvtq8ffvb (openalex_v1, W2035286692)
//   "Toward a Unifying Social Cognitive Theory of Career and Academic Interest,
//   Choice, and Performance" — Robert W. Lent, Steven D. Brown, Gail Hackett,
//   Journal of Vocational Behavior, 1994. DOI 10.1006/jvbe.1994.1027.
//   This is the founding statement of Social Cognitive Career Theory (SCCT).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1994-08-01) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref + doi.org):
//   - No retraction and no expression of concern (Crossref update-to/updated-by: none;
//     isRetracted=null in corpus). No landmark failed replication or major methodological
//     critique that placed the theory in dispute.
//   - RECORDED -> SETTLED: Sheu, Lent, Brown, Miller, Hennessy & Duffy (Journal of
//     Vocational Behavior 2010;76:252-264, DOI 10.1016/j.jvb.2009.10.015) meta-analytically
//     tested the SCCT choice model — the exact self-efficacy -> outcome-expectations ->
//     interests -> goals -> choice causal chain proposed in 1994 — via meta-analytic path
//     analysis across all six Holland RIASEC themes, finding the hypothesized model fit the
//     aggregated data well and that its predicted pathways were largely supported. Published
//     in the field's flagship vocational journal, this adjudicated the paper's central
//     "unifying" causal model in its favor. The performance arm of the same 1994 theory was
//     independently vindicated by Brown, Tramayne, Hoxha, Telander, Fan & Lent's
//     meta-analytic path analysis (J Vocational Behavior 2008;72:298-308,
//     DOI 10.1016/j.jvb.2007.09.003).
//
// Only one added transition — a single verified adjudication beats a padded arc.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-lent-brown-hackett-1994-scct.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxkuk40041sa7fvtq8ffvb'

async function main() {
  // ── RECORDED -> SETTLED: Sheu et al. meta-analytic path test of the SCCT choice model (2010) ──
  const metaSource = await prisma.source.upsert({
    where: { externalId: 'src:sheu-2010-scct-choice-model-meta-analysis' },
    create: {
      externalId: 'src:sheu-2010-scct-choice-model-meta-analysis',
      name: 'Sheu H-B, Lent RW, Brown SD, Miller MJ, Hennessy KD, Duffy RD. Testing the choice model of social cognitive career theory across Holland themes: A meta-analytic path analysis. Journal of Vocational Behavior 2010;76(2):252-264. DOI 10.1016/j.jvb.2009.10.015.',
      url: 'https://doi.org/10.1016/j.jvb.2009.10.015',
      publishedAt: new Date('2010-04-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Sheu H-B, Lent RW, Brown SD, Miller MJ, Hennessy KD, Duffy RD. Testing the choice model of social cognitive career theory across Holland themes: A meta-analytic path analysis. Journal of Vocational Behavior 2010;76(2):252-264. DOI 10.1016/j.jvb.2009.10.015.',
      url: 'https://doi.org/10.1016/j.jvb.2009.10.015',
      publishedAt: new Date('2010-04-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2010-04-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2010-04-01'),
      datePrecision: 'MONTH',
      sourceId: metaSource.id,
      reason:
        'Sheu et al. (Journal of Vocational Behavior 2010;76:252-264) meta-analytically tested the SCCT choice model — the exact self-efficacy -> outcome-expectations -> interests -> goals -> choice causal chain proposed by Lent, Brown & Hackett in 1994 — via meta-analytic path analysis across all six Holland RIASEC themes, finding the hypothesized model fit the aggregated data well and its predicted pathways were largely supported. Published in the field\'s flagship vocational journal (and corroborated on the performance arm by Brown et al. 2008, DOI 10.1016/j.jvb.2007.09.003), it adjudicated the paper\'s central unifying causal model in its favor: RECORDED -> SETTLED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2010-04-01'),
      datePrecision: 'MONTH',
      sourceId: metaSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2010-04 via Sheu et al. 2010 meta-analytic path analysis)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
