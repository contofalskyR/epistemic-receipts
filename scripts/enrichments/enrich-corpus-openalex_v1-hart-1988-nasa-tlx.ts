// Enrichment: post-publication epistemic arc for the 1988 NASA-TLX paper.
//
// Claim: cmplxwxuj05x1sa7fm7onj69d (openalex_v1, W2157289187)
//   "Development of NASA-TLX (Task Load Index): Results of Empirical and
//   Theoretical Research" — Hart SG, Staveland LE. In: Hancock PA, Meshkati N,
//   eds. Human Mental Workload (Advances in Psychology, vol. 52). Amsterdam:
//   North-Holland; 1988:139-183. Published 1988. DOI 10.1016/s0166-4115(08)62386-9.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1988-01-01
// publication) already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern (Crossref carries no update-to /
//     updated-by / crossmark markers; Retraction Watch / PubMed: none). The DOI
//     resolves (200 -> sciencedirect via doi.org).
//   - RECORDED -> SETTLED: NASA-TLX became the de facto standard multidimensional
//     subjective workload-assessment instrument across aviation, human factors,
//     healthcare, and HCI. Its validity and two decades of accumulated validation
//     evidence were adjudicated by Sandra G. Hart, "NASA-Task Load Index (NASA-TLX);
//     20 Years Later," Proceedings of the Human Factors and Ergonomics Society
//     Annual Meeting 2006;50(9):904-908 (DOI 10.1177/154193120605000909). That
//     retrospective review synthesised the corpus of studies that had adopted and
//     validated the instrument, documenting its widespread adoption and confirming
//     the empirical/theoretical claims of the 1988 development paper as settled
//     field consensus. Community EXPERT_LITERATURE.
//     (The review's doi.org link is bot-blocked by the publisher (HTTP 403); its
//     Crossref record resolves (HTTP 200) and confirms identity, so the Crossref
//     work URL is used as the verified source link.)
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-hart-1988-nasa-tlx.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplxwxuj05x1sa7fm7onj69d'

async function main() {
  // ── RECORDED -> SETTLED: Hart 2006 "20 Years Later" review adjudicates NASA-TLX ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:hart-2006-nasa-tlx-20-years-later' },
    create: {
      externalId: 'src:hart-2006-nasa-tlx-20-years-later',
      name: 'Hart SG. NASA-Task Load Index (NASA-TLX); 20 Years Later. Proceedings of the Human Factors and Ergonomics Society Annual Meeting 2006;50(9):904-908. DOI 10.1177/154193120605000909.',
      url: 'https://api.crossref.org/works/10.1177/154193120605000909',
      publishedAt: new Date('2006-10-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Hart SG. NASA-Task Load Index (NASA-TLX); 20 Years Later. Proceedings of the Human Factors and Ergonomics Society Annual Meeting 2006;50(9):904-908. DOI 10.1177/154193120605000909.',
      url: 'https://api.crossref.org/works/10.1177/154193120605000909',
      publishedAt: new Date('2006-10-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2006-10-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2006-10-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
      reason:
        "NASA-TLX became the de facto standard multidimensional subjective workload-assessment instrument across aviation, human factors, healthcare, and HCI. Its validity and the accumulated validation evidence of two decades of use were adjudicated by Sandra G. Hart, 'NASA-Task Load Index (NASA-TLX); 20 Years Later' (Proc. HFES Annual Meeting 2006;50(9):904-908, DOI 10.1177/154193120605000909), a retrospective review that synthesised the corpus of studies adopting and validating the instrument and documented its widespread adoption. This adjudicating review confirms the empirical/theoretical claims of the 1988 development paper as settled field consensus: RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2006-10-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2006-10, Hart 2006 "20 Years Later" review)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
