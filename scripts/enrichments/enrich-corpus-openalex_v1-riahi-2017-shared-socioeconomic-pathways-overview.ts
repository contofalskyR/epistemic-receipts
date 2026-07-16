import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Riahi, K., et al. (2017). "The Shared Socioeconomic Pathways and their
//   energy, land use, and greenhouse gas emissions implications: An overview."
//   Global Environmental Change 42: 153-168.
//   DOI: 10.1016/j.gloenvcha.2016.05.009 · OpenAlex: W2410390527
//
// Baseline row (fromAxis=null -> RECORDED at 2016-09-13) already exists; NOT duplicated here.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2021-08-09): The SSP scenario framework overviewed in
//   this paper was formally adopted as the core scenario basis of the IPCC
//   Sixth Assessment Report. The Working Group I Summary for Policymakers,
//   approved 9 August 2021, structures its central climate projections around
//   five illustrative SSP-based emissions scenarios (SSP1-1.9 through SSP5-8.5),
//   establishing the SSPs as the field's standard scenario framework — an
//   institutional consensus adoption, not a scholarly contest.

const CLAIM_ID = 'cmplyqlvu01lbsaqkvmgnnq8o'

async function main() {
  // ── RECORDED -> SETTLED: IPCC AR6 WGI adopts the SSP framework ──
  const ipcc = await prisma.source.upsert({
    where: { externalId: 'src:ipcc-ar6-wg1-spm-2021' },
    create: {
      externalId: 'src:ipcc-ar6-wg1-spm-2021',
      name: 'IPCC (2021). Summary for Policymakers. In: Climate Change 2021: The Physical Science Basis. Contribution of Working Group I to the Sixth Assessment Report of the IPCC.',
      url: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf',
      publishedAt: new Date('2021-08-09'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-riahi-2017-ssp-overview',
    },
    update: {
      name: 'IPCC (2021). Summary for Policymakers. In: Climate Change 2021: The Physical Science Basis. Contribution of Working Group I to the Sixth Assessment Report of the IPCC.',
      url: 'https://www.ipcc.ch/report/ar6/wg1/downloads/report/IPCC_AR6_WGI_SPM.pdf',
      publishedAt: new Date('2021-08-09'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2021-08-09`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2021-08-09'),
      datePrecision: 'DAY',
      reason: 'The IPCC Sixth Assessment Report adopted the Shared Socioeconomic Pathways overviewed in this paper as its core scenario framework. The Working Group I Summary for Policymakers, approved 9 August 2021, organises its central climate projections around five illustrative SSP-based emissions scenarios (SSP1-1.9, SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5). This formal institutional adoption established the SSPs as the standard scenario architecture of global climate assessment, settling the framework by consensus rather than scholarly contest.',
      sourceId: ipcc.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt: new Date('2021-08-09'),
      datePrecision: 'DAY',
      reason: 'The IPCC Sixth Assessment Report adopted the Shared Socioeconomic Pathways overviewed in this paper as its core scenario framework. The Working Group I Summary for Policymakers, approved 9 August 2021, organises its central climate projections around five illustrative SSP-based emissions scenarios (SSP1-1.9, SSP1-2.6, SSP2-4.5, SSP3-7.0, SSP5-8.5). This formal institutional adoption established the SSPs as the standard scenario architecture of global climate assessment, settling the framework by consensus rather than scholarly contest.',
      sourceId: ipcc.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: ipcc.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: ipcc.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via IPCC AR6 WGI SPM 2021)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
