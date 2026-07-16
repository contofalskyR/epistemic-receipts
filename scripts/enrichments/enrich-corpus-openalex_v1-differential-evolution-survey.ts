// Enrichment: post-publication trajectory for Das & Suganthan (2011),
// "Differential Evolution: A Survey of the State-of-the-Art", IEEE TEVC.
// Claim: cmq2w5nuj010fsa8h6ln4q564 (openalex_v1, W2156194072)
//
// Baseline ClaimStatusHistory row (null -> RECORDED at 2010-10-19) already exists.
// This script adds the single verified post-publication adjudication:
//   RECORDED -> SETTLED (2016-04) — the field's canonical "updated survey" by the
//   same lead authors reaffirmed DE as a leading real-parameter optimizer.
//
// Idempotent: upserts on source.externalId and claimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-differential-evolution-survey.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w5nuj010fsa8h6ln4q564'

async function main() {
  // ── RECORDED -> SETTLED: 2016 updated survey reaffirms DE's state-of-the-art status ──
  await prisma.source.upsert({
    where: { externalId: 'src:de-updated-survey-2016' },
    create: {
      externalId: 'src:de-updated-survey-2016',
      name: 'Das, Mullick & Suganthan (2016), "Recent advances in differential evolution – An updated survey", Swarm and Evolutionary Computation 27:1-30',
      url: 'https://doi.org/10.1016/j.swevo.2016.01.004',
      publishedAt: new Date('2016-04-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Das, Mullick & Suganthan (2016), "Recent advances in differential evolution – An updated survey", Swarm and Evolutionary Computation 27:1-30',
      url: 'https://doi.org/10.1016/j.swevo.2016.01.004',
      publishedAt: new Date('2016-04-01'),
      methodologyType: 'derivative',
    },
  })

  const occurredAt = new Date('2016-04-01')
  const slug = `${CLAIM_ID}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'Five years after the original survey, the same lead authors published the field\u2019s canonical successor review, "Recent advances in differential evolution \u2013 An updated survey" (Swarm and Evolutionary Computation, 2016), which reaffirmed DE as one of the most competitive and widely used families of real-parameter metaheuristics. Its heavy uptake (1,000+ citations) marks the community\u2019s settled treatment of DE\u2019s standing rather than a contested claim. This is a review-level consensus confirmation, not a retraction or overturn.',
      sourceExternalId: 'src:de-updated-survey-2016',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      reason:
        'Five years after the original survey, the same lead authors published the field\u2019s canonical successor review, "Recent advances in differential evolution \u2013 An updated survey" (Swarm and Evolutionary Computation, 2016), which reaffirmed DE as one of the most competitive and widely used families of real-parameter metaheuristics. Its heavy uptake (1,000+ citations) marks the community\u2019s settled treatment of DE\u2019s standing rather than a contested claim. This is a review-level consensus confirmation, not a retraction or overturn.',
      sourceExternalId: 'src:de-updated-survey-2016',
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED, 2016-04)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
