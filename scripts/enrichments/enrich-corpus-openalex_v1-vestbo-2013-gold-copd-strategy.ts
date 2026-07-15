import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Vestbo J, Hurd SS, Agustí AG, et al. (2013). "Global Strategy for the
 *   Diagnosis, Management, and Prevention of Chronic Obstructive Pulmonary
 *   Disease: GOLD Executive Summary." Am J Respir Crit Care Med 187(4):347-365.
 *   DOI 10.1164/rccm.201204-0596pp  (OpenAlex W2127951128)
 *   Claim id: cmply4slf00clsaihnfzwngm2
 *
 * This is the executive summary of the second 5-year revision of the GOLD
 * strategy document. Its central recommendation: spirometry is REQUIRED for the
 * clinical diagnosis of COPD (to avoid misdiagnosis and grade airflow
 * limitation), together with the new multidimensional A/B/C/D assessment.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2012-08-09, online publication date)
 * already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the
 *     DOI with no `update-to` / `updated-by` fields (verified 2026-07-15).
 *   - This is a consensus strategy/guideline document, not a single empirical
 *     finding, so there is no failed replication or meta-analysis to record.
 *   - FIELD CONSENSUS SHIFT (successor consensus guideline): Vogelmeier CF,
 *     Criner GJ, Martinez FJ, et al. (2017). "Global Strategy for the Diagnosis,
 *     Management, and Prevention of Chronic Obstructive Lung Disease 2017 Report:
 *     GOLD Executive Summary." Eur Respir J 49(3):1700214.
 *     DOI 10.1183/13993003.00214-2017 (Crossref HTTP 200, verified resolves).
 *     The next authoritative 5-year GOLD revision REAFFIRMED the requirement of
 *     spirometry for COPD diagnosis while refining the ABCD assessment (moving
 *     spirometric grade out of the symptom-based grouping). It carried the
 *     diagnostic-spirometry standard forward rather than disputing it, cementing
 *     it as entrenched international consensus — hence SETTLED, not CONTESTED.
 *
 * Single RECORDED -> SETTLED transition at the 2017 GOLD revision's publication.
 * Community: INSTITUTIONAL (GOLD consensus guideline body).
 * Date precision: MONTH (Crossref published-print date-parts = [2017, 3]).
 */

const claimId = 'cmply4slf00clsaihnfzwngm2';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2017), successor GOLD consensus guideline ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1183/13993003.00214-2017' },
    update: {},
    create: {
      externalId: 'src:doi:10.1183/13993003.00214-2017',
      name:
        'Vogelmeier CF, Criner GJ, Martinez FJ, et al. (2017), "Global Strategy ' +
        'for the Diagnosis, Management, and Prevention of Chronic Obstructive ' +
        'Lung Disease 2017 Report: GOLD Executive Summary," European Respiratory ' +
        'Journal 49(3):1700214',
      url: 'https://doi.org/10.1183/13993003.00214-2017',
      publishedAt: new Date('2017-03-01'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2017-03-01');
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
      sourceId: source.id,
      reason:
        'The GOLD strategy\u2019s core recommendation \u2014 that spirometry is ' +
        'required for the clinical diagnosis of COPD \u2014 moved from a recorded ' +
        'guideline recommendation to settled international consensus. The 2017 GOLD ' +
        'Report (Vogelmeier et al.), the next authoritative 5-year revision from the ' +
        'same consensus body, reaffirmed the spirometry requirement for diagnosis ' +
        'while refining the A/B/C/D assessment tool. The successor guideline carried ' +
        'the diagnostic-spirometry standard forward as the accepted global framework ' +
        'rather than disputing it, cementing it as institutional consensus.',
    },
  });

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
