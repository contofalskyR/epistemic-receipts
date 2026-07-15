import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Holick MF, Binkley NC, Bischoff-Ferrari HA, et al.
 *   "Evaluation, Treatment, and Prevention of Vitamin D Deficiency:
 *    an Endocrine Society Clinical Practice Guideline."
 *   J Clin Endocrinol Metab, July 2011. DOI 10.1210/jc.2011-0385.
 *   Claim id: cmply455s0019saihxwnd3s5a  (OpenAlex W2153059487)
 *
 * The 2011 Endocrine Society guideline recommended broad evaluation for
 * vitamin D deficiency in at-risk patients, defined deficiency as serum
 * 25(OH)D < 20 ng/mL (with a 30 ng/mL sufficiency target), and endorsed
 * screening-and-treat management in a wide population.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2011-06-07) already exists; not duplicated.
 * Identity confirmed via Crossref: title/authors (Holick, Binkley, Bischoff-Ferrari) /
 * JCEM / 2011 match the DOI and OpenAlex ID. No retraction or expression of concern
 * (Crossref returns no update-to / updated-by).
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2012-04 (EXPERT_LITERATURE)
 *       Rosen CJ, Abrams SA, Aloia JF, et al.
 *       "IOM Committee Members Respond to Endocrine Society Vitamin D Guideline."
 *       J Clin Endocrinol Metab 2012;97(4):1146-1152. PMID 22442278.
 *       DOI 10.1210/jc.2011-2218. Members of the Institute of Medicine (IOM)
 *       Dietary Reference Intakes committee publicly disputed the Endocrine
 *       Society's thresholds and its endorsement of widespread screening,
 *       arguing the 30 ng/mL target and broad-testing approach were not
 *       supported by the population evidence. A specific, dated, peer-reviewed
 *       challenge to the finding.
 *
 *   (2) CONTESTED -> REVERSED @ 2024-07-12 (INSTITUTIONAL)
 *       Demay MB, Pittas AG, Bikle DD, et al.
 *       "Vitamin D for the Prevention of Disease: An Endocrine Society
 *        Clinical Practice Guideline."
 *       J Clin Endocrinol Metab 2024;109(8):1907-1947. PMID 38828931.
 *       DOI 10.1210/clinem/dgae290. The same issuing body superseded its 2011
 *       guidance: it recommends AGAINST routine 25(OH)D testing in healthy
 *       adults, declines to endorse the 2011 serum thresholds for the general
 *       population, and does not support broad screen-and-treat management —
 *       an institutional reversal of the 2011 guideline's core recommendations.
 */

const claimId = 'cmply455s0019saihxwnd3s5a';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2012-04), IOM committee rebuttal ---
  const sourceRosen = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1210/jc.2011-2218' },
    update: {},
    create: {
      externalId: 'src:doi:10.1210/jc.2011-2218',
      name:
        'Rosen CJ, Abrams SA, Aloia JF, et al. (2012), "IOM Committee Members ' +
        'Respond to Endocrine Society Vitamin D Guideline," J Clin Endocrinol ' +
        'Metab 97(4):1146-1152',
      url: 'https://pubmed.ncbi.nlm.nih.gov/22442278/',
      publishedAt: new Date('2012-04-01'),
      methodologyType: 'opinion',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2012-04-01');
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
        datePrecision: 'MONTH',
        sourceId: sourceRosen.id,
        reason:
          'Members of the IOM Dietary Reference Intakes committee publicly ' +
          "disputed the Endocrine Society guideline's thresholds and its " +
          'endorsement of widespread screening, arguing the 30 ng/mL ' +
          'sufficiency target and broad-testing approach were not supported by ' +
          'the population-level evidence. This dated, peer-reviewed rebuttal in ' +
          'the same journal marked the finding as actively contested.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> REVERSED (2024-07-12), Endocrine Society supersession ---
  const sourceDemay = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1210/clinem/dgae290' },
    update: {},
    create: {
      externalId: 'src:doi:10.1210/clinem/dgae290',
      name:
        'Demay MB, Pittas AG, Bikle DD, et al. (2024), "Vitamin D for the ' +
        'Prevention of Disease: An Endocrine Society Clinical Practice ' +
        'Guideline," J Clin Endocrinol Metab 109(8):1907-1947',
      url: 'https://pubmed.ncbi.nlm.nih.gov/38828931/',
      publishedAt: new Date('2024-07-12'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2024-07-12');
    const toAxis = 'REVERSED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis,
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceDemay.id,
        reason:
          'The Endocrine Society superseded its own 2011 guideline: the 2024 ' +
          'guideline recommends against routine 25(OH)D testing in healthy ' +
          'adults, declines to endorse the 2011 serum thresholds for the ' +
          'general population, and does not support the broad screen-and-treat ' +
          'management the 2011 document advised. The issuing body reversing its ' +
          "prior core recommendations is an institutional reversal of the finding.",
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
