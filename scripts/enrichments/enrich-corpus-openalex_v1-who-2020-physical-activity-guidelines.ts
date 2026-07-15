import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Bull FC, Al-Ansari SS, Biddle S, et al. "World Health Organization 2020
 *   guidelines on physical activity and sedentary behaviour."
 *   British Journal of Sports Medicine, 2020. DOI 10.1136/bjsports-2020-102955.
 *   Claim id: cmpm0kok60eujsa86mcn6k9no  (OpenAlex W3108106255, PMID 33239350)
 *
 * The paper describes the new WHO 2020 evidence-based recommendations on
 * physical activity and sedentary behaviour (e.g. 150–300 min/week moderate
 * activity for adults) developed by an expert Guideline Development Group.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2020-11-25) already exists; not
 * duplicated. Identity confirmed via DOI (10.1136/bjsports-2020-102955 ->
 * BJSM/PMC7719906), PubMed 33239350, and OpenAlex W3108106255. No retraction,
 * expression of concern, or update marker exists.
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2022-10-19 (INSTITUTIONAL)
 *       WHO published the "Global status report on physical activity 2022"
 *       (19 Oct 2022), its first dedicated global assessment of country
 *       implementation of physical-activity policy. The report adopts the
 *       2020 guideline recommendations as the operative benchmark against
 *       which insufficient activity and national progress are measured across
 *       194 member states — WHO's own global monitoring apparatus ratifying
 *       the 2020 guideline as the settled global standard.
 *
 * NOTE: The very high citation count (11k+) is NOT treated as a settling
 * event; the transition rests on the specific, dated WHO institutional report,
 * not on citation volume.
 */

const claimId = 'cmpm0kok60eujsa86mcn6k9no';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2022-10-19), WHO Global Status Report 2022 ---
  const sourceGSR = await prisma.source.upsert({
    where: { externalId: 'src:who-global-status-report-physical-activity-2022' },
    update: {},
    create: {
      externalId: 'src:who-global-status-report-physical-activity-2022',
      name:
        'World Health Organization. "Global status report on physical activity 2022." ' +
        'Geneva: WHO, 19 October 2022 (ISBN 9789240059153) — first global assessment of ' +
        'country implementation of physical-activity policy, benchmarked against the WHO ' +
        '2020 guidelines on physical activity and sedentary behaviour.',
      url: 'https://www.who.int/publications/i/item/9789240059153',
      publishedAt: new Date('2022-10-19'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2022-10-19');
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
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceGSR.id,
        reason:
          'On 19 October 2022 WHO published the "Global status report on physical activity ' +
          '2022," its first dedicated global assessment of country implementation of ' +
          'physical-activity policy. The report adopts the 2020 guideline recommendations as ' +
          'the operative benchmark for measuring insufficient activity and national progress ' +
          "across 194 member states — WHO's own global monitoring apparatus ratifying the " +
          '2020 guidelines as the settled global standard, a field-consensus settling of the finding.',
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
