import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Rogers RW.
 *   "A Protection Motivation Theory of Fear Appeals and Attitude Change."
 *   The Journal of Psychology, September 1975;91(1):93-114.
 *   DOI 10.1080/00223980.1975.9915803.
 *   Claim id: cmpm1etk707k1sadngimy74pb  (OpenAlex W2081430061)
 *
 * The paper proposed protection motivation theory (PMT): fear appeals are
 * mediated by three appraisal processes keyed to (a) the noxiousness/severity
 * of a threatened event, (b) its probability of occurrence, and (c) the efficacy
 * of a protective response, framed as a special case of expectancy-value theory.
 *
 * Identity confirmed via Crossref: title "A Protection Motivation Theory of Fear
 * Appeals and Attitude Change", The Journal of Psychology, published 1975-09,
 * author Rogers, matching the DOI and OpenAlex ID. Crossref returns no update-to/
 * updated-by relation (no retraction or expression of concern); isRetracted = false.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1975-09-01) already exists; not duplicated.
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2000-02 (EXPERT_LITERATURE)
 *       Floyd DL, Prentice-Dunn S, Rogers RW.
 *       "A Meta-Analysis of Research on Protection Motivation Theory."
 *       Journal of Applied Social Psychology 2000;30(2):407-429.
 *       DOI 10.1111/j.1559-1816.2000.tb02323.x.
 *       This meta-analysis of ~25 years of PMT research (65 studies, 20 relevant
 *       studies quantitatively pooled), co-authored by the theory's originator,
 *       found that the four core PMT components (severity, vulnerability, response
 *       efficacy, self-efficacy) reliably predicted protective intentions and
 *       behavior with moderate effect sizes, adjudicating and vindicating the
 *       1975 framework. It is complemented by the parallel health-behavior
 *       meta-analytic review by Milne, Sheeran & Orbell (2000, same journal issue,
 *       DOI 10.1111/j.1559-1816.2000.tb02308.x), which reached converging
 *       conclusions. No prior dated contestation of the finding was identified,
 *       so the arc is recorded as a direct RECORDED -> SETTLED.
 */

const claimId = 'cmpm1etk707k1sadngimy74pb';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2000-02), Floyd et al. meta-analysis ---
  const sourceFloyd = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1111/j.1559-1816.2000.tb02323.x' },
    update: {},
    create: {
      externalId: 'src:doi:10.1111/j.1559-1816.2000.tb02323.x',
      name:
        'Floyd DL, Prentice-Dunn S, Rogers RW (2000), "A Meta-Analysis of Research ' +
        'on Protection Motivation Theory," Journal of Applied Social Psychology 30(2):407-429',
      url: 'https://doi.org/10.1111/j.1559-1816.2000.tb02323.x',
      publishedAt: new Date('2000-02-01'),
      methodologyType: 'meta-analysis',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2000-02-01');
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
        sourceId: sourceFloyd.id,
        reason:
          'Floyd, Prentice-Dunn & Rogers (2000, J Appl Soc Psychol) meta-analysed ' +
          'roughly 25 years of protection motivation theory research, finding that the ' +
          'core PMT appraisal components (severity, vulnerability, response efficacy, ' +
          'self-efficacy) reliably predicted protective intentions and behavior with ' +
          'moderate effect sizes. Co-authored by the theory\'s originator and converging ' +
          'with the parallel health-behavior meta-analysis of Milne, Sheeran & Orbell ' +
          '(2000, same journal issue), it adjudicated and vindicated the 1975 framework ' +
          'as settled in the expert literature. No prior dated contestation was found, ' +
          'so the arc is a direct RECORDED -> SETTLED.',
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
