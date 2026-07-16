// Enrichment: post-publication trajectory for Dowell, Haegerich & Chou (2016),
// "CDC Guideline for Prescribing Opioids for Chronic Pain—United States, 2016", JAMA 315(15):1624-1645.
// Claim: cmply4zuw00g9saih9yedfp7n (openalex_v1, W2296986887, DOI 10.1001/jama.2016.1464)
//
// Baseline ClaimStatusHistory row (null -> RECORDED at 2016-03-15) already exists.
// This script adds the two verified post-publication adjudications:
//   RECORDED -> CONTESTED (2019-06-13) — the original guideline authors' NEJM Perspective
//     "No Shortcuts to Safer Opioid Prescribing", acknowledging widespread misapplication
//     (abrupt tapering, hard dose limits, denial of care) causing patient harm.
//   CONTESTED -> SETTLED (2022-11-04) — CDC's 2022 Clinical Practice Guideline (MMWR
//     Recomm Rep 71:RR-3), which superseded and updated the 2016 guideline: it reaffirmed
//     the core evidence (limited long-term opioid efficacy; serious risks) while revising
//     the specific thresholds to correct misapplication, re-establishing institutional consensus.
//
// No retraction or expression of concern exists (CrossRef update-to / updated-by: none).
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cdc-opioid-guideline-2016.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply4zuw00g9saih9yedfp7n'

async function main() {
  // ── RECORDED -> CONTESTED: 2019 NEJM Perspective by the original authors ──
  await prisma.source.upsert({
    where: { externalId: 'src:no-shortcuts-safer-opioid-prescribing-2019' },
    create: {
      externalId: 'src:no-shortcuts-safer-opioid-prescribing-2019',
      name: 'Dowell, Haegerich & Chou (2019), "No Shortcuts to Safer Opioid Prescribing", New England Journal of Medicine 380:2285-2287',
      url: 'https://doi.org/10.1056/NEJMp1904190',
      publishedAt: new Date('2019-06-13'),
      methodologyType: 'commentary',
    },
    update: {
      name: 'Dowell, Haegerich & Chou (2019), "No Shortcuts to Safer Opioid Prescribing", New England Journal of Medicine 380:2285-2287',
      url: 'https://doi.org/10.1056/NEJMp1904190',
      publishedAt: new Date('2019-06-13'),
      methodologyType: 'commentary',
    },
  })

  const contestedAt = new Date('2019-06-13')
  const contestedSlug = `${CLAIM_ID}-CONTESTED-${contestedAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: contestedSlug },
    create: {
      id: contestedSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: contestedAt,
      datePrecision: 'DAY',
      reason:
        'Three years after issuing the guideline, its own authors published "No Shortcuts to Safer Opioid Prescribing" in NEJM, warning that the recommendations were being widely misapplied \u2014 as hard dose limits, mandatory abrupt tapers, and grounds to deny care \u2014 in ways that harmed patients and were never intended. Alongside FDA and HHS warnings the same period, this marked a public, expert-led contest over the guideline\u2019s validity as applied. The core evidence was not retracted, but its standing became actively disputed.',
      sourceExternalId: 'src:no-shortcuts-safer-opioid-prescribing-2019',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: contestedAt,
      datePrecision: 'DAY',
      reason:
        'Three years after issuing the guideline, its own authors published "No Shortcuts to Safer Opioid Prescribing" in NEJM, warning that the recommendations were being widely misapplied \u2014 as hard dose limits, mandatory abrupt tapers, and grounds to deny care \u2014 in ways that harmed patients and were never intended. Alongside FDA and HHS warnings the same period, this marked a public, expert-led contest over the guideline\u2019s validity as applied. The core evidence was not retracted, but its standing became actively disputed.',
      sourceExternalId: 'src:no-shortcuts-safer-opioid-prescribing-2019',
    },
  })

  // ── CONTESTED -> SETTLED: CDC's 2022 updated Clinical Practice Guideline supersedes 2016 ──
  await prisma.source.upsert({
    where: { externalId: 'src:cdc-clinical-practice-guideline-opioids-2022' },
    create: {
      externalId: 'src:cdc-clinical-practice-guideline-opioids-2022',
      name: 'Dowell, Ragan, Jones, Baldwin & Chou (2022), "CDC Clinical Practice Guideline for Prescribing Opioids for Pain \u2014 United States, 2022", MMWR Recommendations and Reports 71(RR-3):1-95',
      url: 'https://doi.org/10.15585/mmwr.rr7103a1',
      publishedAt: new Date('2022-11-04'),
      methodologyType: 'guideline',
    },
    update: {
      name: 'Dowell, Ragan, Jones, Baldwin & Chou (2022), "CDC Clinical Practice Guideline for Prescribing Opioids for Pain \u2014 United States, 2022", MMWR Recommendations and Reports 71(RR-3):1-95',
      url: 'https://doi.org/10.15585/mmwr.rr7103a1',
      publishedAt: new Date('2022-11-04'),
      methodologyType: 'guideline',
    },
  })

  const settledAt = new Date('2022-11-04')
  const settledSlug = `${CLAIM_ID}-SETTLED-${settledAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: settledAt,
      datePrecision: 'DAY',
      reason:
        'The CDC issued its 2022 Clinical Practice Guideline for Prescribing Opioids for Pain (MMWR Recomm Rep 71:RR-3), formally superseding and updating the 2016 guideline. It reaffirmed the central findings \u2014 limited evidence for long-term opioid efficacy and serious risks including opioid use disorder and overdose \u2014 while replacing the misapplied numeric dose thresholds with individualized guidance. This institutional re-issuance resolved the contest by re-establishing the recommendations as settled clinical consensus in corrected form.',
      sourceExternalId: 'src:cdc-clinical-practice-guideline-opioids-2022',
    },
    update: {
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: settledAt,
      datePrecision: 'DAY',
      reason:
        'The CDC issued its 2022 Clinical Practice Guideline for Prescribing Opioids for Pain (MMWR Recomm Rep 71:RR-3), formally superseding and updating the 2016 guideline. It reaffirmed the central findings \u2014 limited evidence for long-term opioid efficacy and serious risks including opioid use disorder and overdose \u2014 while replacing the misapplied numeric dose thresholds with individualized guidance. This institutional re-issuance resolved the contest by re-establishing the recommendations as settled clinical consensus in corrected form.',
      sourceExternalId: 'src:cdc-clinical-practice-guideline-opioids-2022',
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +2 transitions (RECORDED -> CONTESTED 2019-06-13, CONTESTED -> SETTLED 2022-11-04)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
