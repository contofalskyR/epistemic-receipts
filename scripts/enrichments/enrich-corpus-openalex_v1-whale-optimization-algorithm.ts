// Enrichment: epistemic trajectory for the Whale Optimization Algorithm.
//
// Claim (cmq2w4a6l006fsa8hu6g13j4x): Seyedali Mirjalili & Andrew Lewis,
// "The Whale Optimization Algorithm," Advances in Engineering Software 95
// (created online 2016-02-26; print vol. 95, May 2016, pp. 51-67),
// DOI 10.1016/j.advengsoft.2016.01.008, OpenAlex W2290883490.
//
// Post-publication event: WOA became one of the flagship targets of the
// "metaphor-based metaheuristics" critique. Camacho-Villalón, Dorigo &
// Stützle (IRIDIA, ULB) published "Exposing the grey wolf, moth-flame,
// whale, firefly, bat, and antlion algorithms: six misleading optimization
// techniques inspired by bestial metaphors" in International Transactions in
// Operational Research (online 2022-07-26; print 30(6), Nov 2023),
// DOI 10.1111/itor.13176. Their rigorous, component-based deconstruction
// relates WOA's operators to particle swarm optimization and evolutionary
// algorithms and concludes the whale metaphor brought no novel or useful
// concept to the field. This is a specific, dated methodological contest of
// the paper's central novelty claim by the expert literature — a
// RECORDED -> CONTESTED transition. No retraction, expression of concern, or
// adjudicating meta-analysis vindicating or overturning the algorithm exists,
// so the arc stops at CONTESTED.
//
// The baseline ClaimStatusHistory row (fromAxis=null -> RECORDED at the
// 2016-02-26 publication date) already exists and is NOT duplicated here.
//
// Idempotent: upserts on stable ids.
//
// Run: npx tsx scripts/enrichments/enrich-corpus-openalex_v1-whale-optimization-algorithm.ts

import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CLAIM_ID = 'cmq2w4a6l006fsa8hu6g13j4x'

async function main() {
  // ── RECORDED -> CONTESTED: metaphor-critique naming WOA (2022-07-26) ──
  const source = await prisma.source.upsert({
    where: { externalId: 'src:woa-camacho-villalon-itor-2022' },
    create: {
      externalId: 'src:woa-camacho-villalon-itor-2022',
      name: 'Camacho-Villalón, C.L., Dorigo, M. & Stützle, T., "Exposing the grey wolf, moth-flame, whale, firefly, bat, and antlion algorithms: six misleading optimization techniques inspired by bestial metaphors," International Transactions in Operational Research (online 2022-07-26; 30(6):2945-2971, 2023).',
      url: 'https://doi.org/10.1111/itor.13176',
      publishedAt: new Date('2022-07-26'),
      methodologyType: 'derivative',
      ingestedBy: 'enrich:corpus-openalex_v1-whale-optimization-algorithm',
    },
    update: {
      name: 'Camacho-Villalón, C.L., Dorigo, M. & Stützle, T., "Exposing the grey wolf, moth-flame, whale, firefly, bat, and antlion algorithms: six misleading optimization techniques inspired by bestial metaphors," International Transactions in Operational Research (online 2022-07-26; 30(6):2945-2971, 2023).',
      url: 'https://doi.org/10.1111/itor.13176',
      publishedAt: new Date('2022-07-26'),
    },
  })

  const histId = `${CLAIM_ID}-CONTESTED-2022-07-26`
  await prisma.claimStatusHistory.upsert({
    where: { id: histId },
    create: {
      id: histId,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2022-07-26'),
      datePrecision: 'DAY',
      reason: 'Camacho-Villalón, Dorigo & Stützle (IRIDIA, Université Libre de Bruxelles) published a rigorous, component-based analysis in International Transactions in Operational Research that names the Whale Optimization Algorithm in its title and deconstructs it into operators equivalent to those of particle swarm optimization and evolutionary algorithms. They conclude the whale metaphor brought no novel or useful concept to metaheuristics, directly contesting the paper\'s central novelty claim. This is a specific, dated methodological challenge by the expert literature, moving the finding from RECORDED to CONTESTED.',
      sourceId: source.id,
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt: new Date('2022-07-26'),
      datePrecision: 'DAY',
      reason: 'Camacho-Villalón, Dorigo & Stützle (IRIDIA, Université Libre de Bruxelles) published a rigorous, component-based analysis in International Transactions in Operational Research that names the Whale Optimization Algorithm in its title and deconstructs it into operators equivalent to those of particle swarm optimization and evolutionary algorithms. They conclude the whale metaphor brought no novel or useful concept to metaheuristics, directly contesting the paper\'s central novelty claim. This is a specific, dated methodological challenge by the expert literature, moving the finding from RECORDED to CONTESTED.',
      sourceId: source.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: RECORDED -> CONTESTED (Camacho-Villalón et al., ITOR, 2022-07-26)`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
