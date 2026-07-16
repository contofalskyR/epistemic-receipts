import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Pintrich, P. R., & De Groot, E. V. "Motivational and self-regulated learning
 *   components of classroom academic performance."
 *   Journal of Educational Psychology 1990;82(1):33–40.
 *   DOI: 10.1037/0022-0663.82.1.33   (OpenAlex W2106760415)
 *   Claim id: cmplxlckp00d1sa7ffhgrcsm7
 *
 * Identity confirmed via Crossref: DOI 10.1037/0022-0663.82.1.33 resolves to
 * "Motivational and self-regulated learning components of classroom academic
 * performance." by Pintrich & De Groot, Journal of Educational Psychology,
 * March 1990 — matching the given OpenAlex ID and DOI.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1990-03-01) already exists; not duplicated.
 * No retraction or expression of concern exists (Crossref shows no update-to record;
 * isRetracted is null/false). This is a correlational/measurement finding, adjudicated
 * by subsequent meta-analysis rather than by replication-report or retraction pathways.
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2011-05 (EXPERT_LITERATURE)
 *       The central finding — that self-regulated learning components (self-efficacy,
 *       self-regulation, use of learning strategies) predict classroom academic
 *       performance — was adjudicated and vindicated by the meta-analysis:
 *       Sitzmann, T., & Ely, K. "A meta-analysis of self-regulated learning in
 *       work-related training and educational attainment: What we know and where we
 *       need to go." Psychological Bulletin 2011;137(3):421–442
 *       (DOI 10.1037/a0022777, PMID 21401218). Pooling 430 studies, it found the
 *       self-regulation constructs — with self-efficacy among the strongest single
 *       predictors — reliably related to learning and performance, establishing the
 *       Pintrich–De Groot framework as settled consensus in educational psychology.
 *       There was no prior contest, so the transition is RECORDED -> SETTLED.
 *       Verified: PMID 21401218 (PubMed 200); Crossref metadata for DOI 10.1037/a0022777.
 */

const claimId = 'cmplxlckp00d1sa7ffhgrcsm7';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2011-05), Sitzmann & Ely meta-analysis ---
  const sourceSitzmannEly = await prisma.source.upsert({
    where: { externalId: 'src:sitzmann-ely-self-regulated-learning-meta-2011' },
    update: {},
    create: {
      externalId: 'src:sitzmann-ely-self-regulated-learning-meta-2011',
      name:
        'Sitzmann, T., & Ely, K. "A meta-analysis of self-regulated learning in ' +
        'work-related training and educational attainment: What we know and where ' +
        'we need to go." Psychological Bulletin 2011;137(3):421–442.',
      url: 'https://pubmed.ncbi.nlm.nih.gov/21401218/',
      publishedAt: new Date('2011-05-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2011-05-01');
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
        sourceId: sourceSitzmannEly.id,
        reason:
          'The core finding — that self-regulated learning components (self-efficacy, ' +
          'self-regulation, and use of learning strategies) predict classroom academic ' +
          'performance — was adjudicated and vindicated by Sitzmann & Ely\'s meta-analysis ' +
          '(Psychological Bulletin, May 2011). Pooling 430 studies, it confirmed that the ' +
          'self-regulation constructs, with self-efficacy among the strongest single ' +
          'predictors, reliably relate to learning and performance, establishing the ' +
          'Pintrich–De Groot framework as settled consensus in educational psychology. ' +
          'No prior contest existed, so the finding moves RECORDED -> SETTLED.',
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
