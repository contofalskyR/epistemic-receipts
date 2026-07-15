// Enrichment: post-publication epistemic trajectory for the 1999 PHQ validation study.
//
// Claim cmpm148y30s81sat0qsvb8abh — Spitzer, Kroenke & Williams,
// "Validation and Utility of a Self-report Version of PRIME-MD: The PHQ Primary
// Care Study," JAMA 1999;282(18):1737-1744 (DOI 10.1001/jama.282.18.1737).
//
// The baseline row (fromAxis=null -> RECORDED at 1999-11-10) already exists and is
// NOT duplicated here. This script adds the two post-publication transitions:
//
//   RECORDED -> CONTESTED  2012-02-21  Manea, Gilbody & McMillan (CMAJ) meta-analysis
//                                      found the "optimal" PHQ-9 cut-off ranged 7-15
//                                      across studies, challenging uniform use of the
//                                      recommended >=10 threshold for screening.
//   CONTESTED -> SETTLED   2019-04-09  Levis, Benedetti & Thombs (BMJ) individual
//                                      participant data meta-analysis (47 studies,
//                                      n=17,357) established cut-off >=10 yields
//                                      sensitivity 0.85 / specificity 0.85, adjudicating
//                                      the accuracy question.
//
// Sources verified via Crossref (HTTP 200, correct title/authors/date) 2026-07-15.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-phq-prime-md-1999-screening-validity.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm148y30s81sat0qsvb8abh'

async function main() {
  // ── Transition 1: RECORDED -> CONTESTED (Manea et al. 2012 CMAJ meta-analysis) ──
  await prisma.source.upsert({
    where: { externalId: 'src:manea-2012-phq9-cutoff-cmaj' },
    create: {
      externalId: 'src:manea-2012-phq9-cutoff-cmaj',
      name: 'Manea L, Gilbody S, McMillan D. Optimal cut-off score for diagnosing depression with the Patient Health Questionnaire (PHQ-9): a meta-analysis. CMAJ. 2012;184(3):E191-E196.',
      url: 'https://doi.org/10.1503/cmaj.110829',
      publishedAt: new Date('2012-02-21'),
      methodologyType: 'derivative',
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-CONTESTED-2012-02-21` },
    create: {
      id: `${CLAIM_ID}-CONTESTED-2012-02-21`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2012-02-21'),
      datePrecision: 'DAY',
      reason:
        'A meta-analysis by Manea, Gilbody & McMillan (CMAJ 2012) pooling PHQ-9 diagnostic-accuracy studies found the cut-off scores used to define depression ranged from 7 to 15 across the literature, with substantial heterogeneity in performance. It challenged the uniform application of the recommended >=10 threshold underlying the original screening-validity claim, opening a methodological contest over how the self-report PHQ should be scored in practice.',
      sourceExternalId: 'src:manea-2012-phq9-cutoff-cmaj',
    },
    update: {},
  })

  // ── Transition 2: CONTESTED -> SETTLED (Levis et al. 2019 BMJ IPD meta-analysis) ──
  await prisma.source.upsert({
    where: { externalId: 'src:levis-2019-phq9-ipdma-bmj' },
    create: {
      externalId: 'src:levis-2019-phq9-ipdma-bmj',
      name: 'Levis B, Benedetti A, Thombs BD. Accuracy of Patient Health Questionnaire-9 (PHQ-9) for screening to detect major depression: individual participant data meta-analysis. BMJ. 2019;365:l1476.',
      url: 'https://doi.org/10.1136/bmj.l1476',
      publishedAt: new Date('2019-04-09'),
      methodologyType: 'derivative',
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2019-04-09` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2019-04-09`,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2019-04-09'),
      datePrecision: 'DAY',
      reason:
        'The individual participant data meta-analysis by Levis, Benedetti & Thombs (BMJ 2019), synthesizing 47 primary studies (17,357 participants, 2,312 with major depression) against validated diagnostic-interview references, established that the PHQ-9 at the standard cut-off of >=10 achieves sensitivity 0.85 and specificity 0.85. By adjudicating the threshold dispute with pooled patient-level data, it settled the self-report PHQ as a validated depression screening instrument, vindicating the original 1999 utility claim.',
      sourceExternalId: 'src:levis-2019-phq9-ipdma-bmj',
    },
    update: {},
  })

  console.log('Enrichment complete: 2 transitions upserted for claim', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
