// Enrichment: post-publication epistemic arc for the 2021 ESC Heart Failure Guidelines.
//
// Claim: cmpmcn4025efasaeraawsn56a (openalex_v1, W3193598686)
//   "2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure"
//   — McDonagh TA, Metra M, Adamo M, et al., European Heart Journal 2021.
//   DOI 10.1093/eurheartj/ehab368. (The claim text is the ESC disclaimer boilerplate that
//   prefaces the guideline document; the underlying record is the guideline itself.)
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2021-06-11) already exists
// and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern (Crossref update-to/updated-by: none).
//   - No failed replication (the record is a clinical practice guideline, not an empirical finding).
//   - RECORDED -> SETTLED: The European Society of Cardiology — the issuing body — published the
//     "2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and
//     chronic heart failure" (Eur Heart J 2023;44(37):3627-3639, DOI 10.1093/eurheartj/ehad195,
//     PMID 37622666, published online 2023-08-25). This official update incorporated new landmark
//     trial evidence (notably SGLT2 inhibitors for HFpEF from EMPEROR-Preserved and DELIVER, plus
//     STRONG-HF and IRONMAN) and reaffirmed the 2021 document as the base, living standard of care
//     rather than retracting or overturning it. Institutional reaffirmation-and-refinement by the
//     guideline body settles the record as the field consensus: RECORDED -> SETTLED (INSTITUTIONAL).
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-esc-2021-heart-failure-guidelines.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpmcn4025efasaeraawsn56a'

async function main() {
  // ── RECORDED -> SETTLED: 2023 ESC Focused Update reaffirms & refines the 2021 guideline ──
  const updateSource = await prisma.source.upsert({
    where: { externalId: 'src:esc-2023-focused-update-heart-failure' },
    create: {
      externalId: 'src:esc-2023-focused-update-heart-failure',
      name: 'McDonagh TA, Metra M, Adamo M, et al. 2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure. European Heart Journal 2023;44(37):3627-3639. DOI 10.1093/eurheartj/ehad195. PMID 37622666.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/37622666/',
      publishedAt: new Date('2023-08-25'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'McDonagh TA, Metra M, Adamo M, et al. 2023 Focused Update of the 2021 ESC Guidelines for the diagnosis and treatment of acute and chronic heart failure. European Heart Journal 2023;44(37):3627-3639. DOI 10.1093/eurheartj/ehad195. PMID 37622666.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/37622666/',
      publishedAt: new Date('2023-08-25'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2023-08-25`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2023-08-25'),
      datePrecision: 'DAY',
      sourceId: updateSource.id,
      reason:
        'The European Society of Cardiology, the issuing body, published the 2023 Focused Update of the 2021 ESC Heart Failure Guidelines (Eur Heart J 2023;44(37):3627-3639, DOI 10.1093/eurheartj/ehad195). It incorporated new landmark-trial evidence (SGLT2 inhibitors for HFpEF from EMPEROR-Preserved and DELIVER, plus STRONG-HF and IRONMAN) and reaffirmed the 2021 document as the base, living standard of care rather than retracting or overturning it. This institutional reaffirmation-and-refinement adjudicates the guideline as the field consensus: RECORDED -> SETTLED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2023-08-25'),
      datePrecision: 'DAY',
      sourceId: updateSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2023-08-25 via 2023 ESC Focused Update)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
