// Enrichment: post-publication epistemic arc for the RoB 2 revised Cochrane
// risk-of-bias tool for randomised trials.
//
// Claim: cmpm9gbij3wmssaerxk0q2ky3 (openalex_v1, W2970684805)
//   "Assessment of risk of bias is regarded as an essential component of a systematic
//   review on the effects of an intervention. The most commonly used tool for randomised
//   trials is the Cochrane risk-of-bias tool. We updated the tool ..." — Sterne JAC, et al.
//   "RoB 2: a revised tool for assessing risk of bias in randomised trials." BMJ
//   2019;366:l4898. DOI 10.1136/bmj.l4898. Published 2019-08-28.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2019-08-28) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern on the main paper
//     (Crossref is-retracted: none; update-to / updated-by: null).
//   - RECORDED -> CONTESTED: Minozzi et al. (J Clin Epidemiol 2020;126:37-44,
//     DOI 10.1016/j.jclinepi.2020.06.015, PMID 32562833) had four raters independently
//     apply RoB 2 to the primary outcome of 70 randomised trials and found low interrater
//     reliability (Fleiss' kappa poor for the overall judgement and several domains) plus
//     substantial challenges in application. This specific, dated empirical result directly
//     disputed the paper's central premise that the revised tool improves the clarity and
//     accuracy of bias assessment, placing that claim in active expert dispute.
//   - CONTESTED -> SETTLED: Flemyng et al. "Risk of Bias 2 in Cochrane Reviews: a phased
//     approach for the introduction of new methodology" (Cochrane Database Syst Rev,
//     editorial ED000148, DOI 10.1002/14651858.ED000148, 2020-11-19) formally established
//     RoB 2 as the risk-of-bias tool Cochrane Reviews are expected to use going forward,
//     with editorial support during a managed roll-out. This institutional adoption by the
//     body that authors the tool settled RoB 2 as the field-standard successor to the
//     original Cochrane risk-of-bias tool despite the outstanding reliability debate.
//
// Idempotent: upserts source on externalId and each status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cochrane-risk-of-bias-tool-2011.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm9gbij3wmssaerxk0q2ky3'

async function main() {
  // ── RECORDED -> CONTESTED: Minozzi et al. low interrater reliability critique (2020) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:minozzi-2020-rob2-interrater-reliability' },
    create: {
      externalId: 'src:minozzi-2020-rob2-interrater-reliability',
      name: 'Minozzi S, et al. The revised Cochrane risk of bias tool for randomized trials (RoB 2) showed low interrater reliability and challenges in its application. Journal of Clinical Epidemiology 2020;126:37-44. DOI 10.1016/j.jclinepi.2020.06.015. PMID 32562833.',
      url: 'https://doi.org/10.1016/j.jclinepi.2020.06.015',
      publishedAt: new Date('2020-10-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Minozzi S, et al. The revised Cochrane risk of bias tool for randomized trials (RoB 2) showed low interrater reliability and challenges in its application. Journal of Clinical Epidemiology 2020;126:37-44. DOI 10.1016/j.jclinepi.2020.06.015. PMID 32562833.',
      url: 'https://doi.org/10.1016/j.jclinepi.2020.06.015',
      publishedAt: new Date('2020-10-01'),
      methodologyType: 'derivative',
    },
  })

  const contestedSlug = `${CLAIM_ID}-CONTESTED-2020-10-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-10-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
      reason:
        'Minozzi et al. (J Clin Epidemiol 2020;126:37-44) had four raters independently apply RoB 2 to the primary outcome of 70 randomised trials and found low interrater reliability (Fleiss\' kappa poor for the overall judgement and several domains) and substantial difficulty in application. This specific, dated empirical result disputed the paper\'s central claim that the revised tool makes bias assessment clearer and more accurate, putting it in active expert dispute: RECORDED -> CONTESTED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-10-01'),
      datePrecision: 'MONTH',
      sourceId: contestSource.id,
    },
  })

  // ── CONTESTED -> SETTLED: Cochrane institutional adoption of RoB 2 (2020) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:cochrane-2020-rob2-phased-adoption' },
    create: {
      externalId: 'src:cochrane-2020-rob2-phased-adoption',
      name: 'Flemyng E, et al. Risk of Bias 2 in Cochrane Reviews: a phased approach for the introduction of new methodology (editorial). Cochrane Database of Systematic Reviews 2020;ED000148. DOI 10.1002/14651858.ED000148.',
      url: 'https://doi.org/10.1002/14651858.ED000148',
      publishedAt: new Date('2020-11-19'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Flemyng E, et al. Risk of Bias 2 in Cochrane Reviews: a phased approach for the introduction of new methodology (editorial). Cochrane Database of Systematic Reviews 2020;ED000148. DOI 10.1002/14651858.ED000148.',
      url: 'https://doi.org/10.1002/14651858.ED000148',
      publishedAt: new Date('2020-11-19'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2020-11-19`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2020-11-19'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
      reason:
        'The Cochrane editorial "Risk of Bias 2 in Cochrane Reviews: a phased approach" (Cochrane Database Syst Rev 2020;ED000148) formally established RoB 2 as the risk-of-bias tool Cochrane Reviews are expected to use going forward, with a managed roll-out and editorial support. This institutional adoption by the body that authors the tool settled RoB 2 as the field-standard successor to the original Cochrane risk-of-bias tool despite the outstanding reliability debate: CONTESTED -> SETTLED.',
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2020-11-19'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED @ 2020-10, CONTESTED -> SETTLED @ 2020-11-19)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
