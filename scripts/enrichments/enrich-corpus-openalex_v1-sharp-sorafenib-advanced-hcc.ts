// Enrichment: post-publication epistemic arc for the SHARP trial of sorafenib in advanced HCC.
//
// Claim: cmpmbxfv652fgsaerm05n283d (openalex_v1, W1971837077)
//   "Sorafenib in Advanced Hepatocellular Carcinoma" — Llovet JM, Ricci S, Mazzaferro V, et al.
//   (SHARP Investigators Study Group), New England Journal of Medicine 2008;359(4):378-390.
//   DOI 10.1056/NEJMoa0708857. The phase 3, placebo-controlled trial reported that sorafenib
//   prolonged median overall survival in advanced hepatocellular carcinoma (10.7 vs 7.9 months).
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 2008-07-23) already exists
// and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15):
//   - No retraction and no expression of concern. Crossref shows no update-to/updated-by relation
//     (only a "has-review" relation); OpenAlex is_retracted=false.
//   - No failed replication: SHARP was the definitive positive phase 3 trial; sorafenib remained
//     the first (and for a decade the only) systemic agent shown to extend survival in advanced HCC.
//   - RECORDED -> SETTLED: The EASL and the European Organisation for Research and Treatment of
//     Cancer (EORTC) issued joint clinical practice guidelines, "EASL-EORTC Clinical Practice
//     Guidelines: Management of hepatocellular carcinoma" (J Hepatol 2012;56(4):908-943,
//     DOI 10.1016/j.jhep.2011.12.001), which — on the strength of SHARP — recommended sorafenib as
//     the standard first-line systemic therapy for patients with advanced (BCLC stage C) HCC and
//     well-preserved liver function. This institutional adoption by the issuing specialty societies
//     ratifies the trial finding as field consensus: RECORDED -> SETTLED (INSTITUTIONAL).
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sharp-sorafenib-advanced-hcc.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpmbxfv652fgsaerm05n283d'

async function main() {
  // ── RECORDED -> SETTLED: EASL-EORTC 2012 HCC guidelines adopt sorafenib as first-line standard ──
  const guidelineSource = await prisma.source.upsert({
    where: { externalId: 'src:easl-eortc-2012-hcc-guidelines' },
    create: {
      externalId: 'src:easl-eortc-2012-hcc-guidelines',
      name: 'European Association for the Study of the Liver & European Organisation for Research and Treatment of Cancer. EASL-EORTC Clinical Practice Guidelines: Management of hepatocellular carcinoma. Journal of Hepatology 2012;56(4):908-943. DOI 10.1016/j.jhep.2011.12.001.',
      url: 'https://doi.org/10.1016/j.jhep.2011.12.001',
      publishedAt: new Date('2012-04-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'European Association for the Study of the Liver & European Organisation for Research and Treatment of Cancer. EASL-EORTC Clinical Practice Guidelines: Management of hepatocellular carcinoma. Journal of Hepatology 2012;56(4):908-943. DOI 10.1016/j.jhep.2011.12.001.',
      url: 'https://doi.org/10.1016/j.jhep.2011.12.001',
      publishedAt: new Date('2012-04-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2012-04-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2012-04-01'),
      datePrecision: 'MONTH',
      sourceId: guidelineSource.id,
      reason:
        'The EASL and EORTC issued joint clinical practice guidelines for the management of hepatocellular carcinoma (J Hepatol 2012;56(4):908-943, DOI 10.1016/j.jhep.2011.12.001) that, on the strength of the SHARP trial, recommended sorafenib as the standard first-line systemic therapy for patients with advanced (BCLC stage C) HCC and preserved liver function. Adoption of the finding as standard of care by the issuing specialty societies ratifies it as field consensus: RECORDED -> SETTLED.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2012-04-01'),
      datePrecision: 'MONTH',
      sourceId: guidelineSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2012-04 via EASL-EORTC HCC guidelines)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
