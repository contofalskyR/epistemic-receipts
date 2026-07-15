// Enrichment: post-publication epistemic arc for Storn & Price 1997, the paper
// that introduced Differential Evolution (DE).
//
// Claim: cmq2w431h0029sa8h2np0pmdz (openalex_v1, W1595159159)
//   "Differential Evolution – A Simple and Efficient Heuristic for global
//    Optimization over Continuous Spaces"
//   — Storn R, Price K. Journal of Global Optimization 1997;11(4):341-359.
//   DOI 10.1023/A:1008202821328. Published 1997-12.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED @ 1997-12 publication)
// already exists and is NOT duplicated here.
//
// Post-publication research (verified 2026-07-15 via Crossref + doi.org):
//   - NO retraction and NO expression of concern. Crossref records no `update-to`,
//     no `updated-by`, and no relation markers on the DOI; the paper is a methods
//     contribution (an optimization heuristic), not an empirical finding subject to
//     failed replication.
//   - RECORDED -> SETTLED: the paper's core claim — that DE is a simple and efficient
//     general-purpose heuristic for continuous global optimization — was adjudicated
//     and affirmed by the field's canonical state-of-the-art survey. Das S, Suganthan PN.
//     "Differential Evolution: A Survey of the State-of-the-Art" (IEEE Transactions on
//     Evolutionary Computation 2011;15(1):4-31, DOI 10.1109/TEVC.2010.2059031; published
//     2011-02) — published in the flagship journal of evolutionary computation and cited
//     ~4,600+ times — reviews DE's convergence behavior, parameter control, and benchmark
//     performance and consolidates the field consensus that DE is "one of the most
//     powerful stochastic real-parameter optimization algorithms." Das S, Mullick SS,
//     Suganthan PN. "Recent advances in differential evolution – An updated survey"
//     (Swarm and Evolutionary Computation 2016;27:1-30, DOI 10.1016/j.swevo.2016.01.004,
//     published 2016-04) reaffirms this, noting DE variants' repeated wins in the CEC
//     real-parameter optimization competitions. There was never a contest phase, so this
//     is a direct RECORDED -> SETTLED. Community EXPERT_LITERATURE.
//
// Idempotent: upserts source on externalId and the status row on its deterministic slug id.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-storn-price-1997-differential-evolution.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w431h0029sa8h2np0pmdz'

async function main() {
  // ── RECORDED -> SETTLED: 2011 IEEE TEC state-of-the-art survey adjudicates DE ──
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:das-suganthan-2011-de-survey' },
    create: {
      externalId: 'src:das-suganthan-2011-de-survey',
      name: 'Das S, Suganthan PN. Differential Evolution: A Survey of the State-of-the-Art. IEEE Transactions on Evolutionary Computation 2011;15(1):4-31. DOI 10.1109/TEVC.2010.2059031. (Reinforced by Das, Mullick & Suganthan, Swarm and Evolutionary Computation 2016;27:1-30, DOI 10.1016/j.swevo.2016.01.004.)',
      url: 'https://doi.org/10.1109/TEVC.2010.2059031',
      publishedAt: new Date('2011-02-01'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich-openalex_v1',
    },
    update: {
      name: 'Das S, Suganthan PN. Differential Evolution: A Survey of the State-of-the-Art. IEEE Transactions on Evolutionary Computation 2011;15(1):4-31. DOI 10.1109/TEVC.2010.2059031. (Reinforced by Das, Mullick & Suganthan, Swarm and Evolutionary Computation 2016;27:1-30, DOI 10.1016/j.swevo.2016.01.004.)',
      url: 'https://doi.org/10.1109/TEVC.2010.2059031',
      publishedAt: new Date('2011-02-01'),
      methodologyType: 'derivative',
    },
  })

  const settledSlug = `${CLAIM_ID}-SETTLED-2011-02-01`
  await prisma.claimStatusHistory.upsert({
    where: { id: settledSlug },
    create: {
      id: settledSlug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2011-02-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
      reason:
        "Storn & Price's claim that Differential Evolution is a simple and efficient general-purpose heuristic for continuous global optimization was adjudicated and affirmed by the field's canonical state-of-the-art survey. Das & Suganthan (IEEE Transactions on Evolutionary Computation 2011;15(1):4-31), in the flagship journal of evolutionary computation and cited ~4,600+ times, reviewed DE's convergence, parameter control, and benchmark performance and consolidated the consensus that DE is among the most powerful stochastic real-parameter optimizers; the 2016 updated survey reaffirms this and notes DE variants' repeated CEC-competition wins. With no retraction, no expression of concern, and no contest phase, this survey moves the finding RECORDED -> SETTLED.",
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2011-02-01'),
      datePrecision: 'MONTH',
      sourceId: settleSource.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> SETTLED @ 2011-02, Das & Suganthan DE state-of-the-art survey)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
