import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Karypis G, Kumar V. "A Fast and High Quality Multilevel Scheme for
 *   Partitioning Irregular Graphs." SIAM J. Sci. Comput. 1998;20(1):359-392.
 *   DOI 10.1137/S1064827595287997.  (OpenAlex W2070232376)
 *   Claim id: cmq2w5dd900u9sa8h8aa9kzf1
 *
 * This is the foundational METIS paper. The claim's open question is explicit:
 * from the early work it was clear multilevel techniques held promise, "however,
 * it was not known if they can be made to consistently produce high quality
 * partitions for graphs arising in a wide range of application domains."
 *
 * Identity confirmed via DOI + OpenAlex: Karypis & Kumar, heavy-edge coarsening
 * heuristic + boundary Kernighan-Lin refinement, implemented as METIS, SIAM JSC
 * 20(1):359-392 (1998). No retraction or expression of concern; not contested.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1998-01-01) already exists; not duplicated.
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2016-11-11 (EXPERT_LITERATURE)
 *       Buluç A, Meyerhenke H, Safro I, Sanders P, Schulz C. "Recent Advances in
 *       Graph Partitioning." In: Algorithm Engineering, LNCS vol. 9220,
 *       pp. 117-158. Springer, 2016. DOI 10.1007/978-3-319-49487-6_4.
 *       This authoritative survey by the leading graph-partitioning researchers
 *       establishes the multilevel paradigm (of which METIS is the archetype) as
 *       the de facto state of the art that reliably produces high-quality balanced
 *       partitions across the full range of application domains — directly
 *       adjudicating the open question the 1998 claim posed. There was never a
 *       public contest of the finding; multilevel partitioning was progressively
 *       validated into the field standard, so this is a RECORDED -> SETTLED arc
 *       with no intervening CONTESTED step.
 */

const claimId = 'cmq2w5dd900u9sa8h8aa9kzf1';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2016-11-11), field-consensus survey ---
  const sourceBuluc = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1007/978-3-319-49487-6_4' },
    update: {},
    create: {
      externalId: 'src:doi:10.1007/978-3-319-49487-6_4',
      name:
        'Buluç A, Meyerhenke H, Safro I, Sanders P, Schulz C (2016), ' +
        '"Recent Advances in Graph Partitioning," in Algorithm Engineering, ' +
        'LNCS 9220, pp. 117-158, Springer',
      url: 'https://link.springer.com/chapter/10.1007/978-3-319-49487-6_4',
      publishedAt: new Date('2016-11-11'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2016-11-11');
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
        sourceId: sourceBuluc.id,
        reason:
          'The 1998 open question — whether multilevel schemes could consistently ' +
          'produce high-quality partitions across a wide range of application ' +
          'domains — was settled by the authoritative Buluç et al. (2016) survey ' +
          '"Recent Advances in Graph Partitioning," which documents the multilevel ' +
          'paradigm (archetyped by METIS) as the field-standard state of the art ' +
          'delivering high-quality balanced partitions across applications. The ' +
          'finding was progressively validated rather than ever publicly contested, ' +
          'so the arc goes directly from RECORDED to SETTLED.',
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
