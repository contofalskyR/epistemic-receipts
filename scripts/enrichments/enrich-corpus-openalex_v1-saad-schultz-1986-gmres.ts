import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Y. Saad & M. H. Schultz. "GMRES: A Generalized Minimal Residual Algorithm
 *   for Solving Nonsymmetric Linear Systems." SIAM Journal on Scientific and
 *   Statistical Computing, vol. 7, no. 3, pp. 856-869, July 1986.
 *   DOI 10.1137/0907058.
 *   Claim id: cmq2w4fe2009lsa8hvcq4wepl  (OpenAlex W2140153041)
 *
 * The paper introduces GMRES, a Krylov-subspace iterative method that
 * minimizes the residual norm at every step, generalizing Paige & Saunders'
 * MINRES and equivalent to GCR / ORTHODIR.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1986-07-01) already exists; not
 * duplicated. Identity confirmed via DOI resolution (10.1137/0907058 ->
 * epubs.siam.org/doi/10.1137/0907058) and OpenAlex W2140153041.
 * No retraction or expression of concern exists (a mathematical algorithm
 * paper with a correctness proof; no update-to/updated-by markers).
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2000 Q1 (EXPERT_LITERATURE)
 *       In the January/February 2000 "Top 10 Algorithms of the 20th Century"
 *       special issue of Computing in Science & Engineering (guest editors
 *       Jack Dongarra & Francis Sullivan), Krylov Subspace Iteration was named
 *       one of the ten algorithms with the greatest influence on science and
 *       engineering in the 20th century. Henk van der Vorst's accompanying
 *       article, "Krylov Subspace Iteration" (DOI 10.1109/5992.814655),
 *       explicitly names GMRES as the premier method for nonsymmetric systems.
 *       This professional-community canonization ratified GMRES as the settled
 *       standard tool for large, sparse, nonsymmetric linear systems.
 *
 * NOTE: The high OpenAlex citation count (11,070) is NOT treated as the
 * settling event; the transition rests on the specific, dated top-10
 * recognition that explicitly names GMRES.
 */

const claimId = 'cmq2w4fe2009lsa8hvcq4wepl';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2000 Q1), top-10-algorithm canonization ---
  const sourceTop10 = await prisma.source.upsert({
    where: { externalId: 'src:cise-top10-algorithms-2000-krylov-gmres' },
    update: {},
    create: {
      externalId: 'src:cise-top10-algorithms-2000-krylov-gmres',
      name:
        'Henk A. van der Vorst, "Krylov Subspace Iteration," Computing in Science & ' +
        'Engineering, vol. 2, no. 1, pp. 32-37, Jan/Feb 2000 — the "Top 10 Algorithms ' +
        'of the 20th Century" special issue (guest eds. J. Dongarra & F. Sullivan), ' +
        'naming Krylov subspace iteration a top-10 algorithm and citing GMRES by name.',
      url: 'https://doi.org/10.1109/5992.814655',
      publishedAt: new Date('2000-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2000-01-01');
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
        datePrecision: 'QUARTER',
        sourceId: sourceTop10.id,
        reason:
          'In the January/February 2000 "Top 10 Algorithms of the 20th Century" special ' +
          'issue of Computing in Science & Engineering, Krylov subspace iteration was ' +
          'named one of the ten most influential algorithms in 20th-century science and ' +
          'engineering; van der Vorst\'s accompanying survey explicitly names GMRES as ' +
          'the premier method for nonsymmetric systems. This professional-community ' +
          'canonization settled GMRES as the standard tool for large, sparse, ' +
          'nonsymmetric linear systems — a field-consensus settling of the finding, not ' +
          'a mere reflection of citation volume.',
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
