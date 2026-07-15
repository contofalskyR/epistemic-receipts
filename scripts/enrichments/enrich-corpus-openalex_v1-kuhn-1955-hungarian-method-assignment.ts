import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Kuhn HW. "The Hungarian method for the assignment problem."
 *   Naval Research Logistics Quarterly, March 1955. DOI 10.1002/nav.3800020109.
 *   Claim id: cmq2w4cnm007xsa8h0ur52a8m  (OpenAlex W2222512263)
 *
 * Kuhn's paper introduced the combinatorial "Hungarian method" for the
 * assignment problem, drawing on ideas from the Hungarian mathematicians
 * Kőnig and Egerváry.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1955-03-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns the record with no
 *     `update-to` / `updated-by` fields for the DOI (verified; DOI resolves 302).
 *   - This is an algorithm, not an empirical finding, so there is no failed
 *     replication or adjudicating meta-analysis in the empirical sense.
 *   - ADJUDICATION / CANONIZATION: Munkres J (1957). "Algorithms for the
 *     Assignment and Transportation Problems." Journal of the Society for
 *     Industrial and Applied Mathematics, March 1957. DOI 10.1137/0105003
 *     (verified resolves 302 to epubs.siam.org). Munkres gave the first rigorous
 *     proof of the method's correctness and established a polynomial (O(n^4))
 *     running-time bound, converting Kuhn's constructive proposal into a proven,
 *     complexity-characterized algorithm. The method has since been universally
 *     known as the "Kuhn–Munkres algorithm," reflecting its settled canonical
 *     status in combinatorial optimization.
 *
 * Single RECORDED -> SETTLED transition at Munkres's publication.
 * Community: EXPERT_LITERATURE. Date precision: MONTH.
 */

const claimId = 'cmq2w4cnm007xsa8h0ur52a8m';

async function main() {
  // --- Transition: RECORDED -> SETTLED (1957-03), correctness + complexity proof ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1137/0105003' },
    update: {},
    create: {
      externalId: 'src:doi:10.1137/0105003',
      name:
        'Munkres J (1957), "Algorithms for the Assignment and Transportation ' +
        'Problems," Journal of the Society for Industrial and Applied Mathematics',
      url: 'https://doi.org/10.1137/0105003',
      publishedAt: new Date('1957-03-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('1957-03-01');
  const toAxis = 'SETTLED';
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
      sourceId: source.id,
      reason:
        "Kuhn's Hungarian method moved from a recorded constructive proposal to a " +
        'settled, canonical algorithm through Munkres (1957), who supplied the first ' +
        'rigorous proof of correctness and established a polynomial O(n^4) running-time ' +
        'bound. This adjudication in the expert literature ratified the method as a ' +
        'proven, complexity-characterized procedure — thereafter universally cited as ' +
        'the "Kuhn–Munkres algorithm" — rather than an unverified heuristic.',
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
