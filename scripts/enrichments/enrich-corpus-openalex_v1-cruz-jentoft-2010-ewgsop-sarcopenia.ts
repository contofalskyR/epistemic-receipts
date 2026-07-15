import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Cruz-Jentoft AJ, Baeyens JP, Bauer JM, et al. (European Working Group on
 *   Sarcopenia in Older People, EWGSOP).
 *   "Sarcopenia: European consensus on definition and diagnosis."
 *   Age and Ageing, online 2010-04-13, print 2010-07-01; 39(4):412-423.
 *   DOI 10.1093/ageing/afq034. Claim id cmplyb3kp03elsaih1aucgnmw (OpenAlex W2102902846).
 *
 * The original EWGSOP consensus proposed the first widely adopted operational
 * definition and diagnostic algorithm for age-related sarcopenia (low muscle
 * mass PLUS low muscle strength and/or low physical performance).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2010-04-13) already exists; not duplicated.
 * Identity confirmed via Crossref: title "Sarcopenia: European consensus on definition
 * and diagnosis", journal Age and Ageing, published-online 2010-04-13 — matches the DOI
 * and OpenAlex ID. No retraction or expression of concern (Crossref returns no
 * update-to/updated-by).
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2014-03-31 (EXPERT_LITERATURE)
 *       Studenski SA, Peters KW, Alley DE, et al.
 *       "The FNIH Sarcopenia Project: Rationale, Study Description, Conference
 *       Recommendations, and Final Estimates." J Gerontol A Biol Sci Med Sci
 *       2014;69(5):547-558. PMID 24737557. DOI 10.1093/gerona/glu010.
 *       The Foundation for the NIH Sarcopenia Project pooled data from nine cohorts
 *       to derive alternative, outcome-validated cutpoints for low grip strength and
 *       lean mass, explicitly because the EWGSOP (and other) consensus thresholds had
 *       not been anchored to clinical outcomes and no single operational definition
 *       commanded agreement — a specific, dated challenge to EWGSOP's diagnostic criteria.
 *
 *   (2) CONTESTED -> SETTLED @ 2018-09-24 (EXPERT_LITERATURE)
 *       Cruz-Jentoft AJ, Bahat G, Bauer J, et al. (EWGSOP2).
 *       "Sarcopenia: revised European consensus on definition and diagnosis."
 *       Age and Ageing, online 2018-09-24, print 2019;48(1):16-31. PMID 30312372.
 *       DOI 10.1093/ageing/afy169. The same working group reconvened to reconcile a
 *       decade of competing operationalizations, issuing a revised consensus that
 *       elevated low muscle strength as the primary parameter and updated cutpoints.
 *       The construct settled into an updated, broadly adopted expert-consensus
 *       definition rather than being overturned.
 */

const claimId = 'cmplyb3kp03elsaih1aucgnmw';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2014-03-31), FNIH Sarcopenia Project ---
  const sourceFNIH = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1093/gerona/glu010' },
    update: {},
    create: {
      externalId: 'src:doi:10.1093/gerona/glu010',
      name:
        'Studenski SA, Peters KW, Alley DE, et al. (2014), "The FNIH Sarcopenia ' +
        'Project: Rationale, Study Description, Conference Recommendations, and Final ' +
        'Estimates," J Gerontol A Biol Sci Med Sci 69(5):547-558',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24737557/',
      publishedAt: new Date('2014-03-31'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2014-03-31');
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
        datePrecision: 'DAY',
        sourceId: sourceFNIH.id,
        reason:
          'EWGSOP\'s operational criteria were contested by the FNIH Sarcopenia Project, ' +
          'which pooled nine cohorts to derive alternative, outcome-validated cutpoints for ' +
          'grip strength and lean mass — undertaken precisely because the EWGSOP consensus ' +
          'thresholds were not anchored to clinical outcomes and no single definition ' +
          'commanded agreement. A specific, dated methodological challenge in the expert ' +
          'literature to how sarcopenia should be diagnosed.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2018-09-24), EWGSOP2 revised consensus ---
  const sourceEWGSOP2 = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1093/ageing/afy169' },
    update: {},
    create: {
      externalId: 'src:doi:10.1093/ageing/afy169',
      name:
        'Cruz-Jentoft AJ, Bahat G, Bauer J, et al. (EWGSOP2, 2019), "Sarcopenia: ' +
        'revised European consensus on definition and diagnosis," Age and Ageing ' +
        '48(1):16-31',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30312372/',
      publishedAt: new Date('2018-09-24'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2018-09-24');
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
        datePrecision: 'DAY',
        sourceId: sourceEWGSOP2.id,
        reason:
          'The definitional dispute was resolved when the original working group reconvened ' +
          'as EWGSOP2 and issued a revised European consensus that reconciled a decade of ' +
          'competing operationalizations — elevating low muscle strength as the primary ' +
          'diagnostic parameter and updating cutpoints. The sarcopenia construct EWGSOP ' +
          'launched settled into an updated, broadly adopted expert-consensus definition ' +
          'rather than being overturned.',
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
