import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Clegg A., Young J., Iliffe S., Rikkert M.O., Rockwood K. "Frailty in elderly
 *   people." The Lancet 381(9868):752-762 (2013-03; online 2013-02-08).
 *   DOI 10.1016/S0140-6736(12)62167-9.
 *   Claim id: cmply6fq6015rsaihz6rt4rcd  (OpenAlex W2142514031)
 *
 * This is the landmark Lancet review that synthesized the frailty literature —
 * consolidating the phenotype model (Fried) and the cumulative-deficit / frailty
 * index model (Rockwood, a co-author) and framing frailty as a distinct,
 * measurable clinical state in older people.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2013-02-08) already exists; not
 * duplicated here.
 *
 * Post-publication assessment (verified 2026-07-15):
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the
 *     DOI with `update-to` / `updated-by` both null (verified); the DOI resolves
 *     (200). No Retraction Watch record.
 *   - Frailty is a clinical/methodological synthesis, not a single empirical
 *     result, so there is no failed replication or refuting study to record. The
 *     ongoing phenotype-vs-index operationalization debate predates and is
 *     discussed within this review; no specific dated document contests the
 *     review's synthesis, so no CONTESTED transition is warranted.
 *   - FIELD CONSENSUS SHIFT (clinical guideline): Dent E. et al. (2019),
 *     "Physical Frailty: ICFSR International Clinical Practice Guidelines for
 *     Identification and Management," The Journal of Nutrition, Health & Aging
 *     23(9):771-787. DOI 10.1007/s12603-019-1273-z (Crossref-registered,
 *     published 2019-11, resolves 200). This international clinical practice
 *     guideline institutionalized frailty screening and management, ratifying
 *     the concept the 2013 review synthesized as standard clinical practice.
 *
 * Single RECORDED -> SETTLED transition at the ICFSR guideline's publication
 * date. Community: INSTITUTIONAL (clinical practice guideline). Date precision:
 * MONTH (2019-11).
 */

const claimId = 'cmply6fq6015rsaihz6rt4rcd';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2019-11), formal clinical guideline ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1007/s12603-019-1273-z' },
    update: {},
    create: {
      externalId: 'src:doi:10.1007/s12603-019-1273-z',
      name:
        'Dent E, Morley JE, Cruz-Jentoft AJ, et al. (2019), "Physical Frailty: ' +
        'ICFSR International Clinical Practice Guidelines for Identification and ' +
        'Management," J Nutr Health Aging 23(9):771-787',
      url: 'https://doi.org/10.1007/s12603-019-1273-z',
      publishedAt: new Date('2019-11-01'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2019-11-01');
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
        'The frailty concept synthesized by the 2013 Clegg review moved from a ' +
        'recorded literature synthesis to settled clinical practice through the ' +
        '2019 ICFSR International Clinical Practice Guidelines for the ' +
        'Identification and Management of Physical Frailty (Dent et al., ' +
        'J Nutr Health Aging). These international, multi-society guidelines ' +
        'issued graded recommendations for frailty screening and management, ' +
        'institutionalizing frailty as a distinct, actionable clinical condition ' +
        'and ratifying the review\'s framing in formal guideline practice.',
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
