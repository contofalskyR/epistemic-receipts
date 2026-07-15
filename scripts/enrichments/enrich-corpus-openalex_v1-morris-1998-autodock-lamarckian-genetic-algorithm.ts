import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Morris GM, Goodsell DS, Halliday RS, Huey R, Hart WE, Belew RK, Olson AJ.
 *   "Automated docking using a Lamarckian genetic algorithm and an empirical
 *   binding free energy function." Journal of Computational Chemistry,
 *   15 November 1998, 19(14):1639-1662. DOI
 *   10.1002/(SICI)1096-987X(19981115)19:14<1639::AID-JCC10>3.0.CO;2-B.
 *   Claim id: cmq2w4g7p00a3sa8hsl6q393s  (OpenAlex W2158534713)
 *
 * The paper introduced the Lamarckian genetic algorithm search method and the
 * empirical binding free energy scoring function shipped in AutoDock 3.0 — the
 * foundational method underpinning one of the most-cited docking tools in
 * computational chemistry (~10,800 citations).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1998-11-15) already exists; not duplicated.
 * Identity confirmed via the DOI + OpenAlex ID (title/authors/1998 J Comput Chem match).
 * No retraction, correction, or expression of concern exists (checked Crossref /
 * publisher / web); the method was never contested as invalid, so there is no
 * CONTESTED phase — the arc runs directly RECORDED -> SETTLED.
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2018-07-25 (EXPERT_LITERATURE)
 *       Gaillard T. "Evaluation of AutoDock and AutoDock Vina on the CASF-2013
 *       Benchmark." Journal of Chemical Information and Modeling, 2018,
 *       58(8):1697-1706. Epub 25 July 2018. PMID 29989806.
 *       DOI 10.1021/acs.jcim.8b00312.
 *       CASF (Comparative Assessment of Scoring Functions) is the community-
 *       standard, independent benchmark for docking programs. This evaluation
 *       ran AutoDock's method against the CASF-2013 core set and found AutoDock
 *       (and Vina) competitive among all methods tested — Vina ranking best of
 *       all methods on docking (pose-prediction) power — establishing the
 *       Lamarckian-GA docking approach as a validated field standard two decades
 *       after publication. The benchmark simultaneously documents that the
 *       empirical scoring function is not top-tier for absolute affinity ranking,
 *       but its central claim (robust prediction of bound conformations) is
 *       independently confirmed. This settles the method's standing in the
 *       expert literature; there was never a contest, so RECORDED -> SETTLED.
 */

const claimId = 'cmq2w4g7p00a3sa8hsl6q393s';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2018-07-25), CASF-2013 community benchmark ---
  const sourceCasf = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1021/acs.jcim.8b00312' },
    update: {},
    create: {
      externalId: 'src:doi:10.1021/acs.jcim.8b00312',
      name:
        'Gaillard T (2018), "Evaluation of AutoDock and AutoDock Vina on the ' +
        'CASF-2013 Benchmark," Journal of Chemical Information and Modeling, ' +
        '58(8):1697-1706 (PMID 29989806)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/29989806/',
      publishedAt: new Date('2018-07-25'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2018-07-25');
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
        sourceId: sourceCasf.id,
        reason:
          'The CASF-2013 benchmark evaluation by Gaillard (2018) independently ' +
          'tested AutoDock\u2019s Lamarckian-GA docking method against the ' +
          'community-standard Comparative Assessment of Scoring Functions core ' +
          'set, finding AutoDock (and Vina) competitive among all methods and ' +
          'Vina best of all on docking (pose-prediction) power. This confirmed ' +
          'the paper\u2019s central claim \u2014 robust automated prediction of ' +
          'bound conformations \u2014 as a validated field standard two decades ' +
          'after publication, while noting the empirical scoring function is not ' +
          'top-tier for absolute affinity ranking. The method was never contested ' +
          'as invalid, so the arc runs directly RECORDED -> SETTLED.',
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
