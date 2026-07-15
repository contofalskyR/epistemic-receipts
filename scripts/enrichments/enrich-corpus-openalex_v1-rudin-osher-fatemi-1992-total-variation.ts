import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Rudin LI, Osher S, Fatemi E. "Nonlinear total variation based noise removal
 *   algorithms." Physica D: Nonlinear Phenomena 60(1-4):259-268, Nov 1992.
 *   DOI 10.1016/0167-2789(92)90242-f  (OpenAlex W2103559027)
 *   Claim id: cmq2w48sh005lsa8hvxe46gdt
 *
 * This is the foundational "ROF model" paper introducing total-variation (TV)
 * regularization for image denoising — minimize an image's total variation
 * subject to noise-constrained fidelity — now the canonical variational model of
 * edge-preserving image restoration.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1992-11-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns the record with no
 *     `update-to` / `updated-by` fields for the DOI (verified 2026-07-15).
 *   - TV denoising is a methods contribution, not an empirical finding, so there is
 *     no failed replication or adjudicating meta-analysis to record. The ROF model
 *     was never overturned; extensions (dual algorithms, staircasing remedies,
 *     higher-order TV) build on it rather than contest its validity — so no
 *     CONTESTED or REVERSED event is warranted.
 *   - FIELD CONSENSUS SHIFT (canonization): Chambolle A, Caselles V, Cremers D,
 *     Novaga M, Pock T (2010). "An Introduction to Total Variation for Image
 *     Analysis." In: Theoretical Foundations and Numerical Methods for Sparse
 *     Recovery, Radon Series on Computational and Applied Mathematics, De Gruyter.
 *     DOI 10.1515/9783110226157.263 (verified resolves). This authoritative
 *     expository review presents the ROF total-variation model as the foundational,
 *     standard framework of variational image denoising, ratifying it in the expert
 *     literature as canonical methodology.
 *
 * Single RECORDED -> SETTLED transition at the review's publication date.
 * Community: EXPERT_LITERATURE. Date precision: MONTH.
 */

const claimId = 'cmq2w48sh005lsa8hvxe46gdt';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2010), canonization as standard method ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1515/9783110226157.263' },
    update: {},
    create: {
      externalId: 'src:doi:10.1515/9783110226157.263',
      name:
        'Chambolle A, Caselles V, Cremers D, Novaga M, Pock T (2010), ' +
        '"An Introduction to Total Variation for Image Analysis," in ' +
        'Theoretical Foundations and Numerical Methods for Sparse Recovery ' +
        '(Radon Series on Computational and Applied Mathematics), De Gruyter',
      url: 'https://doi.org/10.1515/9783110226157.263',
      publishedAt: new Date('2010-07-16'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2010-07-16');
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
      sourceId: source.id,
      reason:
        'The Rudin–Osher–Fatemi total-variation model moved from a recorded proposal ' +
        'to settled, canonical methodology as TV regularization became the standard ' +
        'framework for edge-preserving variational image denoising. Chambolle, Caselles, ' +
        'Cremers, Novaga & Pock\'s 2010 review "An Introduction to Total Variation for ' +
        'Image Analysis" presents the ROF model as the foundational variational approach ' +
        'to image restoration, ratifying it in the expert literature as accepted, ' +
        'canonical practice rather than a competing candidate method.',
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
