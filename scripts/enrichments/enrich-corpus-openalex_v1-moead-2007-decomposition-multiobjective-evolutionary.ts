// Enrichment: post-publication epistemic trajectory for MOEA/D.
//
// Claim cmq2w4jqn00c9sa8hprhk4eb6 — Qingfu Zhang & Hui Li, "MOEA/D: A
// Multiobjective Evolutionary Algorithm Based on Decomposition," IEEE
// Transactions on Evolutionary Computation, vol. 11, no. 6, pp. 712-731,
// December 2007 (DOI 10.1109/tevc.2007.892759; OpenAlex W2143381319).
//
// The baseline row (fromAxis=null -> RECORDED at 2007-11-29) already exists and
// is NOT duplicated here. This script adds the single well-documented
// post-publication transition:
//
//   RECORDED -> SETTLED  2017-06 (MONTH)  IEEE Transactions on Evolutionary
//                                         Computation vol. 21, no. 3, pp. 440-462
//                                         published a dedicated survey — Trivedi,
//                                         Srinivasan, Sanyal & Ghosh, "A Survey of
//                                         Multiobjective Evolutionary Algorithms
//                                         based on Decomposition" — reviewing the
//                                         entire research area that grew out of
//                                         MOEA/D and treating decomposition as an
//                                         established, mainstream paradigm in
//                                         multiobjective evolutionary optimization.
//
// The paper's core claim — that decomposition, though standard in classical
// multiobjective optimization, could be brought into evolutionary optimization as
// a "basic strategy" — was vindicated: within a decade an entire subfield existed
// and merited its own flagship-journal survey. MOEA/D was not contested by any
// dated failed-replication or methodological-refutation paper (later work extends
// rather than overturns it), so no CONTESTED/REVERSED step is asserted.
//
// Sources verified 2026-07-15: claim paper identity confirmed via Crossref
// (HTTP 200, correct title/authors/venue/date); survey DOI resolves via doi.org
// (HTTP 302 to the IEEE Xplore record).
// Idempotent: upserts on Source.externalId and ClaimStatusHistory.id.
//
// Run:  npx tsx scripts/enrichments/enrich-corpus-openalex_v1-moead-2007-decomposition-multiobjective-evolutionary.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4jqn00c9sa8hprhk4eb6'

async function main() {
  // ── Transition: RECORDED -> SETTLED (dedicated field survey adjudicates the paradigm) ──
  await prisma.source.upsert({
    where: { externalId: 'src:trivedi-2017-moead-survey-tevc' },
    create: {
      externalId: 'src:trivedi-2017-moead-survey-tevc',
      name: 'Trivedi A, Srinivasan D, Sanyal K, Ghosh A. A Survey of Multiobjective Evolutionary Algorithms based on Decomposition. IEEE Transactions on Evolutionary Computation. 2017;21(3):440-462.',
      url: 'https://doi.org/10.1109/TEVC.2016.2608507',
      publishedAt: new Date('2017-06-01'),
      methodologyType: 'review',
    },
    update: {},
  })

  await prisma.claimStatusHistory.upsert({
    where: { id: `${CLAIM_ID}-SETTLED-2017-06-01` },
    create: {
      id: `${CLAIM_ID}-SETTLED-2017-06-01`,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'SETTLED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2017-06-01'),
      datePrecision: 'MONTH',
      reason:
        'MOEA/D argued decomposition could serve as a basic strategy in multiobjective evolutionary optimization, where it had not previously been widely used. By June 2017 the same flagship journal (IEEE Transactions on Evolutionary Computation, vol. 21, no. 3, pp. 440-462) carried a dedicated survey by Trivedi, Srinivasan, Sanyal and Ghosh reviewing the large research area of decomposition-based multiobjective evolutionary algorithms that MOEA/D founded. A whole subfield warranting its own flagship-journal review marks the decomposition paradigm as established expert-literature consensus, vindicating the paper\'s central claim.',
      sourceExternalId: 'src:trivedi-2017-moead-survey-tevc',
    },
    update: {},
  })

  console.log('Enrichment complete: 1 transition upserted for claim', CLAIM_ID)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
