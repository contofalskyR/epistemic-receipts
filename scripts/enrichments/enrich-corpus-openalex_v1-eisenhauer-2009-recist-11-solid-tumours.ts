// Enrichment: post-publication epistemic arc for the 2009 RECIST 1.1 guideline.
//
// Claim: cmply45u9001lsaih3cd8ymrq (openalex_v1, W2019607817)
//   "New response evaluation criteria in solid tumours: Revised RECIST guideline (version 1.1)"
//   — Eisenhauer EA, Therasse P, Bogaerts J, et al. European Journal of Cancer
//   2009;45(2):228-247 (published online 2008-12-27). DOI 10.1016/j.ejca.2008.10.026.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2008-12-27 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern (Retraction Watch / PubMed / publisher: none).
//   - RECORDED -> SETTLED: RECIST 1.1 was adopted essentially immediately as the field-standard
//     tumour-response endpoint for solid-tumour trials by academic groups and by regulators
//     (FDA/EMA). The authoritative RECIST Working Group itself then reaffirmed and formally
//     clarified the guideline in "RECIST 1.1—Update and clarification: From the RECIST committee"
//     (Schwartz LH, Litière S, de Vries E, Ford R, Gwyther S, Mandrekar S, et al. Eur J Cancer
//     2016;62:132-137, DOI 10.1016/j.ejca.2016.03.081, PMID 27189322; online 2016-05-14). That
//     committee update — clarifying target-lesion selection, the definition of stable disease,
//     and the role of FDG-PET, while leaving the core criteria intact — is the adjudicating
//     document confirming RECIST 1.1 as the settled, actively maintained consensus standard.
//     Community EXPERT_LITERATURE.
//
//   Note: A later RECIST Working Group consensus, iRECIST (Seymour L, et al. Lancet Oncol
//   2017;18:e143-e152, DOI 10.1016/S1470-2045(17)30074-8), *extends* RECIST 1.1 to
//   immunotherapy trials (pseudoprogression). It adapts, and is explicitly built on, RECIST 1.1
//   rather than contesting its validity within its scope, so it is recorded here as context and
//   NOT as a separate CONTESTED/REVERSED transition on this claim.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-eisenhauer-2009-recist-11-solid-tumours.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply45u9001lsaih3cd8ymrq'

async function main() {
  // ── RECORDED -> SETTLED: RECIST committee's own 2016 update/clarification reaffirms 1.1 ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:recist-committee-update-clarification-2016' },
    create: {
      externalId: 'src:recist-committee-update-clarification-2016',
      name: 'Schwartz LH, Litière S, de Vries E, Ford R, Gwyther S, Mandrekar S, et al. RECIST 1.1—Update and clarification: From the RECIST committee. European Journal of Cancer 2016;62:132-137. DOI 10.1016/j.ejca.2016.03.081. PMID 27189322.',
      url: 'https://doi.org/10.1016/j.ejca.2016.03.081',
      publishedAt: new Date('2016-05-14'),
      methodologyType: 'consensus',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Schwartz LH, Litière S, de Vries E, Ford R, Gwyther S, Mandrekar S, et al. RECIST 1.1—Update and clarification: From the RECIST committee. European Journal of Cancer 2016;62:132-137. DOI 10.1016/j.ejca.2016.03.081. PMID 27189322.',
      url: 'https://doi.org/10.1016/j.ejca.2016.03.081',
      publishedAt: new Date('2016-05-14'),
      methodologyType: 'consensus',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2016-05-14`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-05-14'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
      reason:
        "RECIST 1.1 became the field-standard tumour-response endpoint for solid-tumour trials and was adopted by regulators (FDA/EMA). The authoritative RECIST Working Group then reaffirmed and formally clarified the guideline in 'RECIST 1.1—Update and clarification: From the RECIST committee' (Eur J Cancer 2016;62:132-137), clarifying target-lesion selection, the definition of stable disease, and the role of FDG-PET while leaving the core criteria intact. That committee update is the adjudicating document confirming RECIST 1.1 as the settled, actively maintained consensus standard: RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-05-14'),
      datePrecision: 'DAY',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2016-05-14, RECIST committee update/clarification)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
