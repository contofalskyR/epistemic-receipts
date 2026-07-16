import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for claim cmpm1jgdv09pjsadni1cvzkbw
// Bhattacherjee (2001), "Understanding Information Systems Continuance: An
// Expectation-Confirmation Model," MIS Quarterly 25(3). DOI 10.2307/3250921.
// Baseline RECORDED row (fromAxis=null -> RECORDED @ 2001-09) already exists.
//
// Post-publication adjudication:
//   RECORDED -> SETTLED (2018-09) — Ambalov's meta-analysis of IT continuance in
//   Telematics and Informatics evaluated the expectation-confirmation model (ECM)
//   across the accumulated empirical literature and confirmed its core structural
//   relationships (confirmation -> perceived usefulness/satisfaction ->
//   continuance intention), establishing the model as the settled reference
//   framework for IS continuance research. There was no prior contest, so this is
//   a direct RECORDED -> SETTLED vindication by expert literature.

const CLAIM_ID = 'cmpm1jgdv09pjsadni1cvzkbw'

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (Ambalov 2018 meta-analysis) ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:openalex_v1-bhattacherjee-2001-ambalov-meta-2018' },
    create: {
      externalId: 'src:openalex_v1-bhattacherjee-2001-ambalov-meta-2018',
      name: 'Ambalov, I. A. (2018). A meta-analysis of IT continuance: An evaluation of the expectation-confirmation model. Telematics and Informatics, 35(6), 1561–1571.',
      url: 'https://doi.org/10.1016/j.tele.2018.03.016',
      publishedAt: new Date('2018-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:openalex_v1-bhattacherjee-2001-is-continuance',
    },
    update: {
      name: 'Ambalov, I. A. (2018). A meta-analysis of IT continuance: An evaluation of the expectation-confirmation model. Telematics and Informatics, 35(6), 1561–1571.',
      url: 'https://doi.org/10.1016/j.tele.2018.03.016',
      publishedAt: new Date('2018-09-01'),
    },
  })

  const histId = `${CLAIM_ID}-SETTLED-2018-09-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2018-09-01'),
      datePrecision: 'MONTH',
      reason: 'Ambalov (2018) published a meta-analysis of the IT/IS continuance literature explicitly evaluating Bhattacherjee\'s expectation-confirmation model (ECM). Pooling effect sizes across the accumulated field-survey studies, it confirmed the model\'s central relationships—confirmation driving perceived usefulness and satisfaction, which in turn drive continuance intention—establishing the ECM as the settled reference framework for IS continuance research. With no prior methodological contest, this is a direct RECORDED -> SETTLED vindication by the expert literature.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2018-09-01'),
      datePrecision: 'MONTH',
      reason: 'Ambalov (2018) published a meta-analysis of the IT/IS continuance literature explicitly evaluating Bhattacherjee\'s expectation-confirmation model (ECM). Pooling effect sizes across the accumulated field-survey studies, it confirmed the model\'s central relationships—confirmation driving perceived usefulness and satisfaction, which in turn drive continuance intention—establishing the ECM as the settled reference framework for IS continuance research. With no prior methodological contest, this is a direct RECORDED -> SETTLED vindication by the expert literature.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: source.id } })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`  ✓ ${CLAIM_ID} (1 transition: RECORDED -> SETTLED)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
