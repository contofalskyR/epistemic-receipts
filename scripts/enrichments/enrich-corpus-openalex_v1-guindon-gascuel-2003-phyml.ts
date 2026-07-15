import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Guindon S, Gascuel O (2003). "A Simple, Fast, and Accurate Algorithm to
 *   Estimate Large Phylogenies by Maximum Likelihood." Systematic Biology
 *   52(5):696-704. DOI 10.1080/10635150390235520.
 *   Claim id: cmq2w47f1004rsa8hs7dw6y1w  (OpenAlex W2103546861)
 *
 * This is the original PhyML paper: a maximum-likelihood phylogeny method built
 * around a simple hill-climbing algorithm (NNI moves) that adjusts topology and
 * branch lengths simultaneously from a fast distance-based starting tree.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2003-10-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the DOI
 *     with no `update-to` / `updated-by` fields (verified 2026-07-15).
 *   - This is a methods/software paper, not an empirical finding, so there is no
 *     failed replication or meta-analysis to record. The original NNI-only local
 *     search was later refined (SPR moves, aLRT branch tests), but the field
 *     improved the heuristic rather than disputing the core "fast and reliable ML
 *     phylogeny" claim — so no CONTESTED / REVERSED event is warranted.
 *   - FIELD CONSENSUS SHIFT (canonization / benchmark): Guindon S, Dufayard J-F,
 *     Lefort V, Anisimova M, Hordijk W, Gascuel O (2010). "New Algorithms and
 *     Methods to Estimate Maximum-Likelihood Phylogenies: Assessing the
 *     Performance of PhyML 3.0." Systematic Biology 59(3):307-321.
 *     DOI 10.1093/sysbio/syq010 (Crossref HTTP 200, verified resolves). This
 *     peer-reviewed paper extended the 2003 method, rigorously benchmarked its
 *     accuracy/speed against competing maximum-likelihood tools, and established
 *     PhyML as a standard, validated phylogeny-reconstruction method in the field.
 *
 * Single RECORDED -> SETTLED transition at the assessment paper's publication date.
 * Community: EXPERT_LITERATURE. Date precision: DAY (Crossref supplies 2010-03-29).
 * (The canonizing document shares authorship with the original, but it is an
 *  independent peer-reviewed benchmark in Systematic Biology and is the field's
 *  standard citation establishing the method as settled practice.)
 */

const claimId = 'cmq2w47f1004rsa8hs7dw6y1w';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2010), benchmark/canonization as standard method ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1093/sysbio/syq010' },
    update: {},
    create: {
      externalId: 'src:doi:10.1093/sysbio/syq010',
      name:
        'Guindon S, Dufayard J-F, Lefort V, Anisimova M, Hordijk W, Gascuel O ' +
        '(2010), "New Algorithms and Methods to Estimate Maximum-Likelihood ' +
        'Phylogenies: Assessing the Performance of PhyML 3.0," Systematic ' +
        'Biology 59(3):307-321',
      url: 'https://doi.org/10.1093/sysbio/syq010',
      publishedAt: new Date('2010-03-29'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2010-03-29');
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
      datePrecision: 'DAY',
      sourceId: source.id,
      reason:
        "PhyML's maximum-likelihood hill-climbing approach moved from a recorded " +
        'proposal to settled, standard methodology. The 2010 PhyML 3.0 paper in ' +
        'Systematic Biology extended the original algorithm (adding SPR tree search ' +
        'and approximate likelihood-ratio branch tests) and rigorously benchmarked ' +
        'its accuracy and speed against competing maximum-likelihood tools, ' +
        'establishing PhyML as a validated, widely adopted standard for large-scale ' +
        'phylogeny reconstruction in the expert literature.',
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
