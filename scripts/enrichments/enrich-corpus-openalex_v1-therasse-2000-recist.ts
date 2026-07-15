// Enrichment: post-publication epistemic arc for the 2000 RECIST guidelines paper.
//
// Claim: cmplyipp4071rsaihlmnkme0d (openalex_v1, W2139248078)
//   "New Guidelines to Evaluate the Response to Treatment in Solid Tumors"
//   — Therasse P, Arbuck SG, Eisenhauer EA, Wanders J, et al.
//   J Natl Cancer Inst 2000;92(3):205-216 (published 2000-02-02).
//   DOI 10.1093/jnci/92.3.205. This is the paper that introduced the
//   Response Evaluation Criteria in Solid Tumours (RECIST), superseding the
//   older WHO/UICC bidimensional tumor-response criteria.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2000-02-02 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern (Crossref carries no update-to /
//     updated-by markers; Retraction Watch / PubMed: none). The DOI resolves
//     (302 -> academic.oup.com).
//   - RECORDED -> SETTLED: RECIST was revised and consolidated into RECIST 1.1
//     by Eisenhauer EA, Therasse P, Bogaerts J, Schwartz LH, et al., "New response
//     evaluation criteria in solid tumours: revised RECIST guideline (version 1.1)"
//     (European Journal of Cancer 2009;45(2):228-247, DOI 10.1016/j.ejca.2008.10.026).
//     Drawing on a warehouse analysis of >6,500 patients and >18,000 target lesions,
//     the 2009 revision refined the original criteria (unidimensional measurement,
//     max 5 target lesions / 2 per organ, revised progression and lymph-node rules)
//     while keeping the RECIST framework intact. RECIST/RECIST 1.1 became the settled
//     international standard for solid-tumor response assessment, adopted by the FDA,
//     EMA and virtually all oncology trials. This adjudicating revision confirms the
//     RECIST approach as settled field consensus. Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-therasse-2000-recist.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplyipp4071rsaihlmnkme0d'

async function main() {
  // ── RECORDED -> SETTLED: RECIST 1.1 (2009) revision consolidates the framework ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:eisenhauer-2009-recist-1-1' },
    create: {
      externalId: 'src:eisenhauer-2009-recist-1-1',
      name: 'Eisenhauer EA, Therasse P, Bogaerts J, Schwartz LH, Sargent D, Ford R, et al. New response evaluation criteria in solid tumours: revised RECIST guideline (version 1.1). European Journal of Cancer 2009;45(2):228-247. DOI 10.1016/j.ejca.2008.10.026.',
      url: 'https://doi.org/10.1016/j.ejca.2008.10.026',
      publishedAt: new Date('2009-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Eisenhauer EA, Therasse P, Bogaerts J, Schwartz LH, Sargent D, Ford R, et al. New response evaluation criteria in solid tumours: revised RECIST guideline (version 1.1). European Journal of Cancer 2009;45(2):228-247. DOI 10.1016/j.ejca.2008.10.026.',
      url: 'https://doi.org/10.1016/j.ejca.2008.10.026',
      publishedAt: new Date('2009-01-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2009-01-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-01-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
      reason:
        "The RECIST criteria introduced in this 2000 paper were revised and consolidated into RECIST 1.1 by Eisenhauer et al., 'New response evaluation criteria in solid tumours: revised RECIST guideline (version 1.1)' (Eur J Cancer 2009;45(2):228-247). Built on a warehouse analysis of over 6,500 patients and 18,000 target lesions, the 2009 revision refined the original rules (unidimensional measurement, a reduced maximum of five target lesions, and revised progression and lymph-node criteria) while preserving the RECIST framework. RECIST/RECIST 1.1 became the settled international standard for solid-tumor response assessment adopted by the FDA, EMA and essentially all oncology trials: RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-01-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2009-01, RECIST 1.1 revision)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
