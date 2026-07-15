import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Mancia G, Fagard R, Narkiewicz K, et al. (2013). "2013 ESH/ESC Guidelines
 *   for the management of arterial hypertension: The Task Force for the
 *   management of arterial hypertension of the European Society of Hypertension
 *   (ESH) and of the European Society of Cardiology (ESC)."
 *   Eur Heart J 34(28):2159-2219.
 *   DOI 10.1093/eurheartj/eht151  (OpenAlex W2133416234)
 *   Claim id: cmpma5uim48o4saerhxxveq6x
 *
 * The claim text is the standard ESH/ESC guideline disclaimer; the underlying
 * record is the 2013 European consensus guideline for arterial hypertension
 * management (office-BP classification, >=140/90 mmHg hypertension definition,
 * risk-stratified treatment framework).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2013-06-14, online publication date)
 * already exists; not duplicated.
 *
 * Post-publication assessment (verified 2026-07-15):
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the
 *     DOI with an empty `relation` object (no `update-to` / `updated-by`); OpenAlex
 *     isRetracted = false.
 *   - This is a consensus guideline document, not a single empirical finding, so
 *     there is no failed replication or meta-analysis to record.
 *   - FIELD CONSENSUS SHIFT (successor consensus guideline): Williams B, Mancia G,
 *     Spiering W, et al. (2018). "2018 ESC/ESH Guidelines for the management of
 *     arterial hypertension." Eur Heart J 39(33):3021-3104.
 *     DOI 10.1093/eurheartj/ehy339 (PMID 30165516; PubMed page verified HTTP 200).
 *     The next authoritative revision from the same two bodies (ESH + ESC)
 *     RETAINED the office-BP >=140/90 mmHg definition of hypertension and the
 *     European risk-based classification framework -- explicitly declining to adopt
 *     the 2017 ACC/AHA >=130/80 redefinition -- while refining treatment targets
 *     (toward <130 mmHg where tolerated) and endorsing single-pill combination
 *     initiation. The successor carried the 2013 European diagnostic framework
 *     forward as accepted consensus rather than disputing it -- hence SETTLED, not
 *     CONTESTED or REVERSED.
 *
 * Single RECORDED -> SETTLED transition at the 2018 ESC/ESH guideline's publication.
 * Community: INSTITUTIONAL (ESH/ESC consensus guideline bodies).
 * Date precision: MONTH (Eur Heart J vol 39 issue 33, September 2018 print issue).
 */

const claimId = 'cmpma5uim48o4saerhxxveq6x';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2018), successor ESC/ESH consensus guideline ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1093/eurheartj/ehy339' },
    update: {},
    create: {
      externalId: 'src:doi:10.1093/eurheartj/ehy339',
      name:
        'Williams B, Mancia G, Spiering W, et al. (2018), "2018 ESC/ESH ' +
        'Guidelines for the management of arterial hypertension," European ' +
        'Heart Journal 39(33):3021-3104 (PMID 30165516)',
      url: 'https://pubmed.ncbi.nlm.nih.gov/30165516/',
      publishedAt: new Date('2018-09-01'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2018-09-01');
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
        'The 2013 ESH/ESC European consensus framework for hypertension \u2014 an ' +
        'office-BP classification anchored on a >=140/90 mmHg definition with ' +
        'risk-stratified treatment \u2014 moved from a recorded guideline to settled ' +
        'European institutional consensus. The 2018 ESC/ESH Guidelines (Williams ' +
        'et al.), the next authoritative revision from the same two bodies (ESH + ' +
        'ESC), retained the >=140/90 mmHg definition and the European risk-based ' +
        'framework, explicitly declining the 2017 ACC/AHA >=130/80 redefinition, ' +
        'while refining treatment targets and endorsing single-pill combination ' +
        'therapy. The successor guideline carried the 2013 diagnostic framework ' +
        'forward as accepted consensus rather than disputing it.',
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
