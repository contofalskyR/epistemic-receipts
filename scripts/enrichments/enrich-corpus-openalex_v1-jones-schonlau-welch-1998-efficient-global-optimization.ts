import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Jones D R, Schonlau M, Welch W J. "Efficient Global Optimization of
 *   Expensive Black-Box Functions." Journal of Global Optimization,
 *   13(4):455-492, December 1998.
 *   DOI: 10.1023/A:1008306431147
 *   Claim id: cmq2w4tsm00ifsa8hgl9swgsn  (OpenAlex W1510052597)
 *   Identity confirmed via Crossref: title "Efficient Global Optimization of
 *   Expensive Black-Box Functions", authors Jones/Schonlau/Welch,
 *   Journal of Global Optimization, 1998-12.
 *
 * The paper introduced the EGO algorithm: fit a kriging (Gaussian-process)
 * surrogate to a small set of expensive function evaluations, then iteratively
 * sample where an "Expected Improvement" (EI) acquisition function is maximal,
 * balancing exploitation and exploration. It is the founding instantiation of
 * what is now called Bayesian optimization.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1998-12-01) already exists; not duplicated.
 * No retraction or expression of concern exists (isRetracted=false); as a proven
 * algorithmic method it was never contested (no failed-replication surface).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2016-01 (EXPERT_LITERATURE)
 *       Shahriari B, Swersky K, Wang Z, Adams R P, de Freitas N. "Taking the
 *       Human Out of the Loop: A Review of Bayesian Optimization." Proceedings
 *       of the IEEE 104(1):148-175, Jan 2016 (DOI 10.1109/JPROC.2015.2494218) —
 *       the canonical review of Bayesian optimization — adjudicates EGO and the
 *       Expected Improvement criterion of Jones-Schonlau-Welch (1998) as the
 *       foundational method of the field and directly cites it (DOI
 *       10.1023/A:1008306431147 appears in the review's bibliography), settling
 *       EI-based surrogate optimization as established practice in the expert
 *       literature. Verified: https://doi.org/10.1109/JPROC.2015.2494218
 *       (302 -> IEEE Xplore document 7352306).
 *
 * A single, dated, DOI-verifiable adjudicating document is preferred over
 * padding with speculative transitions.
 */

const claimId = 'cmq2w4tsm00ifsa8hgl9swgsn';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2016-01), canonical BayesOpt review ---
  const sourceReview = await prisma.source.upsert({
    where: { externalId: 'src:doi-10.1109-JPROC.2015.2494218' },
    update: {},
    create: {
      externalId: 'src:doi-10.1109-JPROC.2015.2494218',
      name:
        'Shahriari B, Swersky K, Wang Z, Adams R P, de Freitas N. "Taking the ' +
        'Human Out of the Loop: A Review of Bayesian Optimization." Proceedings ' +
        'of the IEEE, 104(1):148-175, January 2016. Canonical review that ' +
        'establishes the EGO algorithm and Expected Improvement criterion of ' +
        'Jones-Schonlau-Welch (1998) as the foundational method of Bayesian ' +
        'optimization.',
      url: 'https://doi.org/10.1109/JPROC.2015.2494218',
      publishedAt: new Date('2016-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2016-01-01');
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
        sourceId: sourceReview.id,
        reason:
          'The EGO algorithm and its Expected Improvement acquisition criterion, ' +
          'introduced by Jones, Schonlau & Welch (1998), were adjudicated as the ' +
          'foundational method of Bayesian optimization by Shahriari et al., ' +
          '"Taking the Human Out of the Loop: A Review of Bayesian Optimization" ' +
          '(Proceedings of the IEEE, Jan 2016) — the field\'s canonical review, ' +
          'which surveys EI-based surrogate optimization as established practice ' +
          'and directly cites the 1998 paper in its bibliography. This settles the ' +
          'method in the expert literature.',
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
