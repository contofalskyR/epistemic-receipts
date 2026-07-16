// Enrichment: post-publication epistemic trajectory for
// "Sequential data assimilation with a nonlinear quasi-geostrophic model using
//  Monte Carlo methods to forecast error statistics"
// Evensen G. Journal of Geophysical Research: Oceans 1994;99(C5):10143–10162.
// DOI 10.1029/94JC00572 · OpenAlex W2157098139
//
// This is the foundational paper introducing the Ensemble Kalman Filter (EnKF).
//
// Baseline RECORDED transition (fromAxis=null -> RECORDED at 1994-05-15) already
// exists and is NOT duplicated here.
//
// Post-publication events added:
//   RECORDED -> CONTESTED (1998-06, EXPERT_LITERATURE)
//     Burgers, van Leeuwen & Evensen demonstrated that the analysis-update scheme
//     as formulated in the 1994 paper was statistically inconsistent: by treating
//     observations as fixed rather than as random variables, it systematically
//     underestimated the analysis error covariance (ensemble spread collapsed).
//     They introduced the "perturbed observations" correction that restored the
//     correct posterior variance. Burgers G, van Leeuwen PJ, Evensen G. "Analysis
//     Scheme in the Ensemble Kalman Filter." Monthly Weather Review 1998;126(6):1719–1724.
//
//   CONTESTED -> SETTLED (2003-11-01, EXPERT_LITERATURE)
//     Evensen's consolidating review presented the corrected, complete EnKF
//     formulation and its practical implementation, resolving the analysis-scheme
//     dispute and establishing the EnKF as the standard reference method for
//     ensemble data assimilation in the geosciences. Evensen G. "The Ensemble
//     Kalman Filter: theoretical formulation and practical implementation."
//     Ocean Dynamics 2003;53(4):343–367.
//
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-evensen-ensemble-kalman-filter.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const claimId = 'cmq2w5id000x3sa8htiodj909'

async function main() {
  // ── RECORDED -> CONTESTED : Burgers et al. analysis-scheme correction (1998) ──
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:burgers-vanleeuwen-evensen-enkf-analysis-1998' },
    create: {
      externalId: 'src:burgers-vanleeuwen-evensen-enkf-analysis-1998',
      name: 'Burgers G, van Leeuwen PJ, Evensen G. "Analysis Scheme in the Ensemble Kalman Filter." Monthly Weather Review 1998;126(6):1719–1724.',
      url: 'https://doi.org/10.1175/1520-0493(1998)126%3C1719:ASITEK%3E2.0.CO;2',
      publishedAt: new Date('1998-06-01'),
      methodologyType: 'primary',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Burgers G, van Leeuwen PJ, Evensen G. "Analysis Scheme in the Ensemble Kalman Filter." Monthly Weather Review 1998;126(6):1719–1724.',
      url: 'https://doi.org/10.1175/1520-0493(1998)126%3C1719:ASITEK%3E2.0.CO;2',
      publishedAt: new Date('1998-06-01'),
    },
  })

  {
    const occurredAt = new Date('1998-06-01')
    const slug = `${claimId}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      'Burgers, van Leeuwen and Evensen showed the analysis-update scheme as formulated in the 1994 paper was statistically inconsistent: by treating the observations as fixed rather than as random variables, it systematically underestimated the analysis error covariance and led to ensemble-spread collapse. They introduced the "perturbed observations" correction that restores the correct posterior variance, a widely-cited methodological correction to the original EnKF formulation.'

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
      update: {
        fromAxis: 'RECORDED',
        toAxis: 'CONTESTED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        reason,
        sourceId: contestSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: contestSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: contestSource.id, type: 'AGAINST' } })
    }
  }

  // ── CONTESTED -> SETTLED : Evensen consolidating review (2003) ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:evensen-enkf-formulation-implementation-2003' },
    create: {
      externalId: 'src:evensen-enkf-formulation-implementation-2003',
      name: 'Evensen G. "The Ensemble Kalman Filter: theoretical formulation and practical implementation." Ocean Dynamics 2003;53(4):343–367.',
      url: 'https://doi.org/10.1007/s10236-003-0036-9',
      publishedAt: new Date('2003-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1',
    },
    update: {
      name: 'Evensen G. "The Ensemble Kalman Filter: theoretical formulation and practical implementation." Ocean Dynamics 2003;53(4):343–367.',
      url: 'https://doi.org/10.1007/s10236-003-0036-9',
      publishedAt: new Date('2003-11-01'),
    },
  })

  {
    const occurredAt = new Date('2003-11-01')
    const slug = `${claimId}-SETTLED-${occurredAt.toISOString().slice(0, 10)}`
    const reason =
      "Evensen's consolidating review presented the corrected, complete EnKF formulation (incorporating the 1998 perturbed-observations analysis scheme) together with its practical implementation. It resolved the analysis-scheme dispute and became the standard reference for the method, cementing the ensemble Monte Carlo approach to forecasting error statistics as the dominant, field-standard data-assimilation technique in the geosciences and vindicating the core 1994 claim."

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceId: settleSource.id,
      },
      update: {
        fromAxis: 'CONTESTED',
        toAxis: 'SETTLED',
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        reason,
        sourceId: settleSource.id,
      },
    })

    const existingEdge = await prisma.edge.findFirst({
      where: { claimId, sourceId: settleSource.id },
    })
    if (!existingEdge) {
      await prisma.edge.create({ data: { claimId, sourceId: settleSource.id, type: 'FOR' } })
    }
  }

  console.log(
    `  ✓ enriched ${claimId} (+2 transitions: RECORDED -> CONTESTED 1998-06, CONTESTED -> SETTLED 2003-11-01)`,
  )
  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  await prisma.$disconnect()
  process.exit(1)
})
