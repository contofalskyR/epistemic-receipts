import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Levenberg K. "A method for the solution of certain non-linear problems in
 *   least squares." Quarterly of Applied Mathematics 2(2):164-168, July 1944.
 *   DOI 10.1090/qam/10666.
 *   Claim id: cmq2w4dhd008fsa8h4ct1ef21  (OpenAlex W2256578114)
 *
 * The paper introduced the "damped" least-squares method: adding a
 * ridge/damping term to the Gauss-Newton normal equations to guarantee a
 * descent step for non-linear least-squares problems.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1944-07-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns the original DOI
 *     10.1090/qam/10666 with empty `update-to` / `updated-by` fields (verified;
 *     HTTP 200, title/author/venue confirmed: Kenneth Levenberg, Quarterly of
 *     Applied Mathematics 2(2):164-168, 1944-07).
 *   - This is a foundational numerical method, not an empirical claim: there is
 *     no failed-replication or methodological-refutation event. The single dated,
 *     citable adjudicating document is a field-consensus/vindication event.
 *   - SETTLED (1963-06): Marquardt DW. "An Algorithm for Least-Squares Estimation
 *     of Nonlinear Parameters." Journal of the Society for Industrial and Applied
 *     Mathematics 11(2):431-441, June 1963. DOI 10.1137/0111030 (verified: Crossref
 *     confirms title/author/venue/date; HTTP 200; no update flags). Marquardt
 *     generalized Levenberg's damping into an adaptive interpolation between
 *     Gauss-Newton and steepest descent, demonstrated its robustness, and thereby
 *     established the method as the canonical, field-standard algorithm — now
 *     universally named the "Levenberg-Marquardt" algorithm. This adjudication in
 *     the expert literature ratified Levenberg's method into settled consensus.
 *
 * Arc: RECORDED (1944-07) -> SETTLED (1963-06).
 * Community: EXPERT_LITERATURE. Date precision: MONTH.
 */

const claimId = 'cmq2w4dhd008fsa8h4ct1ef21';

async function main() {
  // --- Transition: RECORDED -> SETTLED (1963-06), Marquardt vindication/generalization ---
  const marquardtSource = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1137/0111030' },
    update: {},
    create: {
      externalId: 'src:doi:10.1137/0111030',
      name:
        'Marquardt DW (1963), "An Algorithm for Least-Squares Estimation of ' +
        'Nonlinear Parameters," Journal of the Society for Industrial and Applied ' +
        'Mathematics 11(2):431-441',
      url: 'https://doi.org/10.1137/0111030',
      publishedAt: new Date('1963-06-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('1963-06-01');
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
        sourceId: marquardtSource.id,
        reason:
          'Marquardt (Journal of the Society for Industrial and Applied ' +
          "Mathematics, June 1963) generalized Levenberg's 1944 damped " +
          'least-squares method into an adaptive scheme interpolating between the ' +
          'Gauss-Newton and steepest-descent steps, and demonstrated its ' +
          'robustness on non-linear estimation problems. The method became the ' +
          'canonical, field-standard algorithm for non-linear least squares — now ' +
          'universally named the "Levenberg-Marquardt" algorithm — settling ' +
          "Levenberg's approach as accepted consensus in the expert literature.",
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
