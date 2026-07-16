// Enrichment: post-publication epistemic trajectory for
// "Osteoporosis Prevention, Diagnosis, and Therapy"
// NIH Consensus Development Panel on Osteoporosis Prevention, Diagnosis, and Therapy.
// JAMA 2001;285(6):785–795. DOI 10.1001/jama.285.6.785 · OpenAlex W175660244
//
// Baseline RECORDED transition (fromAxis=null -> RECORDED at 2001-02-14, the
// publication date) already exists and is NOT duplicated here.
//
// The substantive finding of this consensus statement was the redefinition of
// osteoporosis as "a skeletal disorder characterized by compromised bone strength
// predisposing a person to an increased risk of fracture" — a conceptual shift
// away from a purely bone-mineral-density (WHO T-score ≤ -2.5) diagnosis toward a
// fracture-risk conception of the disease.
//
// Post-publication event added:
//   RECORDED -> SETTLED (2014-02-28, INSTITUTIONAL)
//     The National Bone Health Alliance convened a 17-member working group of
//     clinicians and clinical scientists that operationalized the 2001 fracture-risk
//     conception into formal clinical diagnostic criteria — recommending that
//     osteoporosis be diagnosed not only by a T-score ≤ -2.5 but also by hip
//     fracture, osteopenia-associated fragility fractures, or FRAX 10-year risk
//     thresholds (≥3% hip / ≥20% major). This position statement marks the field
//     consensus adoption of the "compromised bone strength / elevated fracture risk"
//     definition the NIH panel introduced. Siris ES, Adler R, Bilezikian J, et al.
//     "The clinical diagnosis of osteoporosis: a position statement from the
//     National Bone Health Alliance Working Group." Osteoporos Int 2014;25(5):1439–1443.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-nih-osteoporosis-consensus-2001.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmpm0i62w0i2dsat0421va9br'

async function main() {
  // ── RECORDED -> SETTLED : NBHA Working Group position statement (2014) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:nbha-clinical-diagnosis-osteoporosis-2014' },
    create: {
      externalId: 'src:nbha-clinical-diagnosis-osteoporosis-2014',
      name: 'Siris ES, Adler R, Bilezikian J, et al. "The clinical diagnosis of osteoporosis: a position statement from the National Bone Health Alliance Working Group." Osteoporosis International 2014;25(5):1439–1443.',
      url: 'https://doi.org/10.1007/s00198-014-2655-z',
      publishedAt: new Date('2014-02-28'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Siris ES, Adler R, Bilezikian J, et al. "The clinical diagnosis of osteoporosis: a position statement from the National Bone Health Alliance Working Group." Osteoporosis International 2014;25(5):1439–1443.',
      url: 'https://doi.org/10.1007/s00198-014-2655-z',
      publishedAt: new Date('2014-02-28'),
    },
  })

  const occurredAt = new Date('2014-02-28')
  const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The National Bone Health Alliance convened a 17-member working group that operationalized the 2001 NIH consensus conception of osteoporosis — "compromised bone strength predisposing to increased fracture risk" — into formal clinical diagnostic criteria, recommending diagnosis not only by a T-score ≤ -2.5 but also by hip fracture, osteopenia-associated fragility fractures, or FRAX 10-year risk thresholds (≥3% hip / ≥20% major). This institutional position statement marks the field-consensus adoption of the fracture-risk definition the NIH panel introduced.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'INSTITUTIONAL',
      occurredAt,
      datePrecision: 'DAY',
      reason:
        'The National Bone Health Alliance convened a 17-member working group that operationalized the 2001 NIH consensus conception of osteoporosis — "compromised bone strength predisposing to increased fracture risk" — into formal clinical diagnostic criteria, recommending diagnosis not only by a T-score ≤ -2.5 but also by hip fracture, osteopenia-associated fragility fractures, or FRAX 10-year risk thresholds (≥3% hip / ≥20% major). This institutional position statement marks the field-consensus adoption of the fracture-risk definition the NIH panel introduced.',
      sourceId: source.id,
    },
  })

  const existingEdge = await prisma.edge.findFirst({
    where: { claimId, sourceId: source.id },
  })
  if (!existingEdge) {
    await prisma.edge.create({ data: { claimId, sourceId: source.id, type: 'FOR' } })
  }

  console.log(`  ✓ enriched ${claimId} (+1 transition: RECORDED -> SETTLED 2014-02-28)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
