// Enrichment: post-publication epistemic trajectory for the Brier score.
//
// Claim: Brier GW, "Verification of Forecasts Expressed in Terms of Probability,"
// Monthly Weather Review 1950;78(1):1-3 (DOI 10.1175/1520-0493(1950)078<0001:
// vofeit>2.0.co;2, OpenAlex W2073241381). The baseline fromAxis=null -> RECORDED
// row (1950-01-01) already exists and is NOT re-created here.
//
// Post-publication event: this is a methodology paper (a proposed verification
// score), not an empirical claim subject to retraction or replication. No
// retraction or expression of concern exists (confirmed via Crossref: no
// update-to/relation). Its status was adjudicated by Murphy AH, "A New Vector
// Partition of the Probability Score," J. Appl. Meteorol. 1973;12(4):595-600
// (DOI 10.1175/1520-0450(1973)012<0595:anvpot>2.0.co;2), which took Brier's
// probability score as the established standard and decomposed it into
// reliability, resolution, and uncertainty. That decomposition made the score
// interpretable and cemented it as the field-standard measure for verifying
// probabilistic forecasts => RECORDED -> SETTLED.
//
// Idempotent: upserts on source externalId and ClaimStatusHistory id.
//
// Run:     npx tsx scripts/enrichments/enrich-corpus-openalex_v1-brier-score-verification-forecasts.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmq2w5nko0109sa8hfm5l9qwm'

async function main() {
  // ── RECORDED -> SETTLED: Murphy (1973) decomposition cements the Brier score ──
  await prisma.source.upsert({
    where: { externalId: 'src:murphy-1973-vector-partition-probability-score' },
    create: {
      externalId: 'src:murphy-1973-vector-partition-probability-score',
      name: 'Murphy AH, "A New Vector Partition of the Probability Score," Journal of Applied Meteorology 1973;12(4):595-600',
      url: 'https://doi.org/10.1175/1520-0450(1973)012<0595:ANVPOT>2.0.CO;2',
      publishedAt: new Date('1973-06-01'),
      methodologyType: 'derivative',
    },
    update: {
      name: 'Murphy AH, "A New Vector Partition of the Probability Score," Journal of Applied Meteorology 1973;12(4):595-600',
      url: 'https://doi.org/10.1175/1520-0450(1973)012<0595:ANVPOT>2.0.CO;2',
      publishedAt: new Date('1973-06-01'),
      methodologyType: 'derivative',
    },
  })

  const settledId = `${claimId}-SETTLED-1973-06-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledId },
    create: {
      id: settledId,
      claimId,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1973-06-01'),
      datePrecision: 'MONTH',
      reason:
        'Murphy (1973) took Brier\'s probability score as the established standard and derived its canonical partition into reliability, resolution, and uncertainty. This decomposition made the score interpretable and diagnostic rather than a single opaque number, and it became the basis for how probabilistic forecasts are verified across meteorology and beyond. The finding was never contested as invalid; the decomposition settled the Brier score as the field-standard verification measure in the expert literature.',
      sourceExternalId: 'src:murphy-1973-vector-partition-probability-score',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('1973-06-01'),
      datePrecision: 'MONTH',
      reason:
        'Murphy (1973) took Brier\'s probability score as the established standard and derived its canonical partition into reliability, resolution, and uncertainty. This decomposition made the score interpretable and diagnostic rather than a single opaque number, and it became the basis for how probabilistic forecasts are verified across meteorology and beyond. The finding was never contested as invalid; the decomposition settled the Brier score as the field-standard verification measure in the expert literature.',
      sourceExternalId: 'src:murphy-1973-vector-partition-probability-score',
    },
  })

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
