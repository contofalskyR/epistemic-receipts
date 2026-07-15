import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   GBD 2019 Risk Factors Collaborators. "Global burden of 87 risk factors in
 *   204 countries and territories, 1990–2019: a systematic analysis for the
 *   Global Burden of Disease Study 2019." The Lancet 396(10258):1223–1249,
 *   October 2020. DOI 10.1016/S0140-6736(20)30752-2.
 *   Claim id: cmplyra4501wnsaqkqymcvljf  (OpenAlex W3092861045)
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2020-10-01) already exists; NOT duplicated.
 *
 * Post-publication assessment (verified 2026-07-15 via Crossref):
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the
 *     DOI with null `update-to` / `updated-by` fields; isRetracted=false.
 *   - FAILED-REPLICATION / METHODOLOGICAL CRITIQUE (dated, citable):
 *     Stanton AV, Leroy F, Elliott C, et al. "36-fold higher estimate of deaths
 *     attributable to red meat intake in GBD 2019: is this reliable?" The Lancet
 *     399(10332):e23–e26, April 2022. DOI 10.1016/S0140-6736(22)00311-7
 *     (Crossref HTTP 200, verified 2026-07-15). The correspondence documented
 *     that GBD 2019 raised estimated deaths attributable to a diet high in red
 *     meat ~36-fold versus GBD 2017 (from ~25,000 to ~896,000), argued the jump
 *     was implausible, and challenged the undisclosed switch of the theoretical
 *     minimum risk exposure level (TMREL) for unprocessed red meat to zero. In
 *     their published reply (Murray CJL et al., "…Author's reply," Lancet
 *     399(10332), April 2022, DOI 10.1016/S0140-6736(22)00518-9, Crossref HTTP
 *     200) the GBD collaborators conceded the TMREL-to-zero choice was not
 *     adequate and would be revised. This is a specific, dated contest of the
 *     paper's risk-attribution estimates in the expert literature.
 *
 * Single RECORDED -> CONTESTED transition at the critique's publication month.
 * Community: EXPERT_LITERATURE. Date precision: MONTH.
 * (No SETTLED/REVERSED event recorded: the contest concerns one risk-factor
 *  component, and GBD 2021 is a successor iteration rather than a clean
 *  adjudication of this paper — no verifiable document settles or overturns the
 *  2020 paper as a whole.)
 */

const claimId = 'cmplyra4501wnsaqkqymcvljf';

async function main() {
  // --- Transition: RECORDED -> CONTESTED (2022-04), dated methodological critique ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/S0140-6736(22)00311-7' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/S0140-6736(22)00311-7',
      name:
        'Stanton AV, Leroy F, Elliott C, et al. (2022), "36-fold higher estimate ' +
        'of deaths attributable to red meat intake in GBD 2019: is this ' +
        'reliable?" The Lancet 399(10332):e23–e26',
      url: 'https://doi.org/10.1016/S0140-6736(22)00311-7',
      publishedAt: new Date('2022-04-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2022-04-01');
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
      sourceId: source.id,
      reason:
        'Stanton, Leroy, Elliott and colleagues challenged GBD 2019\'s risk ' +
        'attribution in a Lancet correspondence (April 2022), showing that ' +
        'estimated deaths from a diet high in red meat had risen ~36-fold ' +
        'versus GBD 2017 and arguing this was implausible and non-transparent, ' +
        'driven by an undisclosed shift of the red-meat TMREL to zero. In their ' +
        'published reply the GBD collaborators conceded the TMREL-to-zero ' +
        'assumption was inadequate and committed to revising it, marking the ' +
        'paper\'s risk-factor estimates as contested in the expert literature.',
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
