// Enrichment: post-publication epistemic trajectory for the van 't Veer 70-gene
// breast-cancer signature paper.
//
// Claim cmply5kwx00qrsaihbfemcucp — van 't Veer LJ, Dai H, van de Vijver MJ, et al.,
// "Gene expression profiling predicts clinical outcome of breast cancer," Nature
// 415(6871):530-536, 2002 (DOI 10.1038/415530a; OpenAlex W2128985829). This is the
// study behind the 70-gene MammaPrint signature.
//
// The baseline row (fromAxis=null -> RECORDED at 2002-01-01) already exists and is NOT
// duplicated here. This script adds the two well-documented post-publication transitions:
//
//   RECORDED  -> CONTESTED  2005-02-11 (DAY)   Michiels, Koscielny & Hill (Lancet
//                                              365:488-492) reanalysed the microarray
//                                              outcome-prediction studies, including this
//                                              breast-cancer dataset, with a multiple
//                                              random validation strategy and found the
//                                              signatures unstable and training-set
//                                              dependent — a direct reproducibility
//                                              challenge.
//
//   CONTESTED -> SETTLED    2016-08-25 (DAY)   The MINDACT randomized phase-3 trial
//                                              (Cardoso et al., NEJM 375:717-729)
//                                              prospectively validated the 70-gene
//                                              signature derived from this work,
//                                              delivering level-1 evidence for its
//                                              clinical utility and resolving the contest
//                                              in the finding's favor.
//
// Sources verified via Crossref (HTTP 200; correct title/authors/venue/date) and doi.org
// resolution (HTTP 302 to publisher) on 2026-07-15.
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-gene-expression-profiling-breast-cancer-70-gene.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmply5kwx00qrsaihbfemcucp'

async function main() {
  // ── Transition 1: RECORDED -> CONTESTED (Michiels et al., multiple random validation) ──
  await prisma.source.upsert({
    where: { externalId: 'src:michiels-2005-multiple-random-validation-lancet' },
    create: {
      externalId: 'src:michiels-2005-multiple-random-validation-lancet',
      name: 'Michiels S, Koscielny S, Hill C. Prediction of cancer outcome with microarrays: a multiple random validation strategy. Lancet. 2005;365(9458):488-492.',
      url: 'https://doi.org/10.1016/S0140-6736(05)17866-0',
      publishedAt: new Date('2005-02-11'),
      methodologyType: 'reanalysis',
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-CONTESTED-2005-02-11` },
    create: {
      id: `${CLAIM_ID}-CONTESTED-2005-02-11`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2005-02-11'),
      datePrecision: 'DAY',
      reason:
        'Michiels, Koscielny & Hill (Lancet 2005; 365:488-492) reanalysed the seven largest microarray cancer-outcome studies, including this breast-cancer dataset, using a multiple random validation strategy. They found the molecular signatures were highly unstable: the selected gene lists and the reported predictive accuracy depended strongly on which patients happened to fall in the training set, and in five of the seven studies the classifiers performed no better than chance. This directly contested the reproducibility and generalisability of the finding.',
      sourceExternalId: 'src:michiels-2005-multiple-random-validation-lancet',
    },
    update: {},
  })

  // ── Transition 2: CONTESTED -> SETTLED (MINDACT prospective randomized validation) ──
  await prisma.source.upsert({
    where: { externalId: 'src:cardoso-2016-mindact-nejm' },
    create: {
      externalId: 'src:cardoso-2016-mindact-nejm',
      name: 'Cardoso F, van\u2019t Veer LJ, Bogaerts J, et al. 70-Gene Signature as an Aid to Treatment Decisions in Early-Stage Breast Cancer (MINDACT). N Engl J Med. 2016;375(8):717-729.',
      url: 'https://doi.org/10.1056/NEJMoa1602253',
      publishedAt: new Date('2016-08-25'),
      methodologyType: 'randomized_controlled_trial',
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2016-08-25` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2016-08-25`,
      claimId: CLAIM_ID,
      fromAxis: 'CONTESTED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2016-08-25'),
      datePrecision: 'DAY',
      reason:
        'The MINDACT trial (Cardoso et al., NEJM 2016; 375:717-729) prospectively validated the 70-gene MammaPrint signature developed from this study in a randomized phase-3 trial of 6,693 women with early-stage breast cancer. Among patients with high clinical but low genomic risk, roughly 46% could safely forgo chemotherapy, with 5-year distant-metastasis-free survival near 95%. This level-1 prospective evidence resolved the earlier reproducibility contest in the signature\u2019s favor and underpinned its incorporation into ASCO and St. Gallen clinical guidelines.',
      sourceExternalId: 'src:cardoso-2016-mindact-nejm',
    },
    update: {},
  })

  console.log('Enrichment complete: 2 transitions upserted for claim', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
