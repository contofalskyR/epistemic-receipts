// Enrichment: post-publication epistemic arc for the 2016 Breast Care review of
// PD-1/PD-L1 immune checkpoint blockade in breast cancer.
//
// Claim: cmply43rw000lsaihz6dsdps0 (openalex_v1, W2560367415)
//   "Immune checkpoint inhibition represents a major recent breakthrough in the treatment
//   of malignant diseases including breast cancer. Blocking the programmed death receptor-1
//   (PD-1) and its ligand, PD-L1, has shown impressive antitumor activity and may lead to
//   durable long-term disease control, especially in the triple-negative subtypes of breast
//   cancer (TNBC) ..." — Hartkopf AD, Taran F-A, Wallwiener M, Walter CB, Krämer B,
//   Grischke E-M, Brucker SY. "PD-1 and PD-L1 Immune Checkpoint Blockade to Treat Breast
//   Cancer." Breast Care 2016;11(6):385-390. DOI 10.1159/000453569.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2016 publication) already
// exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref):
//   - No retraction and no expression of concern on the review (Crossref is-retracted:
//     none; update-to / updated-by: null).
//   - RECORDED -> SETTLED: The 2016 review's forward-looking claim — that PD-1/PD-L1 blockade
//     yields impressive antitumor activity and durable disease control, "especially in TNBC" —
//     was subsequently vindicated by a pivotal phase-3 randomised controlled trial. KEYNOTE-522
//     (Schmid P, et al. "Pembrolizumab for Early Triple-Negative Breast Cancer." N Engl J Med
//     2020;382:810-821, DOI 10.1056/NEJMoa1910549) showed that adding pembrolizumab (anti-PD-1)
//     to neoadjuvant chemotherapy significantly increased the pathologic complete response rate
//     in early-stage TNBC. The durability of that benefit was confirmed by the trial's
//     event-free-survival readout (Schmid P, et al. N Engl J Med 2022;386:556-567, DOI
//     10.1056/NEJMoa2112651) and later overall-survival results, and the regimen received full
//     (non-accelerated) FDA approval for high-risk early-stage TNBC on 2021-07-26 and entry
//     into standard-of-care guidelines. This confirmatory RCT + regulatory/guideline adoption
//     settled checkpoint blockade as an established TNBC therapy.
//
//   Note: The first checkpoint indication in breast cancer — atezolizumab (anti-PD-L1) for
//   metastatic PD-L1+ TNBC — was withdrawn in the US on 2021-08-27 after the confirmatory
//   IMpassion131 trial failed. That reversal is drug/combination-specific, postdates the
//   settle above, and did not overturn the field consensus that PD-1/PD-L1 blockade is
//   standard of care in TNBC (via pembrolizumab); it is therefore recorded here as context,
//   not as a CONTESTED transition on this claim.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hartkopf-2016-pd1-pdl1-breast-cancer.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply43rw000lsaihz6dsdps0'

async function main() {
  // ── RECORDED -> SETTLED: KEYNOTE-522 pivotal RCT confirms PD-1 blockade benefit in TNBC ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:keynote-522-pembrolizumab-early-tnbc-2020' },
    create: {
      externalId: 'src:keynote-522-pembrolizumab-early-tnbc-2020',
      name: 'Schmid P, et al. Pembrolizumab for Early Triple-Negative Breast Cancer (KEYNOTE-522). New England Journal of Medicine 2020;382:810-821. DOI 10.1056/NEJMoa1910549. Durability confirmed in the event-free-survival readout (N Engl J Med 2022;386:556-567, DOI 10.1056/NEJMoa2112651); regimen received full FDA approval for high-risk early-stage TNBC on 2021-07-26.',
      url: 'https://doi.org/10.1056/NEJMoa1910549',
      publishedAt: new Date('2020-02-27'),
      methodologyType: 'primary',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Schmid P, et al. Pembrolizumab for Early Triple-Negative Breast Cancer (KEYNOTE-522). New England Journal of Medicine 2020;382:810-821. DOI 10.1056/NEJMoa1910549. Durability confirmed in the event-free-survival readout (N Engl J Med 2022;386:556-567, DOI 10.1056/NEJMoa2112651); regimen received full FDA approval for high-risk early-stage TNBC on 2021-07-26.',
      url: 'https://doi.org/10.1056/NEJMoa1910549',
      publishedAt: new Date('2020-02-27'),
      methodologyType: 'primary',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2020-02-27`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-02-27'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
      reason:
        "The 2016 review's forward-looking claim — that PD-1/PD-L1 blockade yields impressive antitumor activity and durable disease control, especially in TNBC — was confirmed by the pivotal phase-3 KEYNOTE-522 trial (N Engl J Med 2020;382:810-821), in which adding the anti-PD-1 antibody pembrolizumab to neoadjuvant chemotherapy significantly raised the pathologic complete response rate in early-stage TNBC. The durability was borne out by the trial's event-free-survival readout (NEJM 2022) and later overall-survival results, and the regimen won full FDA approval for high-risk early-stage TNBC on 2021-07-26 and entered standard-of-care guidelines. This confirmatory RCT plus regulatory and guideline adoption settled checkpoint blockade as an established TNBC therapy: RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2020-02-27'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2020-02-27, KEYNOTE-522)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
