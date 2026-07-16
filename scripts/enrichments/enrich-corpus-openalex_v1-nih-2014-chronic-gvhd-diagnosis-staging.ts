// Enrichment: post-publication epistemic trajectory for the 2014 NIH Consensus
// Development Project Diagnosis and Staging Working Group Report on chronic
// graft-versus-host disease (Jagasia et al., Biol Blood Marrow Transplant, 2015).
//
// Claim: cmply5m5100rfsaih84em6gqe
// DOI:   https://doi.org/10.1016/j.bbmt.2014.12.001
// OpenAlex: W2379365975
// (Jagasia MH, et al. "NIH Consensus Development Project on Criteria for Clinical
//  Trials in Chronic GVHD: I. The 2014 Diagnosis and Staging Working Group Report."
//  Biol Blood Marrow Transplant. 2015;21(3):389-401. PMID 25529383, PMC4329079.)
//
// Baseline row (fromAxis=null -> RECORDED at 2014-12 publication) already exists;
// this script does NOT duplicate it.
//
// Post-publication arc (verified):
//   RECORDED -> SETTLED  (2021-07)
//   The 2014 report refined the NIH diagnostic and staging framework for chronic
//   GVHD for use in clinical trials. Six years later, the direct successor working
//   group — "IIa. The 2020 Clinical Implementation and Early Diagnosis Working Group
//   Report" (Kitko et al., Transplant Cell Ther, 2021) — took the 2014 diagnostic
//   criteria as the accepted standard and issued consensus recommendations to move
//   them from clinical-trial use into routine transplant care and early diagnosis.
//   This consolidated the 2014 diagnostic framework as settled field consensus.
//   Community: EXPERT_LITERATURE.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nih-2014-chronic-gvhd-diagnosis-staging.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nih-2014-chronic-gvhd-diagnosis-staging.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply5m5100rfsaih84em6gqe'

async function main() {
  // ── RECORDED -> SETTLED (2020 IIa Clinical Implementation & Early Diagnosis report, 2021) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:nih-cgvhd-2020-IIa-clinical-implementation-early-diagnosis' },
    create: {
      externalId: 'src:nih-cgvhd-2020-IIa-clinical-implementation-early-diagnosis',
      name: 'Kitko CL, Pidala J, Schoemans HM, et al. National Institutes of Health Consensus Development Project on Criteria for Clinical Trials in Chronic Graft-versus-Host Disease: IIa. The 2020 Clinical Implementation and Early Diagnosis Working Group Report. Transplant Cell Ther. 2021;27(7):545–557.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33839317/',
      publishedAt: new Date('2021-07-01'),
      methodologyType: 'derivative',
      ingestedBy: 'openalex_v1',
    },
    update: {
      name: 'Kitko CL, Pidala J, Schoemans HM, et al. National Institutes of Health Consensus Development Project on Criteria for Clinical Trials in Chronic Graft-versus-Host Disease: IIa. The 2020 Clinical Implementation and Early Diagnosis Working Group Report. Transplant Cell Ther. 2021;27(7):545–557.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33839317/',
      publishedAt: new Date('2021-07-01'),
      methodologyType: 'derivative',
    },
  })

  const slug = `${CLAIM_ID}-SETTLED-2021-07-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2021-07-01'),
      datePrecision: 'MONTH',
      reason:
        'The 2014 report refined the NIH diagnostic and staging framework for chronic GVHD for use in clinical trials. Its direct successor working group — the 2020 Clinical Implementation and Early Diagnosis Working Group Report (Kitko et al., Transplant Cell Ther, July 2021) — took the 2014 diagnostic criteria as the accepted standard and issued consensus recommendations to implement them in routine transplant care and early clinical recognition, consolidating the framework as settled field consensus rather than proposing an alternative.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2021-07-01'),
      datePrecision: 'MONTH',
      reason:
        'The 2014 report refined the NIH diagnostic and staging framework for chronic GVHD for use in clinical trials. Its direct successor working group — the 2020 Clinical Implementation and Early Diagnosis Working Group Report (Kitko et al., Transplant Cell Ther, July 2021) — took the 2014 diagnostic criteria as the accepted standard and issued consensus recommendations to implement them in routine transplant care and early clinical recognition, consolidating the framework as settled field consensus rather than proposing an alternative.',
      sourceId: source.id,
    },
  })

  console.log(`${DRY_RUN ? '[dry-run] ' : ''}Enriched ${CLAIM_ID}: RECORDED -> SETTLED (2021-07, NIH 2020 IIa report)`)

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
