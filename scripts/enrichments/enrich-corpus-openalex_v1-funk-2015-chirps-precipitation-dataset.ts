import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic-receipt enrichment for:
//   Funk, C. et al. (2015), "The climate hazards infrared precipitation with
//   stations—a new environmental record for monitoring extremes," Scientific
//   Data 2: 150066.
//   OpenAlex: W2261645655 (2015-12-07) · DOI: 10.1038/sdata.2015.66
//
// Baseline row (fromAxis=null -> RECORDED at 2015-12-07) already exists; NOT duplicated here.
//
// Post-publication arc added:
//   RECORDED -> SETTLED (2023-11-03): Du, Tan, Zhang, Chun, Li & Kabir,
//     "Evaluating the effectiveness of CHIRPS data for hydroclimatic studies"
//     (Theoretical and Applied Climatology 155(3): 1519-1539,
//     DOI 10.1007/s00704-023-04721-9) is a systematic review synthesizing 123
//     CHIRPS validation studies (mostly 2015-2021). It adjudicates the original
//     descriptor's core claim — that CHIRPS is a reliable long-record, high-
//     resolution, gauge-blended precipitation dataset — and broadly upholds it:
//     CHIRPS captures monthly precipitation well and is suitable for drought
//     assessment, with strongest performance in Africa. The review also bounds
//     the claim (weaker skill over complex terrain, sparse-gauge regions, and
//     extreme events; not always the top product versus other GPPs), so this is
//     a qualified field-consensus settling rather than an unconditional one.
//   There was no prior contest (no retraction, correction, or dated methodological
//   rebuttal exists), so the single transition goes RECORDED -> SETTLED directly.

const CLAIM_ID = 'cmq2w5a2k00s9sa8hf0ejlhir'

async function main() {
  // ── RECORDED -> SETTLED: Du et al. (2023) systematic review of 123 CHIRPS validations ──
  const du2023 = await prisma.source.upsert({
    where: { externalId: 'src:du-2023-chirps-effectiveness-review' },
    create: {
      externalId: 'src:du-2023-chirps-effectiveness-review',
      name: 'Du, H., Tan, M.L., Zhang, F., Chun, K.P., Li, L. & Kabir, M.H. (2023). "Evaluating the effectiveness of CHIRPS data for hydroclimatic studies." Theoretical and Applied Climatology 155(3): 1519-1539.',
      url: 'https://doi.org/10.1007/s00704-023-04721-9',
      publishedAt: new Date('2023-11-03'),
      methodologyType: 'review',
      ingestedBy: 'enrich:openalex_v1-funk-2015-chirps-precipitation-dataset',
    },
    update: {
      name: 'Du, H., Tan, M.L., Zhang, F., Chun, K.P., Li, L. & Kabir, M.H. (2023). "Evaluating the effectiveness of CHIRPS data for hydroclimatic studies." Theoretical and Applied Climatology 155(3): 1519-1539.',
      url: 'https://doi.org/10.1007/s00704-023-04721-9',
      publishedAt: new Date('2023-11-03'),
    },
  })

  const settledId = `${CLAIM_ID}-SETTLED-2023-11-03`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2023-11-03'),
      datePrecision: 'DAY',
      reason: 'Du et al. (2023) systematically reviewed 123 CHIRPS validation studies (mostly 2015-2021) and adjudicated the descriptor\'s core claim that CHIRPS is a reliable long-record, high-resolution, gauge-blended precipitation dataset. The review broadly upholds it — CHIRPS reproduces monthly precipitation well and is fit for drought assessment, best of all in Africa — while bounding it with documented weaknesses over complex terrain, sparse-gauge regions, and extreme events. This constitutes a qualified expert-literature settling of the dataset\'s fitness for its stated purpose.',
      sourceId: du2023.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2023-11-03'),
      datePrecision: 'DAY',
      reason: 'Du et al. (2023) systematically reviewed 123 CHIRPS validation studies (mostly 2015-2021) and adjudicated the descriptor\'s core claim that CHIRPS is a reliable long-record, high-resolution, gauge-blended precipitation dataset. The review broadly upholds it — CHIRPS reproduces monthly precipitation well and is fit for drought assessment, best of all in Africa — while bounding it with documented weaknesses over complex terrain, sparse-gauge regions, and extreme events. This constitutes a qualified expert-literature settling of the dataset\'s fitness for its stated purpose.',
      sourceId: du2023.id,
    },
  })

  const edge = await prisma.edge.findFirst({ where: { claimId: CLAIM_ID, sourceId: du2023.id } })
  if (!edge) {
    await prisma.edge.create({ data: { claimId: CLAIM_ID, sourceId: du2023.id, type: 'FOR' } })
  }

  console.log(`✓ ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED via Du et al. 2023 systematic review of 123 CHIRPS validations)`)
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
