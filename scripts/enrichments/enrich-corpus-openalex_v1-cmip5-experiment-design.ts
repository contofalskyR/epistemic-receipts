// Enrichment: epistemic trajectory for the CMIP5 experiment-design overview.
//
// Claim (cmq2w49mb0063sa8hmfze0fsg): Taylor, Stouffer & Meehl,
// "An Overview of CMIP5 and the Experiment Design," Bulletin of the American
// Meteorological Society (online 2011-10-07 / print 93(4), Apr 2012),
// DOI 10.1175/bams-d-11-00094.1, OpenAlex W2024966118.
//
// The paper's central forward-looking claim was that the CMIP5 multimodel
// archive would "underlie the forthcoming Fifth Assessment Report by the
// Intergovernmental Panel on Climate Change." This was institutionally
// realized when IPCC AR5 Working Group I ("Climate Change 2013: The Physical
// Science Basis," Summary for Policymakers approved 27 September 2013 in
// Stockholm) was built directly on the CMIP5 archive — CMIP5 output underpins
// Chapter 9 (Evaluation of Climate Models) and the Chapter 11/12 projections.
// That constitutes a field-consensus / institutional settling of the claim.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2011-10-07 publication date) already exists and is NOT duplicated here.
//
// Idempotent: upserts on stable ids.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-cmip5-experiment-design.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w49mb0063sa8hmfze0fsg'

async function main() {
  // ── RECORDED -> SETTLED: IPCC AR5 WG1 built on CMIP5 (27 Sept 2013) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:ipcc-ar5-wg1-2013' },
    create: {
      externalId: 'src:ipcc-ar5-wg1-2013',
      name: 'IPCC, 2013: Climate Change 2013: The Physical Science Basis. Contribution of Working Group I to the Fifth Assessment Report of the IPCC (Stocker et al., eds.). Cambridge University Press.',
      url: 'https://www.ipcc.ch/report/ar5/wg1/',
      publishedAt: new Date('2013-09-27'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1-cmip5-experiment-design',
    },
    update: {
      name: 'IPCC, 2013: Climate Change 2013: The Physical Science Basis. Contribution of Working Group I to the Fifth Assessment Report of the IPCC (Stocker et al., eds.). Cambridge University Press.',
      url: 'https://www.ipcc.ch/report/ar5/wg1/',
      publishedAt: new Date('2013-09-27'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2013-09-27`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2013-09-27'),
      datePrecision: 'DAY',
      reason: 'The paper stated CMIP5 was designed to underlie the forthcoming IPCC Fifth Assessment Report. IPCC AR5 Working Group I ("Climate Change 2013: The Physical Science Basis"), whose Summary for Policymakers was approved on 27 September 2013 in Stockholm, was built directly on the CMIP5 archive — CMIP5 output underpins its climate-model evaluation (Chapter 9) and future-projection chapters. This institutional consensus report realized and settled the paper\'s central claim about CMIP5\'s role.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2013-09-27'),
      datePrecision: 'DAY',
      reason: 'The paper stated CMIP5 was designed to underlie the forthcoming IPCC Fifth Assessment Report. IPCC AR5 Working Group I ("Climate Change 2013: The Physical Science Basis"), whose Summary for Policymakers was approved on 27 September 2013 in Stockholm, was built directly on the CMIP5 archive — CMIP5 output underpins its climate-model evaluation (Chapter 9) and future-projection chapters. This institutional consensus report realized and settled the paper\'s central claim about CMIP5\'s role.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> SETTLED (IPCC AR5 WG1, 2013-09-27)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
