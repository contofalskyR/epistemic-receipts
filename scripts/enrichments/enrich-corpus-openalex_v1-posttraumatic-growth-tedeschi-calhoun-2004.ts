import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmpm117pg017vsadnu56jmh1b'

// Post-publication trajectory for Tedeschi & Calhoun (2004),
// "Posttraumatic Growth: Conceptual Foundations and Empirical Evidence,"
// Psychological Inquiry. DOI 10.1207/s15327965pli1501_01 / OpenAlex W2033002423.
//
// Baseline RECORDED row (fromAxis=null -> RECORDED @ 2004-01-01) already exists; not duplicated here.
//
// Verified adjudicating event:
//   RECORDED -> CONTESTED @ 2009-07 — Frazier et al. (2009), "Does Self-Reported
//   Posttraumatic Growth Reflect Genuine Positive Change?" Psychological Science.
//   Using prospective pre/post trauma measurement, the study found that retrospective
//   self-reports of growth did not correspond to actual measured pre-to-post change,
//   directly challenging the empirical validity of the growth construct as measured.
//   PMID 19515115 (verified 200). Community: EXPERT_LITERATURE, MONTH precision.

async function main() {
  const source = await prisma.source.upsert({
    where: { externalId: 'src:frazier-2009-ptg-genuine-change' },
    create: {
      externalId: 'src:frazier-2009-ptg-genuine-change',
      name: 'Frazier et al. (2009), "Does Self-Reported Posttraumatic Growth Reflect Genuine Positive Change?" Psychological Science 20(7):912-919',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19515115/',
      publishedAt: new Date('2009-07-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:posttraumatic-growth-tedeschi-calhoun-2004',
    },
    update: {
      name: 'Frazier et al. (2009), "Does Self-Reported Posttraumatic Growth Reflect Genuine Positive Change?" Psychological Science 20(7):912-919',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19515115/',
      publishedAt: new Date('2009-07-01'),
    },
  })

  const slug = `${CLAIM_ID}-CONTESTED-2009-07-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-07-01'),
      datePrecision: 'MONTH',
      reason:
        'Frazier et al. (2009, Psychological Science) used prospective pre/post-trauma measurement and found that retrospective self-reports of posttraumatic growth did not correspond to actual measured positive change over time. The finding directly challenged the empirical evidence for the growth construct as operationalized by the standard self-report inventory, opening a durable methodological contest over whether reported growth reflects genuine change or a motivated reconstruction.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2009-07-01'),
      datePrecision: 'MONTH',
      reason:
        'Frazier et al. (2009, Psychological Science) used prospective pre/post-trauma measurement and found that retrospective self-reports of posttraumatic growth did not correspond to actual measured positive change over time. The finding directly challenged the empirical evidence for the growth construct as operationalized by the standard self-report inventory, opening a durable methodological contest over whether reported growth reflects genuine change or a motivated reconstruction.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> CONTESTED (Frazier et al. 2009)`) 
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
