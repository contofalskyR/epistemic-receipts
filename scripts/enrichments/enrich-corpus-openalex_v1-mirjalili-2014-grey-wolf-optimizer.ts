import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Mirjalili S, Mirjalili SM, Lewis A (2014).
 *   "Grey Wolf Optimizer." Advances in Engineering Software 69:46-61.
 *   DOI 10.1016/j.advengsoft.2013.12.007.
 *   Claim id: cmq2w461s003xsa8h663bi9cq  (OpenAlex W2061438946)
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2014-01-22) already exists; not duplicated.
 *
 * Post-publication event:
 *   No retraction / expression of concern (Crossref shows no update-to / updated-by).
 *   The paper's core CLAIM — that GWO is a novel swarm-intelligence metaheuristic —
 *   was directly and specifically challenged by a peer-reviewed methodological
 *   critique:
 *     Camacho-Villalón CL, Stützle T, Dorigo M (2020). "Grey Wolf, Firefly and Bat
 *     Algorithms: Three Widespread Algorithms that Do Not Contain Any Novelty."
 *     In: Swarm Intelligence (ANTS 2020), Lecture Notes in Computer Science 12421.
 *     DOI 10.1007/978-3-030-60376-2_10. Published online 2020-10-23.
 *   Via a component-by-component analysis the authors argue GWO introduces no novel
 *   search behavior and is a metaphor re-description of particle swarm optimization /
 *   evolutionary strategies. The critique was extended by the same group in
 *   Camacho-Villalón CL, Dorigo M, Stützle T (2022), "Exposing the grey wolf,
 *   moth-flame, whale, firefly, bat, and antlion algorithms: six misleading
 *   optimization techniques inspired by bestial metaphors," International
 *   Transactions in Operational Research (DOI 10.1111/itor.13176).
 *
 * This is a single RECORDED -> CONTESTED transition at the ANTS 2020 critique's
 * online-publication date. The algorithm remains widely applied, so there is no
 * warranted SETTLED (vindicated) or REVERSED (overturned) event. Community:
 * EXPERT_LITERATURE.
 */

const claimId = 'cmq2w461s003xsa8h663bi9cq';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2020-10-23), novelty critique ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1007/978-3-030-60376-2_10' },
    update: {},
    create: {
      externalId: 'src:doi:10.1007/978-3-030-60376-2_10',
      name:
        'Camacho-Villalón, Stützle & Dorigo (2020), "Grey Wolf, Firefly and Bat ' +
        'Algorithms: Three Widespread Algorithms that Do Not Contain Any Novelty," ' +
        'Swarm Intelligence (ANTS 2020), Lecture Notes in Computer Science 12421',
      url: 'https://doi.org/10.1007/978-3-030-60376-2_10',
      publishedAt: new Date('2020-10-23'),
      methodologyType: 'critique',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2020-10-23');
  const toAxis = 'CONTESTED';
  const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;

  await prisma.claimStatusHistory.upsert({
    where: { id: slug },
    update: {},
    create: {
      id: slug,
      claimId,
      fromAxis: 'RECORDED',
      toAxis,
      community: 'EXPERT_LITERATURE',
      occurredAt,
      datePrecision: 'DAY',
      sourceId: source.id,
      reason:
        "The Grey Wolf Optimizer's core novelty claim was directly challenged by a " +
        'peer-reviewed critique (Camacho-Villalón, Stützle & Dorigo, ANTS 2020), ' +
        'which, via a component-by-component analysis, argued GWO introduces no novel ' +
        'search behavior and is a metaphor re-description of particle swarm ' +
        'optimization / evolutionary strategies. The same group extended the critique ' +
        'in a 2022 International Transactions in Operational Research paper naming GWO ' +
        'among "six misleading optimization techniques inspired by bestial metaphors." ' +
        'This moves the finding from recorded to actively contested in the ' +
        'swarm-intelligence literature, though the algorithm remains widely applied.',
    },
  });

  console.log('Enrichment complete for claim', claimId);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
