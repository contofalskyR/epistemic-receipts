// Enrichment: post-publication epistemic trajectory for the TCGA integrated
// genomic/transcriptomic/proteomic characterization of endometrial carcinoma
// (Cancer Genome Atlas Research Network, Nature 2013; DOI 10.1038/nature12113;
// OpenAlex W2041440766). Claim cmplzp81604k1sat02t7qysg3.
//
// The baseline RECORDED row (fromAxis=null -> RECORDED at the 2013-04-30
// publication date) already exists and is NOT duplicated here.
//
// Post-publication event: the four-group molecular classification defined by
// this paper (POLE-ultramutated, MSI/MMR-deficient hypermutated, copy-number-low
// endometrioid/NSMP, copy-number-high serous-like/p53-abnormal) was adopted into
// clinical practice by the joint ESGO/ESTRO/ESP guidelines (2021), which for the
// first time integrated the TCGA molecular markers into the prognostic risk
// stratification of endometrial carcinoma. Field-consensus shift via a major
// clinical guideline => RECORDED -> SETTLED, community INSTITUTIONAL.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-tcga-endometrial-carcinoma-2013.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmplzp81604k1sat02t7qysg3'

async function main() {
  // ── RECORDED -> SETTLED: ESGO/ESTRO/ESP guidelines adopt the TCGA
  //    molecular classification into endometrial carcinoma risk stratification ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:esgo-estro-esp-endometrial-guidelines-2021' },
    create: {
      externalId: 'src:esgo-estro-esp-endometrial-guidelines-2021',
      name: 'Concin N, et al. ESGO/ESTRO/ESP guidelines for the management of patients with endometrial carcinoma. Virchows Arch 2021;478(3):439-465 (co-published Int J Gynecol Cancer 2021;31(1):12-39; Radiother Oncol). Consensus Statement / Practice Guideline. DOI 10.1007/s00428-020-03007-z; PMID 33604759.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33604759/',
      publishedAt: new Date('2021-02-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Concin N, et al. ESGO/ESTRO/ESP guidelines for the management of patients with endometrial carcinoma. Virchows Arch 2021;478(3):439-465 (co-published Int J Gynecol Cancer 2021;31(1):12-39; Radiother Oncol). Consensus Statement / Practice Guideline. DOI 10.1007/s00428-020-03007-z; PMID 33604759.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33604759/',
      publishedAt: new Date('2021-02-01'),
    },
  })

  const occurredAt = '2021-02-01'
  const toAxis = 'SETTLED'
  const histId = `${CLAIM_ID}-${toAxis}-${occurredAt.slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'INSTITUTIONAL',
      occurredAt: new Date(occurredAt),
      datePrecision: 'MONTH',
      reason:
        'The joint ESGO/ESTRO/ESP guidelines (a Consensus Statement / Practice Guideline reviewed by 191 independent international practitioners) formally integrated the TCGA four-group molecular classification of endometrial carcinoma into the prognostic risk stratification underpinning clinical management, the first time these molecular markers entered a major clinical guideline. This moved the 2013 TCGA characterization from a research finding to institutional standard of care, marking field-consensus adoption. The classification (POLE-ultramutated, MMR-deficient/hypermutated, copy-number-low/NSMP, copy-number-high/p53-abnormal) had by then been validated by surrogate classifiers and prognostic cohorts and became the settled framework for endometrial cancer.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis,
      community: 'INSTITUTIONAL',
      occurredAt: new Date(occurredAt),
      datePrecision: 'MONTH',
      reason:
        'The joint ESGO/ESTRO/ESP guidelines (a Consensus Statement / Practice Guideline reviewed by 191 independent international practitioners) formally integrated the TCGA four-group molecular classification of endometrial carcinoma into the prognostic risk stratification underpinning clinical management, the first time these molecular markers entered a major clinical guideline. This moved the 2013 TCGA characterization from a research finding to institutional standard of care, marking field-consensus adoption. The classification (POLE-ultramutated, MMR-deficient/hypermutated, copy-number-low/NSMP, copy-number-high/p53-abnormal) had by then been validated by surrogate classifiers and prognostic cohorts and became the settled framework for endometrial cancer.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId: CLAIM_ID, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({
      data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' },
    })
  }

  console.log(`  ✓ ${CLAIM_ID}: RECORDED -> SETTLED (ESGO/ESTRO/ESP guidelines 2021)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
