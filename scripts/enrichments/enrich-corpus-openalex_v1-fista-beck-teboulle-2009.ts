import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Beck A, Teboulle M. "A Fast Iterative Shrinkage-Thresholding Algorithm for
 *   Linear Inverse Problems." SIAM Journal on Imaging Sciences, 2009;2(1):183-202.
 *   DOI 10.1137/080716542.
 *   Claim id: cmq2w4dqz008lsa8hg9q62lpa  (OpenAlex W2100556411)
 *
 * The FISTA paper introduced an accelerated proximal-gradient method achieving an
 * O(1/k^2) global convergence rate of the objective function value — a quadratic
 * improvement over the O(1/k) rate of ordinary ISTA — for large-scale linear
 * inverse problems in signal/image processing.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2009-01-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title "A Fast Iterative Shrinkage-Thresholding
 * Algorithm for Linear Inverse Problems", authors Beck A & Teboulle M, journal SIAM
 * J. Imaging Sci., 2009 — matches the DOI and OpenAlex ID. No retraction or expression
 * of concern (Crossref returns no update-to/updated-by).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2015-05-12 (EXPERT_LITERATURE)
 *       Chambolle A, Dossal Ch. "On the Convergence of the Iterates of the 'Fast
 *       Iterative Shrinkage/Thresholding Algorithm'." Journal of Optimization Theory
 *       and Applications, 2015;166(3):968-982. DOI 10.1007/s10957-015-0746-4.
 *       The original FISTA paper proved only convergence of the objective *value*
 *       at rate O(1/k^2); it left open whether the generated iterate *sequence*
 *       {x_k} itself converges. Chambolle & Dossal closed this gap, proving (with the
 *       parameter choice a>3 in the momentum rule) that the FISTA iterates converge
 *       to a minimizer. This rigorous completion of FISTA's theoretical foundation,
 *       published in the field's leading optimization-theory journal, settled the
 *       method's convergence guarantees — a specific, dated adjudicating document.
 */

const claimId = 'cmq2w4dqz008lsa8hg9q62lpa';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2015-05-12), Chambolle-Dossal iterate-convergence proof ---
  const sourceChambolleDossal = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1007/s10957-015-0746-4' },
    update: {},
    create: {
      externalId: 'src:doi:10.1007/s10957-015-0746-4',
      name:
        'Chambolle A, Dossal Ch. (2015), "On the Convergence of the Iterates of the ' +
        '\'Fast Iterative Shrinkage/Thresholding Algorithm\'," Journal of Optimization ' +
        'Theory and Applications 166(3):968-982',
      url: 'https://doi.org/10.1007/s10957-015-0746-4',
      publishedAt: new Date('2015-05-12'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2015-05-12');
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
        datePrecision: 'DAY',
        sourceId: sourceChambolleDossal.id,
        reason:
          'FISTA\'s 2009 paper proved an O(1/k^2) rate for the objective value but left ' +
          'open whether the iterate sequence itself converges. Chambolle & Dossal (JOTA, ' +
          '2015) closed this gap, proving that with the momentum parameter a>3 the FISTA ' +
          'iterates converge to a minimizer. This rigorous completion of the method\'s ' +
          'convergence theory, in the field\'s leading optimization-theory journal, ' +
          'settled FISTA\'s theoretical guarantees.',
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
