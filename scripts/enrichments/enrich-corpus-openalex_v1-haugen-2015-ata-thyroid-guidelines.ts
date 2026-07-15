import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Haugen BR, Alexander EK, Bible KC, et al. (2016). "2015 American Thyroid
 *   Association Management Guidelines for Adult Patients with Thyroid Nodules
 *   and Differentiated Thyroid Cancer." Thyroid 26(1):1-133.
 *   DOI 10.1089/thy.2015.0020.
 *   Claim id: cmpm0dt2w0bnjsa869ib1kg47  (OpenAlex W2145150141)
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2015-10-14, first online) already
 * exists; not duplicated.
 *
 * Post-publication assessment (verified 2026-07-15):
 *   - No retraction / correction / expression of concern. Crossref returns HTTP
 *     200 for the DOI with no `update-to` / `updated-by` fields (only a
 *     `has-review` relation). PubMed shows no retraction notice.
 *   - This is a clinical practice guideline (institutional consensus document),
 *     not a single empirical finding. There is therefore no failed-replication
 *     or meta-analysis reversal to record. Scattered validation studies debated
 *     specific sub-recommendations (e.g. malignancy-risk of the high-suspicion
 *     sonographic pattern, inter-observer variability in risk assignment), but
 *     none constitute a formal expression of concern or a decisive adjudication
 *     overturning the framework — so no CONTESTED / REVERSED event is warranted.
 *   - FIELD CONSENSUS SHIFT (re-ratification by updated guideline): Ringel MD,
 *     Sosa JA, Baloch Z, et al. (2025). "2025 American Thyroid Association
 *     Management Guidelines for Adult Patients with Differentiated Thyroid
 *     Cancer." Thyroid (Aug 2025). DOI 10.1177/10507256251363120 (Crossref HTTP
 *     200, verified resolves). After a decade of validation and international
 *     adoption, the ATA published a revised edition that carried forward and
 *     refined the core risk-adapted management approach and dynamic risk-
 *     stratification framework introduced in the 2015 guidelines, confirming it
 *     as durable standard of care.
 *
 * Single RECORDED -> SETTLED transition at the 2025 guideline's publication.
 * Community: INSTITUTIONAL (professional-society clinical guideline).
 * Date precision: MONTH (Crossref supplies the 2025 August issue).
 */

const claimId = 'cmpm0dt2w0bnjsa869ib1kg47';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2025), re-ratification by updated ATA guideline ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1177/10507256251363120' },
    update: {},
    create: {
      externalId: 'src:doi:10.1177/10507256251363120',
      name:
        'Ringel MD, Sosa JA, Baloch Z, et al. (2025), "2025 American Thyroid ' +
        'Association Management Guidelines for Adult Patients with ' +
        'Differentiated Thyroid Cancer," Thyroid (Aug 2025)',
      url: 'https://doi.org/10.1177/10507256251363120',
      publishedAt: new Date('2025-08-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2025-08-01');
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
        'The 2015 ATA guidelines moved from a recorded consensus proposal to ' +
        'settled standard of care. After a decade of validation and broad ' +
        'international adoption, the American Thyroid Association published its ' +
        '2025 update, which carried forward and refined the core risk-adapted ' +
        'management approach and dynamic risk-stratification framework ' +
        'introduced in 2015, re-ratifying it as the durable clinical standard ' +
        'for adult differentiated thyroid cancer.',
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
