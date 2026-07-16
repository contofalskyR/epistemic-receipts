// Enrichment: post-publication epistemic trajectory for the 2003 PNAS paper
// "Repeated observation of breast tumor subtypes in independent gene expression
// data sets" (Sørlie et al., PNAS 2003) — refining the intrinsic molecular
// subtypes of breast cancer (luminal, HER2/ERBB2-overexpressing, basal-like).
//
// Claim: cmplyfyyq05plsaihdx3f2zrs
// DOI:   https://doi.org/10.1073/pnas.0932692100
// OpenAlex: W2157840751
//
// Baseline row (fromAxis=null -> RECORDED at the 2003-06-26 publication) already
// exists; this script does NOT duplicate it.
//
// Post-publication arc (verified):
//   RECORDED -> SETTLED  (2011-08)
//   The intrinsic-subtype classification refined by this paper was adopted by the
//   St Gallen International Expert Consensus on the Primary Therapy of Early Breast
//   Cancer 2011 (Goldhirsch et al., Annals of Oncology, Aug 2011) as the framework
//   for tailoring systemic adjuvant therapy — moving the subtypes from a research
//   finding into a clinical-decision consensus standard. Community: INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sorlie-breast-tumor-intrinsic-subtypes.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-sorlie-breast-tumor-intrinsic-subtypes.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmplyfyyq05plsaihdx3f2zrs'

async function main() {
  // ── RECORDED -> SETTLED (St Gallen 2011 consensus) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:stgallen-2011-breast-cancer-subtypes-consensus' },
    create: {
      externalId: 'src:stgallen-2011-breast-cancer-subtypes-consensus',
      name: 'Goldhirsch A, Wood WC, Coates AS, Gelber RD, Thürlimann B, Senn H-J. Strategies for subtypes—dealing with the diversity of breast cancer: highlights of the St Gallen International Expert Consensus on the Primary Therapy of Early Breast Cancer 2011. Annals of Oncology 2011;22(8):1736–1747.',
      url: 'https://doi.org/10.1093/annonc/mdr304',
      publishedAt: new Date('2011-08-01'),
      methodologyType: 'derivative',
      ingestedBy: 'openalex_v1',
    },
    update: {
      name: 'Goldhirsch A, Wood WC, Coates AS, Gelber RD, Thürlimann B, Senn H-J. Strategies for subtypes—dealing with the diversity of breast cancer: highlights of the St Gallen International Expert Consensus on the Primary Therapy of Early Breast Cancer 2011. Annals of Oncology 2011;22(8):1736–1747.',
      url: 'https://doi.org/10.1093/annonc/mdr304',
      publishedAt: new Date('2011-08-01'),
      methodologyType: 'derivative',
    },
  })

  const slug = `${CLAIM_ID}-SETTLED-2011-08-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2011-08-01'),
      datePrecision: 'MONTH',
      reason:
        'The intrinsic molecular subtypes of breast cancer refined by this paper (luminal, HER2/ERBB2-overexpressing, basal-like) were adopted by the St Gallen International Expert Consensus on the Primary Therapy of Early Breast Cancer 2011 (Goldhirsch et al., Annals of Oncology, Aug 2011) as the organising framework for selecting systemic adjuvant therapy. The consensus panel used the subtype scheme — citing the intrinsic-subtype lineage (Perou 2000, Sørlie, Prat 2011, PAM50/Parker 2009) — to define treatment groups, moving the classification from a research finding into a clinical-decision standard. This marks field-consensus settling by an international expert body.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2011-08-01'),
      datePrecision: 'MONTH',
      reason:
        'The intrinsic molecular subtypes of breast cancer refined by this paper (luminal, HER2/ERBB2-overexpressing, basal-like) were adopted by the St Gallen International Expert Consensus on the Primary Therapy of Early Breast Cancer 2011 (Goldhirsch et al., Annals of Oncology, Aug 2011) as the organising framework for selecting systemic adjuvant therapy. The consensus panel used the subtype scheme — citing the intrinsic-subtype lineage (Perou 2000, Sørlie, Prat 2011, PAM50/Parker 2009) — to define treatment groups, moving the classification from a research finding into a clinical-decision standard. This marks field-consensus settling by an international expert body.',
      sourceId: source.id,
    },
  })

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Enriched ${CLAIM_ID}: RECORDED -> SETTLED (2011-08, St Gallen consensus)`)

  if (DRY_RUN) {
    console.log('[dry-run] rolling back — no writes committed')
    throw new Error('DRY_RUN')
  }
}

main()
  .catch((e) => {
    if (e.message !== 'DRY_RUN') {
      console.error(e)
      process.exit(1)
    }
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
