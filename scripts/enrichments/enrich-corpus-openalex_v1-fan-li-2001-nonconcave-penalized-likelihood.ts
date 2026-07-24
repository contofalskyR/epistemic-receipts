import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Fan J., Li R. "Variable Selection via Nonconcave Penalized Likelihood and
 *   its Oracle Properties." Journal of the American Statistical Association
 *   96(456):1348-1360 (2001-12). DOI 10.1198/016214501753382273.
 *   Claim id: cmq2w4n0500e9sa8hsp4buvbv  (OpenAlex W2074682976)
 *
 * This is the landmark paper introducing the SCAD (smoothly clipped absolute
 * deviation) penalty for simultaneous variable selection and estimation, whose
 * headline theoretical contribution is the claimed "oracle property": the
 * penalized estimator asymptotically performs as well as if the true zero
 * coefficients were known in advance.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2001-12-01) already exists; not
 * duplicated here.
 *
 * Post-publication assessment (verified 2026-07-15):
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the
 *     DOI with `update-to` and `updated-by` both null (verified). The DOI is
 *     registered and canonical (doi.org HEAD returns 403 — a Taylor & Francis
 *     bot-block, not a dead link). No Retraction Watch record.
 *   - METHODOLOGICAL CRITIQUE (dated, citable): Leeb H., Pötscher B.M. (2008),
 *     "Sparse estimators and the oracle property, or the return of Hodges'
 *     estimator," Journal of Econometrics 142(1):201-211.
 *     DOI 10.1016/j.jeconom.2007.05.017 (Crossref-registered, issued 2008-01,
 *     doi.org resolves 200). This paper directly disputes the practical meaning
 *     of the oracle property that is the central claim of Fan & Li (2001):
 *     it shows the finite-sample distribution of such sparse estimators is not
 *     uniformly well approximated by the oracle limit and that their maximal
 *     (scaled) risk diverges — the "return of Hodges' estimator" — so oracle
 *     efficiency is a pointwise-asymptotic artifact rather than a uniform
 *     guarantee. This is a specific contest of the headline finding, not a
 *     refutation of the SCAD method's utility.
 *
 * Single RECORDED -> CONTESTED transition at the critique's publication date.
 * Community: EXPERT_LITERATURE. Date precision: MONTH (2008-01). No later single
 * adjudicating document settles the oracle-property debate either way, so no
 * SETTLED/REVERSED transition is added.
 */

const claimId = 'cmq2w4n0500e9sa8hsp4buvbv';

async function main() {
  // --- Transition: RECORDED -> CONTESTED (2008-01), oracle-property critique ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/j.jeconom.2007.05.017' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/j.jeconom.2007.05.017',
      name:
        "Leeb H, Pötscher BM (2008), \"Sparse estimators and the oracle " +
        "property, or the return of Hodges' estimator,\" Journal of " +
        'Econometrics 142(1):201-211',
      url: 'https://doi.org/10.1016/j.jeconom.2007.05.017',
      publishedAt: new Date('2008-01-01'),
      methodologyType: 'methodological-critique',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2008-01-01');
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
        "The headline claim of Fan & Li (2001) — that the SCAD penalized " +
        'estimator enjoys the "oracle property" — was directly contested by ' +
        "Leeb & Pötscher (2008, Journal of Econometrics). They show the oracle " +
        'property holds only pointwise-asymptotically: the finite-sample ' +
        'distribution of such sparse estimators is not uniformly approximated ' +
        'by the oracle limit and their maximal scaled risk diverges (the ' +
        "\"return of Hodges' estimator\"), so oracle efficiency does not deliver " +
        'the uniform guarantee it is commonly read to imply. This moves the ' +
        "finding to CONTESTED without overturning SCAD's practical use.",
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
