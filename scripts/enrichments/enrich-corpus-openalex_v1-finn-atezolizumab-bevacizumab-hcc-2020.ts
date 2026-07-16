// Epistemic receipt enrichment: Finn et al. (2020),
// "Atezolizumab plus Bevacizumab in Unresectable Hepatocellular Carcinoma"
// (the IMbrave150 phase 3 trial), New England Journal of Medicine 382:1894-1905.
// DOI 10.1056/NEJMoa1915745. OpenAlex W3025022288.
//
// Baseline ClaimStatusHistory (fromAxis=null -> RECORDED at the 2020-05 publication)
// already exists. This script adds the post-publication arc:
//   RECORDED -> SETTLED (2022-03) — The IMbrave150 result (atezolizumab + bevacizumab
//   superior to sorafenib as first-line systemic therapy for unresectable HCC) was
//   adopted as the new first-line standard of care in the EASL / Barcelona Clinic Liver
//   Cancer (BCLC) 2022 treatment-recommendation update, the field's authoritative
//   clinical staging-and-therapy framework for HCC. This is a specific, dated,
//   institutional field-consensus document adjudicating the finding as settled practice.
//
// No retraction, expression of concern, or failed replication exists; the finding was
// vindicated rather than contested, so the claim rests at SETTLED.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-finn-atezolizumab-bevacizumab-hcc-2020.ts
// Dry-run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-finn-atezolizumab-bevacizumab-hcc-2020.ts --dry-run

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DRY_RUN = process.argv.includes('--dry-run')

const CLAIM_ID = 'cmply5yp900x9saihemcagd25'

async function main() {
  if (DRY_RUN) {
    console.log('[dry-run] would upsert 1 source and 1 claimStatusHistory transition for', CLAIM_ID)
    return
  }

  // ── Source: EASL / BCLC 2022 update (clinical staging & treatment framework) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:bclc-2022-update-jhep' },
    create: {
      externalId: 'src:bclc-2022-update-jhep',
      name: 'Reig M, Forner A, Rimola J, et al. "BCLC strategy for prognosis prediction and treatment recommendation: The 2022 update." Journal of Hepatology 2022;76(3):681-693 (EASL).',
      url: 'https://doi.org/10.1016/j.jhep.2021.11.018',
      publishedAt: new Date('2022-03-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1',
    },
    update: {
      name: 'Reig M, Forner A, Rimola J, et al. "BCLC strategy for prognosis prediction and treatment recommendation: The 2022 update." Journal of Hepatology 2022;76(3):681-693 (EASL).',
      url: 'https://doi.org/10.1016/j.jhep.2021.11.018',
      publishedAt: new Date('2022-03-01'),
      methodologyType: 'derivative',
    },
  })

  // ── Transition: RECORDED -> SETTLED (2022-03) ──
  const occurredAt = new Date('2022-03-01')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  const settled = {
    claimId: CLAIM_ID,
    fromAxis: 'RECORDED' as const,
    toAxis: 'SETTLED' as const,
    community: 'INSTITUTIONAL' as const,
    occurredAt,
    datePrecision: 'MONTH' as const,
    reason:
      'The IMbrave150 finding — atezolizumab plus bevacizumab producing superior overall and progression-free survival versus sorafenib as first-line therapy for unresectable HCC — was adopted as the new first-line standard of care in the EASL Barcelona Clinic Liver Cancer (BCLC) 2022 update, the field\'s authoritative HCC staging-and-treatment framework. Its incorporation into this clinical guideline marks a field-consensus shift from single-agent targeted therapy to immunotherapy combination, settling the finding as recommended practice rather than a single-trial result. No retraction, expression of concern, or failed replication has challenged the result.',
    sourceId: source.id,
  }

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: { id: slug, ...settled },
    update: settled,
  })

  console.log('Upserted transition:', slug)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
