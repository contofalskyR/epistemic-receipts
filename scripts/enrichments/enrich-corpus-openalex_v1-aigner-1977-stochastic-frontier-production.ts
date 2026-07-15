import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Aigner D, Lovell CAK, Schmidt P. "Formulation and estimation of stochastic
 *   frontier production function models." Journal of Econometrics 6(1):21–37,
 *   July 1977. DOI 10.1016/0304-4076(77)90052-5.
 *   Claim id: cmq2w4ino00blsa8hbe90hlqj  (OpenAlex W2033834012)
 *
 * This is the founding "ALS" paper of stochastic frontier analysis: it
 * introduced the composed-error production frontier y = f(x) + v - u, where v is
 * symmetric noise and u >= 0 is one-sided technical inefficiency.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1977-07-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the DOI
 *     with null `update-to` / `updated-by` fields (verified 2026-07-15). Not
 *     flagged retracted (isRetracted=false).
 *   - This is an econometric methodology paper, not an empirical finding, so there
 *     is no failed replication or adjudicating meta-analysis to record.
 *   - FIELD CONSENSUS SHIFT (operationalization / canonization):
 *     Jondrow J, Lovell CAK, Materov IS, Schmidt P (1982). "On the estimation of
 *     technical inefficiency in the stochastic frontier production function
 *     model." Journal of Econometrics 19(2–3):233–238. DOI
 *     10.1016/0304-4076(82)90004-5 (published August 1982; Crossref HTTP 200,
 *     verified 2026-07-15). The ALS 1977 model could only decompose the total
 *     error variance into noise and inefficiency components — it could NOT recover
 *     the inefficiency of any individual firm, which is the quantity practitioners
 *     actually want. JLMS 1982 derived the conditional expectation E[u | v - u],
 *     giving a firm-specific point estimator of technical inefficiency. This
 *     closed the one gap that had kept the frontier from being usable for its
 *     intended purpose and cemented the ALS composed-error frontier as the settled,
 *     standard tool of efficiency and productivity measurement in the expert
 *     literature.
 *
 * Single RECORDED -> SETTLED transition at the operationalizing paper's publication
 * month. Community: EXPERT_LITERATURE. Date precision: MONTH.
 * (No CONTESTED or REVERSED event: JLMS 1982 completed and ratified the ALS
 *  framework rather than overturning it, and there is no dated public challenge to
 *  the 1977 finding to record.)
 */

const claimId = 'cmq2w4ino00blsa8hbe90hlqj';

async function main() {
  // --- Transition: RECORDED -> SETTLED (1982-08), operationalization / canonization ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/0304-4076(82)90004-5' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/0304-4076(82)90004-5',
      name:
        'Jondrow J, Lovell CAK, Materov IS, Schmidt P (1982), "On the estimation ' +
        'of technical inefficiency in the stochastic frontier production function ' +
        'model," Journal of Econometrics 19(2–3):233–238',
      url: 'https://doi.org/10.1016/0304-4076(82)90004-5',
      publishedAt: new Date('1982-08-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('1982-08-01');
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
        'The Aigner–Lovell–Schmidt (1977) composed-error stochastic frontier moved ' +
        'from a recorded formulation to settled, standard methodology through ' +
        'Jondrow, Lovell, Materov & Schmidt (1982, Journal of Econometrics). ALS ' +
        '1977 could only decompose the error variance into noise and inefficiency ' +
        'and could not estimate any individual firm\'s inefficiency; JLMS 1982 ' +
        'derived the conditional expectation E[u | v−u], yielding a firm-specific ' +
        'inefficiency estimator that made the frontier usable for its intended ' +
        'purpose and ratified it in the expert literature as the standard tool of ' +
        'efficiency and productivity measurement.',
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
