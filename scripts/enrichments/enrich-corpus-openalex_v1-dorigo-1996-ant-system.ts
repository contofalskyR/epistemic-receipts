import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Dorigo M, Maniezzo V, Colorni A. "Ant system: optimization by a colony of
 *   cooperating agents." IEEE Transactions on Systems, Man, and Cybernetics,
 *   Part B (Cybernetics), 1996;26(1):29–41. DOI 10.1109/3477.484436.
 *   Claim id: cmq2w4e0u008rsa8hyh0i49c8  (OpenAlex W2107941094)
 *
 * The foundational paper introducing Ant System (AS) — the first ant colony
 * optimization (ACO) algorithm — proposed as "a viable new approach to stochastic
 * combinatorial optimization," with the stated properties that positive feedback
 * yields rapid discovery of good solutions and that "distributed computation
 * avoids premature convergence."
 *
 * Identity verified via Crossref (HTTP 200): title, authors (Dorigo, Maniezzo,
 * Colorni), container (IEEE Trans. SMC-B), issued 1996-02. No `update-to` /
 * `updated-by` fields — no retraction or expression of concern.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1996-02-01) already exists; not duplicated.
 *
 * Post-publication arc (two transitions):
 *
 *   1. RECORDED -> CONTESTED (2000-06): Stützle T, Hoos HH. "MAX-MIN Ant System."
 *      Future Generation Computer Systems 2000;16(8):889–914.
 *      DOI 10.1016/S0167-739X(00)00043-1 (doi.org -> HTTP 200 verified).
 *      This paper documents that the basic Ant System suffers from stagnation /
 *      premature convergence and is outperformed on larger problem instances,
 *      motivating MMAS's explicit pheromone-trail bounds. It directly contests
 *      the abstract's claim that "distributed computation avoids premature
 *      convergence," which held only for small instances of the original AS.
 *
 *   2. CONTESTED -> SETTLED (2005-11): Dorigo M, Blum C. "Ant colony optimization
 *      theory: A survey." Theoretical Computer Science 2005;344(2-3):243–278.
 *      DOI 10.1016/j.tcs.2005.05.020 (doi.org -> HTTP 200 verified).
 *      This survey consolidates the convergence proofs for the ACO metaheuristic
 *      class that AS founded (i.e. proofs that ACO variants converge to the
 *      optimal solution), placing the paradigm on a firm theoretical footing.
 *      Together with the establishment of ACO as a canonical metaheuristic, it
 *      settles the 1996 paper's central claim that AS constitutes a viable new
 *      approach to combinatorial optimization.
 *
 * Community: EXPERT_LITERATURE (both). Date precision: MONTH (Crossref supports
 * year+month for both adjudicating documents).
 */

const claimId = 'cmq2w4e0u008rsa8hyh0i49c8';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2000-06) ---
  const contestSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/S0167-739X(00)00043-1' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/S0167-739X(00)00043-1',
      name:
        'Stützle T, Hoos HH (2000), "MAX-MIN Ant System," ' +
        'Future Generation Computer Systems 16(8):889–914',
      url: 'https://doi.org/10.1016/S0167-739X(00)00043-1',
      publishedAt: new Date('2000-06-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2000-06-01');
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
        datePrecision: 'MONTH',
        sourceId: contestSource.id,
        reason:
          "Stützle & Hoos's MAX-MIN Ant System paper documented that the basic " +
          'Ant System stagnates and converges prematurely on larger problem ' +
          'instances, where it is outperformed by improved variants. This directly ' +
          "contested the 1996 paper's stated property that distributed computation " +
          'avoids premature convergence, showing it held only for small instances ' +
          'and motivating explicit pheromone-trail bounds to keep the search from ' +
          'stagnating.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2005-11) ---
  const settleSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/j.tcs.2005.05.020' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/j.tcs.2005.05.020',
      name:
        'Dorigo M, Blum C (2005), "Ant colony optimization theory: A survey," ' +
        'Theoretical Computer Science 344(2-3):243–278',
      url: 'https://doi.org/10.1016/j.tcs.2005.05.020',
      publishedAt: new Date('2005-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2005-11-01');
    const toAxis = 'SETTLED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;

    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        sourceId: settleSource.id,
        reason:
          'Dorigo & Blum\'s "Ant colony optimization theory: A survey" consolidated ' +
          'the convergence proofs for the ACO metaheuristic class that Ant System ' +
          'founded, placing the paradigm on a firm theoretical footing rather than a ' +
          'purely empirical heuristic. Together with ACO\'s establishment as a ' +
          'canonical combinatorial-optimization metaheuristic, this settled the 1996 ' +
          "paper's central claim that Ant System was a viable new approach — the " +
          'contested stagnation limitation of the basic algorithm having been resolved ' +
          'within an accepted, theoretically grounded family of ant algorithms.',
      },
    });
  }

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
