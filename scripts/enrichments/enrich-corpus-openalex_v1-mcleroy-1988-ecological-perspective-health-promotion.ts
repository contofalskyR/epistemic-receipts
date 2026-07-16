import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   McLeroy KR, Bibeau D, Steckler A, Glanz K.
 *   "An Ecological Perspective on Health Promotion Programs."
 *   Health Education Quarterly, December 1988; 15(4):351-377.
 *   DOI 10.1177/109019818801500401.
 *   Claim id: cmpm0f66b0ca7sa86but11a3q  (OpenAlex W2158089900)
 *
 * This is the foundational paper that answered the "victim-blaming" critique of
 * 1980s lifestyle-intervention health promotion by proposing an ECOLOGICAL model:
 * health behavior is shaped by five interacting levels of influence —
 * intrapersonal, interpersonal, institutional/organizational, community, and
 * public-policy factors — rather than by individual choice alone.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1988-12-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title/authors/journal/1988(12)/15(4):351-377 all
 * match the DOI and OpenAlex ID. No retraction or expression of concern
 * (Crossref returns no update-to / updated-by; not flagged on Retraction Watch).
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2012-06 (EXPERT_LITERATURE)
 *     Golden SD, Earp JL. "Social Ecological Approaches to Individuals and Their
 *     Contexts: Twenty Years of Health Education & Behavior Health Promotion
 *     Interventions." Health Education & Behavior 2012;39(3):364-372.
 *     PMID 22267868. DOI 10.1177/1090198111418634.
 *     This 20-year retrospective — published in the direct successor journal to
 *     Health Education Quarterly — developed a coding system for the five
 *     ecological levels McLeroy et al. introduced and applied it to 157
 *     intervention articles, treating the multi-level social-ecological model as
 *     THE established framework that "has long been recommended to guide public
 *     health practice." Its adjudication canonizes the ecological perspective as
 *     the field's organizing model (while critiquing that practice still
 *     concentrates on the individual/interpersonal levels) — a field-consensus
 *     settling of the finding in the expert literature.
 */

const claimId = 'cmpm0f66b0ca7sa86but11a3q';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2012-06), 20-year retrospective canonizing the model ---
  const sourceGolden = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1177/1090198111418634' },
    update: {},
    create: {
      externalId: 'src:doi:10.1177/1090198111418634',
      name:
        'Golden SD, Earp JL (2012), "Social Ecological Approaches to Individuals ' +
        'and Their Contexts: Twenty Years of Health Education & Behavior Health ' +
        'Promotion Interventions," Health Education & Behavior 39(3):364-372',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22267868/',
      publishedAt: new Date('2012-06-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2012-06-01');
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
        sourceId: sourceGolden.id,
        reason:
          "McLeroy et al.'s ecological perspective — that health behavior is shaped by " +
          'intrapersonal, interpersonal, institutional, community, and policy levels — became ' +
          'the settled organizing framework of health promotion. Golden & Earp (2012), in a ' +
          '20-year retrospective in the successor journal Health Education & Behavior, built a ' +
          'coding system around those five levels and applied it to 157 intervention articles, ' +
          'treating the multi-level social-ecological model as the established standard guiding ' +
          'public-health practice. This adjudication settles the finding as field consensus.',
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
