import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Burschka J, Pellet N, Moon S-J, Humphry-Baker R, Gao P, Nazeeruddin MK,
 *   Grätzel M. "Sequential deposition as a route to high-performance
 *   perovskite-sensitized solar cells." Nature 2013;499:316–319.
 *   DOI 10.1038/nature12340 (OpenAlex W2114118829).
 *   Claim id: cmq2w4kk500crsa8huv3vv7ij
 *
 * This is the landmark paper introducing the two-step "sequential deposition"
 * fabrication route for organolead-halide perovskite solar cells, which
 * reproducibly raised device efficiency and became a standard fabrication
 * technique across the field.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2013-07-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 with no
 *     `update-to` / `updated-by` fields for the DOI (verified 2026-07-15).
 *     Retraction Watch / PubMed show no concern for this record.
 *   - This is a materials/methods finding, not an empirical claim subject to a
 *     failed replication or adjudicating clinical meta-analysis. Its status
 *     change is a FIELD CONSENSUS SHIFT (canonization of the technique).
 *   - Adjudicating document: Green MA, Ho-Baillie A, Snaith HJ. "The emergence
 *     of perovskite solar cells." Nature Photonics 2014;8:506–514.
 *     DOI 10.1038/nphoton.2014.134 (verified resolves, HTTP 200). This
 *     field-defining consolidation review, published one year after Burschka
 *     2013, reviews the two-step sequential deposition method as one of the key
 *     fabrication advances that established high-efficiency perovskite
 *     photovoltaics, ratifying sequential deposition in the expert literature as
 *     a settled, standard route rather than a single-group result.
 *
 * Single RECORDED -> SETTLED transition at the canonizing review's publication
 * month. Community: EXPERT_LITERATURE. Date precision: MONTH.
 */

const claimId = 'cmq2w4kk500crsa8huv3vv7ij';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2014-07), canonization as standard route ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1038/nphoton.2014.134' },
    update: {},
    create: {
      externalId: 'src:doi:10.1038/nphoton.2014.134',
      name:
        'Green MA, Ho-Baillie A, Snaith HJ (2014), "The emergence of perovskite ' +
        'solar cells," Nature Photonics 8:506–514',
      url: 'https://doi.org/10.1038/nphoton.2014.134',
      publishedAt: new Date('2014-07-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2014-07-01');
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
        'The two-step sequential deposition route moved from a recorded single-group ' +
        'result to a settled, standard fabrication technique for perovskite solar cells. ' +
        'Green, Ho-Baillie & Snaith\'s July 2014 Nature Photonics review "The emergence of ' +
        'perovskite solar cells" — the field\'s consolidation review one year after ' +
        'publication — presents sequential deposition among the key advances defining ' +
        'high-efficiency perovskite photovoltaics, ratifying it in the expert literature ' +
        'as an established route rather than a preliminary claim. No retraction or ' +
        'expression of concern exists for the original paper.',
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
