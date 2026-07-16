import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Epistemic receipt enrichment for claim cmq2w502v00m9sa8hxm818so6
// "Multiobjective Optimization Using Nondominated Sorting in Genetic Algorithms"
// Srinivas, N. & Deb, K. (1994) Evolutionary Computation 2(3):221-248
// DOI 10.1162/evco.1994.2.3.221 — OpenAlex W2116661285
//
// Baseline row (fromAxis=null -> RECORDED @ 1994-09) already exists; do NOT duplicate.
//
// Post-publication event: NSGA-II (Deb, Pratap, Agarwal & Meyarivan, IEEE Trans.
// Evolutionary Computation 6(2):182-197, April 2002, DOI 10.1109/4235.996017)
// explicitly identifies three weaknesses of the original NSGA — O(MN^3) sorting
// complexity, absence of elitism, and dependence on a user-specified sharing
// parameter (sigma_share) — and supersedes it. A specific, dated methodological
// critique => RECORDED -> CONTESTED.

const CLAIM_ID = 'cmq2w502v00m9sa8hxm818so6'

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (NSGA-II critique / supersession) ---
  const nsga2 = await prisma.source.upsert({
    where: { externalId: 'src:nsga-ii-deb-2002' },
    create: {
      name: 'Deb, Pratap, Agarwal & Meyarivan (2002), "A fast and elitist multiobjective genetic algorithm: NSGA-II", IEEE Transactions on Evolutionary Computation 6(2):182-197',
      url: 'https://doi.org/10.1109/4235.996017',
      publishedAt: new Date('2002-04-01'),
      methodologyType: 'primary',
      ingestedBy: 'openalex_v1-enrichment',
    },
    update: {
      url: 'https://doi.org/10.1109/4235.996017',
      publishedAt: new Date('2002-04-01'),
      methodologyType: 'primary',
    },
  })

  const occurredAt = new Date('2002-04-01')
  const slug = `${CLAIM_ID}-CONTESTED-${occurredAt.toISOString().slice(0, 10)}`

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    create: {
      id: slug,
      claimId: CLAIM_ID,
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      sourceId: nsga2.id,
      reason:
        'Deb, Pratap, Agarwal & Meyarivan\'s "A fast and elitist multiobjective genetic algorithm: NSGA-II" (IEEE Trans. Evolutionary Computation 6(2):182-197, April 2002) explicitly identified three weaknesses of the original NSGA: the O(MN^3) computational complexity of its nondominated sorting, its lack of elitism, and its reliance on a user-specified sharing parameter (sigma_share). NSGA-II replaced NSGA\'s sorting and diversity machinery with fast nondominated sorting and crowding distance and largely superseded the 1994 algorithm in practice. This is a specific, dated methodological critique of the original method by the same research group.',
    },
    update: {
      fromAxis: 'RECORDED',
      toAxis: 'CONTESTED',
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'MONTH',
      sourceId: nsga2.id,
    },
  })

  console.log(`Enriched claim ${CLAIM_ID}: +1 transition (RECORDED -> CONTESTED @ ${slug})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
