// Enrichment: post-publication epistemic arc for Zhou et al. 2020, the Wuhan
// COVID-19 clinical-course and mortality risk-factor cohort.
//
// Claim: cmply47vy002lsaih9su02hf4 (openalex_v1, W3009885589)
//   "Clinical course and risk factors for mortality of adult inpatients with
//    COVID-19 in Wuhan, China: a retrospective cohort study"
//   — Zhou F, Yu T, Du R, et al. The Lancet 2020;395(10229):1054-1062.
//   DOI 10.1016/S0140-6736(20)30566-3. PMID 32171076. Published 2020-03-11 (issue 2020-03).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2020-03 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - NO retraction and NO expression of concern. The paper is absent from the
//     Retraction Watch database, and PubMed records no RetractionIn marker. The only
//     post-publication corrections are two errata ("Department of Error", Lancet
//     2020;395(10229):1038; DOIs 10.1016/S0140-6736(20)30606-1 and
//     10.1016/S0140-6736(20)30638-3, both 2020-03-28) — minor data/labeling
//     corrections that do NOT contest the validity of the core finding, so they are
//     recorded here as context and NOT as a CONTESTED transition.
//   - RECORDED -> SETTLED: the paper's core finding — that older age, higher SOFA
//     score, and elevated D-dimer (>1 μg/mL) on admission are independent risk factors
//     for in-hospital mortality — was adjudicated and vindicated by subsequent
//     systematic review and meta-analysis. Yang J, Jin M, Luo J, Gan H, Chen K, Li W,
//     et al. "Risk factors for predicting mortality of COVID-19 patients: A systematic
//     review and meta-analysis" (PLoS ONE 2020;15(11):e0243124, DOI
//     10.1371/journal.pone.0243124, PMID 33253244; published 2020-11-30) pooled 31
//     studies / 9,407 patients and confirmed elevated D-dimer (along with leukocytosis,
//     LDH, procalcitonin, ferritin, and lymphopenia) as an independent predictor of
//     mortality — the distinctive prognostic markers Zhou et al. first quantified.
//     There was never a contest phase, so this is a direct RECORDED -> SETTLED.
//     Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-zhou-2020-covid19-mortality-wuhan.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply47vy002lsaih9su02hf4'

async function main() {
  // ── RECORDED -> SETTLED: 2020 meta-analysis adjudicates the mortality risk factors ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:yang-2020-covid-mortality-riskfactors-metaanalysis' },
    create: {
      externalId: 'src:yang-2020-covid-mortality-riskfactors-metaanalysis',
      name: 'Yang J, Jin M, Luo J, Gan H, Chen K, Li W, et al. Risk factors for predicting mortality of COVID-19 patients: A systematic review and meta-analysis. PLoS ONE 2020;15(11):e0243124. DOI 10.1371/journal.pone.0243124. PMID 33253244.',
      url: 'https://doi.org/10.1371/journal.pone.0243124',
      publishedAt: new Date('2020-11-30'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Yang J, Jin M, Luo J, Gan H, Chen K, Li W, et al. Risk factors for predicting mortality of COVID-19 patients: A systematic review and meta-analysis. PLoS ONE 2020;15(11):e0243124. DOI 10.1371/journal.pone.0243124. PMID 33253244.',
      url: 'https://doi.org/10.1371/journal.pone.0243124',
      publishedAt: new Date('2020-11-30'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2020-11-30`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-11-30'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
      reason:
        "Zhou et al.'s core finding — that older age, higher SOFA score, and elevated admission D-dimer (>1 μg/mL) are independent risk factors for in-hospital COVID-19 mortality — was adjudicated and vindicated by systematic review and meta-analysis. Yang et al. (PLoS ONE 2020;15(11):e0243124) pooled 31 studies / 9,407 patients and confirmed elevated D-dimer (with leukocytosis, LDH, procalcitonin, ferritin, and lymphopenia) as an independent predictor of mortality. With no retraction, no expression of concern, and no failed replication, this meta-analysis moves the finding RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-11-30'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2020-11-30, Yang et al. mortality risk-factor meta-analysis)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
