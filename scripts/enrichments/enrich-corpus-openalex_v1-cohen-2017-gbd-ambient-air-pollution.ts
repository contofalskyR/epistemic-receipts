import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Cohen AJ, Brauer M, Burnett R, Anderson HR, Frostad J, et al.
 *   "Estimates and 25-year trends of the global burden of disease attributable
 *   to ambient air pollution: an analysis of data from the Global Burden of
 *   Diseases Study 2015." The Lancet, 2017 May;389(10082):1907-1918.
 *   DOI 10.1016/S0140-6736(17)30505-6.
 *   Claim id: cmq2w536h00o3sa8hsdabcnod  (OpenAlex W2607350314)
 *
 * The paper (GBD 2015) estimated global population-weighted PM2.5 and ozone
 * concentrations and attributed ~4.2 million deaths and a large disease burden
 * to ambient air pollution, ranking it a leading contributor to global disease
 * burden with rising trends across 1990-2015.
 *
 * Identity confirmed via Crossref: title matches, container "The Lancet",
 * published 2017-05, lead authors Cohen/Brauer/Burnett/Anderson/Frostad,
 * matching the DOI and OpenAlex ID. Crossref returns no update-to relation
 * (no retraction or expression of concern); isRetracted = false.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2017-04-10) already exists; not duplicated.
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2021-09-22 (INSTITUTIONAL)
 *       WHO. "WHO global air quality guidelines: particulate matter (PM2.5 and
 *       PM10), ozone, nitrogen dioxide, sulfur dioxide and carbon monoxide."
 *       Geneva: World Health Organization, 22 September 2021.
 *       On the strength of an accumulated evidence base (a systematic review of
 *       500+ studies) establishing that ambient air pollution is a leading cause
 *       of death and disease burden, WHO tightened its recommended PM2.5 limits
 *       for the first time since 2005. This formal, institution-issued guideline
 *       constitutes a field consensus statement adopting the very finding this
 *       GBD 2015 analysis quantified, and reflects independent reaffirmation by
 *       the GBD 2019 risk-factor analysis (Lancet, Oct 2020, DOI
 *       10.1016/S0140-6736(20)30752-2), which again ranked ambient PM2.5 among
 *       the leading global mortality risks. No prior dated contestation of the
 *       finding was identified, so the arc is a direct RECORDED -> SETTLED.
 */

const claimId = 'cmq2w536h00o3sa8hsdabcnod';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2021-09-22), WHO 2021 Global Air Quality Guidelines ---
  const sourceWho = await prisma.source.upsert({
    where: { externalId: 'src:who:global-air-quality-guidelines-2021' },
    update: {},
    create: {
      externalId: 'src:who:global-air-quality-guidelines-2021',
      name:
        'World Health Organization (2021), "WHO global air quality guidelines: ' +
        'particulate matter (PM2.5 and PM10), ozone, nitrogen dioxide, sulfur ' +
        'dioxide and carbon monoxide," Geneva, 22 September 2021',
      url: 'https://www.who.int/news/item/22-09-2021-new-who-global-air-quality-guidelines-aim-to-save-millions-of-lives-from-air-pollution',
      publishedAt: new Date('2021-09-22'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2021-09-22');
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
        sourceId: sourceWho.id,
        reason:
          'On 22 September 2021 the World Health Organization issued new Global Air ' +
          'Quality Guidelines, tightening recommended PM2.5 limits for the first time ' +
          'since 2005 on the strength of a systematic review of 500+ studies establishing ' +
          'ambient air pollution as a leading cause of death and disease burden. This ' +
          'institution-issued guideline adopts the finding that GBD 2015 (Cohen et al., ' +
          '2017) quantified, and it aligns with the GBD 2019 risk-factor analysis ' +
          '(Lancet, Oct 2020) that again ranked ambient PM2.5 among the top global ' +
          'mortality risks. No prior dated contestation was found, so the arc is a ' +
          'direct RECORDED -> SETTLED.',
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
