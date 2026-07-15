// Enrichment: post-publication epistemic arc for the 1993 EORTC QLQ-C30 validation paper.
//
// Claim: cmply42o60003saihfod8hxdt (openalex_v1, W2167571044)
//   "The European Organization for Research and Treatment of Cancer QLQ-C30: A
//   Quality-of-Life Instrument for Use in International Clinical Trials in Oncology"
//   — Aaronson NK, Ahmedzai S, Bergman B, Bullinger M, Cull A, et al.
//   J Natl Cancer Inst 1993;85(5):365-376 (published 1993-03-03).
//   DOI 10.1093/jnci/85.5.365.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1993-03-03 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern (Crossref carries no update/crossmark
//     markers; Retraction Watch / PubMed: none). The DOI resolves (302 -> academic.oup.com).
//   - RECORDED -> SETTLED: The QLQ-C30 became the most widely used cancer-specific
//     health-related quality-of-life (HRQoL) instrument in international oncology trials.
//     Its psychometric properties (reliability and validity — the very claim of the 1993
//     field study) were adjudicated by the systematic review Luckett T, King MT, Butow PN,
//     Oguchi M, Rankin N, Price MA, et al., "Choosing between the EORTC QLQ-C30 and FACT-G
//     for measuring health-related quality of life in cancer clinical research: issues,
//     evidence and recommendations" (Annals of Oncology 2011;22(10):2179-2190,
//     DOI 10.1093/annonc/mdq721). That review synthesised the accumulated validation
//     evidence and concluded the QLQ-C30 is a psychometrically robust, well-validated
//     instrument, recommending it as one of the two instruments of choice for cancer
//     clinical research. This is the adjudicating document confirming the instrument's
//     reliability and validity as settled field consensus. Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-aaronson-1993-eortc-qlq-c30.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply42o60003saihfod8hxdt'

async function main() {
  // ── RECORDED -> SETTLED: Luckett 2011 systematic review adjudicates QLQ-C30 validity ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:luckett-2011-qlqc30-factg-systematic-review' },
    create: {
      externalId: 'src:luckett-2011-qlqc30-factg-systematic-review',
      name: 'Luckett T, King MT, Butow PN, Oguchi M, Rankin N, Price MA, et al. Choosing between the EORTC QLQ-C30 and FACT-G for measuring health-related quality of life in cancer clinical research: issues, evidence and recommendations. Annals of Oncology 2011;22(10):2179-2190. DOI 10.1093/annonc/mdq721.',
      url: 'https://doi.org/10.1093/annonc/mdq721',
      publishedAt: new Date('2011-10-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Luckett T, King MT, Butow PN, Oguchi M, Rankin N, Price MA, et al. Choosing between the EORTC QLQ-C30 and FACT-G for measuring health-related quality of life in cancer clinical research: issues, evidence and recommendations. Annals of Oncology 2011;22(10):2179-2190. DOI 10.1093/annonc/mdq721.',
      url: 'https://doi.org/10.1093/annonc/mdq721',
      publishedAt: new Date('2011-10-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2011-10-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2011-10-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
      reason:
        "The EORTC QLQ-C30 became the most widely used cancer-specific HRQoL instrument in international oncology trials. Its reliability and validity — the very properties reported in the 1993 field study — were adjudicated by the systematic review Luckett et al., 'Choosing between the EORTC QLQ-C30 and FACT-G' (Ann Oncol 2011;22(10):2179-2190), which synthesised the accumulated validation evidence and concluded the QLQ-C30 is a psychometrically robust, well-validated instrument, recommending it as one of the two instruments of choice for cancer clinical research. This adjudicating review confirms the instrument's validity as settled field consensus: RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2011-10-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2011-10, Luckett 2011 systematic review)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
