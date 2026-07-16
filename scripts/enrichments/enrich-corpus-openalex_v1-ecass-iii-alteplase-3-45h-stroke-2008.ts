import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Hacke W, Kaste M, Bluhmki E, et al. (ECASS III Investigators).
 *   "Thrombolysis with Alteplase 3 to 4.5 Hours after Acute Ischemic Stroke."
 *   New England Journal of Medicine, 25 September 2008;359(13):1317-1329.
 *   DOI 10.1056/nejmoa0804656.
 *   Claim id: cmply8t3u02b9saihyvzn9exi  (OpenAlex W2159233098)
 *
 * ECASS III was the pivotal RCT reporting that intravenous alteplase given
 * 3-4.5 hours after ischemic stroke onset improved outcomes vs. placebo.
 *
 * Identity confirmed via Crossref: title "Thrombolysis with Alteplase 3 to 4.5
 * Hours after Acute Ischemic Stroke", NEJM, published 2008-09-25, matches the DOI
 * and OpenAlex ID. Crossref returns no update-to/updated-by (no retraction or EoC).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2008-09-25) already exists; not duplicated.
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> SETTLED @ 2009-08 (INSTITUTIONAL)
 *       del Zoppo GJ, Saver JL, Jauch EC, Adams HP Jr (AHA/ASA).
 *       "Expansion of the Time Window for Treatment of Acute Ischemic Stroke With
 *       Intravenous Tissue Plasminogen Activator: A Science Advisory from the
 *       American Heart Association/American Stroke Association." Stroke 2009 Aug;
 *       40(8):2945-2948. PMID 19478221. DOI 10.1161/STROKEAHA.109.192535.
 *       On the strength of ECASS III, the AHA/ASA formally expanded the recommended
 *       IV alteplase treatment window from 3 hours to 3-4.5 hours — institutional
 *       adoption of the finding into clinical practice guidance.
 *
 *   (2) SETTLED -> CONTESTED @ 2020-05-19 (EXPERT_LITERATURE)
 *       Alper BS, Foster G, Thabane L, Rae-Grant A, Malone-Moses M, Manheimer E.
 *       "Thrombolysis with alteplase 3-4.5 hours after acute ischaemic stroke:
 *       trial reanalysis adjusted for baseline imbalances." BMJ Evidence-Based
 *       Medicine 2020;25(5):168-171. PMID 32430395. DOI 10.1136/bmjebm-2020-111386.
 *       A formal reanalysis of the ECASS III data found that, after adjusting for
 *       baseline prognostic imbalances between arms, none of the efficacy outcomes
 *       remained statistically significant while the excess of symptomatic
 *       intracranial haemorrhage persisted — directly contesting the trial's
 *       positive conclusion and urging reconsideration of decisions based on it.
 */

const claimId = 'cmply8t3u02b9saihyvzn9exi';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2009-08), AHA/ASA guideline window expansion ---
  const sourceAdvisory = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1161/STROKEAHA.109.192535' },
    update: {},
    create: {
      externalId: 'src:doi:10.1161/STROKEAHA.109.192535',
      name:
        'del Zoppo GJ, et al. (AHA/ASA, 2009), "Expansion of the Time Window for ' +
        'Treatment of Acute Ischemic Stroke With Intravenous Tissue Plasminogen ' +
        'Activator: A Science Advisory," Stroke 40(8):2945-2948',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19478221/',
      publishedAt: new Date('2009-08-01'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2009-08-01');
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
        datePrecision: 'MONTH',
        sourceId: sourceAdvisory.id,
        reason:
          'On the strength of ECASS III, the American Heart Association/American ' +
          'Stroke Association issued a 2009 science advisory formally expanding the ' +
          'recommended intravenous alteplase treatment window from 3 hours to 3-4.5 ' +
          'hours after stroke onset. This institutional adoption into practice ' +
          'guidance settled the finding as the standard of care.',
      },
    });
  }

  // --- Transition 2: SETTLED -> CONTESTED (2020-05-19), ECASS III reanalysis ---
  const sourceAlper = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1136/bmjebm-2020-111386' },
    update: {},
    create: {
      externalId: 'src:doi:10.1136/bmjebm-2020-111386',
      name:
        'Alper BS, et al. (2020), "Thrombolysis with alteplase 3-4.5 hours after ' +
        'acute ischaemic stroke: trial reanalysis adjusted for baseline imbalances," ' +
        'BMJ Evidence-Based Medicine 25(5):168-171',
      url: 'https://pubmed.ncbi.nlm.nih.gov/32430395/',
      publishedAt: new Date('2020-05-19'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2020-05-19');
    const toAxis = 'CONTESTED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'SETTLED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceAlper.id,
        reason:
          'Alper et al. (2020) formally reanalyzed the ECASS III data adjusting for ' +
          'baseline prognostic imbalances between the treatment arms. After adjustment, ' +
          'none of the efficacy outcomes remained statistically significant while the ' +
          'excess of symptomatic intracranial haemorrhage persisted. This peer-reviewed ' +
          'reanalysis directly contested the trial\'s positive conclusion and urged ' +
          'reconsideration of the 3-4.5 hour window derived from it.',
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
