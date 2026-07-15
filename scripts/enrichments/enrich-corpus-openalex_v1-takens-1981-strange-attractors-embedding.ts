import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Takens F. "Detecting strange attractors in turbulence." In: Dynamical
 *   Systems and Turbulence, Warwick 1980. Lecture Notes in Mathematics, vol 898.
 *   Springer, 1981, pp. 366–381. DOI 10.1007/BFb0091924.
 *   Claim id: cmq2w4i3x00b9sa8h4cqcuqgs  (OpenAlex W1549386224)
 *
 * This is Takens' embedding theorem: the paper establishing that the dynamics of
 * a strange attractor can be reconstructed from delay coordinates of a single
 * observable time series (delay-coordinate / time-delay embedding).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1981-01-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the DOI
 *     with no `update-to` / `updated-by` fields (verified 2026-07-15).
 *   - This is a mathematical theorem, not an empirical finding, so there is no
 *     failed replication or adjudicating meta-analysis to record.
 *   - FIELD CONSENSUS SHIFT (canonization / rigorous generalization):
 *     Sauer T, Yorke JA, Casdagli M (1991). "Embedology." Journal of Statistical
 *     Physics 65(3–4):579–616. DOI 10.1007/BF01053745 (published November 1991;
 *     verified resolves to link.springer.com). "Embedology" generalized Takens'
 *     theorem — replacing the integer manifold-dimension condition with a
 *     box-counting (fractal) dimension bound and proving delay-coordinate
 *     embedding is a generic (prevalent) property — thereby placing Takens'
 *     reconstruction result on rigorous, general footing and establishing
 *     delay-coordinate embedding as the settled standard method for analyzing
 *     experimental time series from chaotic/turbulent systems.
 *
 * Single RECORDED -> SETTLED transition at the generalizing reference paper's
 * publication month. Community: EXPERT_LITERATURE. Date precision: MONTH.
 * (No CONTESTED or REVERSED event: Embedology strengthened rather than overturned
 *  Takens' theorem, and there is no dated public challenge to record.)
 */

const claimId = 'cmq2w4i3x00b9sa8h4cqcuqgs';

async function main() {
  // --- Transition: RECORDED -> SETTLED (1991-11), rigorous generalization / canonization ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1007/BF01053745' },
    update: {},
    create: {
      externalId: 'src:doi:10.1007/BF01053745',
      name:
        'Sauer T, Yorke JA, Casdagli M (1991), "Embedology," Journal of ' +
        'Statistical Physics 65(3–4):579–616',
      url: 'https://doi.org/10.1007/BF01053745',
      publishedAt: new Date('1991-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('1991-11-01');
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
        "Takens' delay-coordinate embedding theorem moved from a recorded result " +
        'to settled, canonical methodology through Sauer, Yorke & Casdagli\'s 1991 ' +
        '"Embedology" (Journal of Statistical Physics). That paper generalized the ' +
        'theorem — replacing the integer-dimension hypothesis with a box-counting ' +
        '(fractal) dimension bound and proving that delay-coordinate embedding is a ' +
        'generic property — placing attractor reconstruction on rigorous, general ' +
        'footing and ratifying it in the expert literature as the standard method ' +
        'for reconstructing chaotic dynamics from experimental time series.',
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
