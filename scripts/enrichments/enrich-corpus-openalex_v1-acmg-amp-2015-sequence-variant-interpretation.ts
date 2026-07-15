// Enrichment: post-publication epistemic arc for the ACMG/AMP 2015 sequence-variant
// interpretation guideline.
//
// Claim: cmpm6hkbc2ikssaer22pwn610 (openalex_v1, W2051978340)
//   "Standards and guidelines for the interpretation of sequence variants: a joint consensus
//   recommendation of the American College of Medical Genetics and Genomics and the
//   Association for Molecular Pathology" — Richards et al., Genetics in Medicine 2015;17:405-424.
//   DOI 10.1038/gim.2015.30. Published 2015-03-05 (online); print May 2015.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2015-03-05) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern on the main guideline
//     (Crossref update-to/updated-by: none).
//   - RECORDED -> CONTESTED: Amendola et al. (Am J Hum Genet 2016;98:1067-1076,
//     DOI 10.1016/j.ajhg.2016.03.024) had nine CSER-consortium laboratories apply the
//     ACMG/AMP guidelines to 99 variants and found only 34% inter-laboratory concordance
//     before consensus review. This is a specific, dated empirical demonstration that the
//     framework as published did not yet deliver the reproducible classification it promised,
//     placing its central standardization claim in active dispute.
//   - CONTESTED -> SETTLED: Tavtigian et al. (Genet Med 2018;20:1054-1060,
//     DOI 10.1038/gim.2017.210) modeled the ACMG/AMP combining rules as a naive Bayesian
//     classifier and showed they are internally consistent and compatible with quantitative
//     Bayesian reasoning (with two minor combinations reclassified). Adopted by the ClinGen
//     Sequence Variant Interpretation Working Group, this reconciled the criteria on a rigorous
//     probabilistic footing and, alongside consensus-driven concordance gains, vindicated the
//     framework as the field standard in the expert literature.
//
// Idempotent: upserts source on externalId and each status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-acmg-amp-2015-sequence-variant-interpretation.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm6hkbc2ikssaer22pwn610'

async function main() {
  // ── RECORDED -> CONTESTED: Amendola et al. inter-laboratory concordance study (2016) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:amendola-2016-acmg-amp-concordance' },
    create: {
      externalId: 'src:amendola-2016-acmg-amp-concordance',
      name: 'Amendola LM, et al. Performance of ACMG-AMP Variant-Interpretation Guidelines among Nine Laboratories in the Clinical Sequencing Exploratory Research Consortium. American Journal of Human Genetics 2016;98(6):1067-1076. DOI 10.1016/j.ajhg.2016.03.024.',
      url: 'https://doi.org/10.1016/j.ajhg.2016.03.024',
      publishedAt: new Date('2016-06-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Amendola LM, et al. Performance of ACMG-AMP Variant-Interpretation Guidelines among Nine Laboratories in the Clinical Sequencing Exploratory Research Consortium. American Journal of Human Genetics 2016;98(6):1067-1076. DOI 10.1016/j.ajhg.2016.03.024.',
      url: 'https://doi.org/10.1016/j.ajhg.2016.03.024',
      publishedAt: new Date('2016-06-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2016-06-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-06-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        'Amendola et al. (Am J Hum Genet 2016;98:1067-1076) had nine CSER-consortium laboratories apply the ACMG/AMP guidelines to 99 variants and found only 34% concordance across laboratories before consensus review. This specific, dated empirical result showed the framework as published did not yet deliver the reproducible classification it promised, putting its central standardization claim in active expert dispute: RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-06-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  // ── CONTESTED -> SETTLED: Tavtigian et al. Bayesian reconciliation of the criteria (2018) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:tavtigian-2018-acmg-amp-bayesian' },
    create: {
      externalId: 'src:tavtigian-2018-acmg-amp-bayesian',
      name: 'Tavtigian SV, et al. Modeling the ACMG/AMP variant classification guidelines as a Bayesian classification framework. Genetics in Medicine 2018;20(9):1054-1060. DOI 10.1038/gim.2017.210.',
      url: 'https://doi.org/10.1038/gim.2017.210',
      publishedAt: new Date('2018-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Tavtigian SV, et al. Modeling the ACMG/AMP variant classification guidelines as a Bayesian classification framework. Genetics in Medicine 2018;20(9):1054-1060. DOI 10.1038/gim.2017.210.',
      url: 'https://doi.org/10.1038/gim.2017.210',
      publishedAt: new Date('2018-09-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2018-09-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2018-09-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
      reason:
        'Tavtigian et al. (Genet Med 2018;20:1054-1060) modeled the ACMG/AMP combining rules as a naive Bayesian classifier and showed them internally consistent and compatible with quantitative Bayesian reasoning (only two combinations reclassified). Adopted by the ClinGen Sequence Variant Interpretation Working Group, this placed the criteria on a rigorous probabilistic footing and, with consensus-driven concordance gains, vindicated the framework as the field standard: CONTESTED -> SETTLED.',
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2018-09-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED @ 2016-06, CONTESTED -> SETTLED @ 2018-09)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
