import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Sheldrick G M (1990). "Phase annealing in SHELX-90: direct methods for
 *   larger structures." Acta Crystallographica Section A 46(6):467-473.
 *   DOI 10.1107/s0108767390000277.
 *   Claim id: cmq2w488k0059sa8ho9fq7myf  (OpenAlex W2148066840)
 *
 * This paper introduces the phase-annealing extension to multisolution direct
 * methods (leveraging negative quartet relations) and folds it into the SHELX
 * program system, improving the odds of solving large structures at atomic
 * resolution by up to an order of magnitude.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1990-06-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the DOI
 *     with no `update-to` / `updated-by` fields (verified 2026-07-15).
 *   - This is a crystallographic-methods/software paper, not an empirical finding,
 *     so there is no failed replication or meta-analysis to record. Later methods
 *     (dual-space recycling in SHELXD, charge flipping) extended structure solution
 *     rather than disputing the phase-annealing direct-methods claim — so no
 *     CONTESTED / REVERSED event is warranted.
 *   - FIELD CONSENSUS SHIFT (canonization): Sheldrick G M (2008). "A short history
 *     of SHELX." Acta Crystallographica Section A 64(1):112-122.
 *     DOI 10.1107/S0108767307043930 (Crossref HTTP 200; doi.org resolves to
 *     journals.iucr.org, verified 2026-07-15). This peer-reviewed review — one of
 *     the most-cited papers in all of science (~79,880 Crossref citations) —
 *     documents the SHELX system, its direct-methods program (SHELXS, incorporating
 *     the phase-annealing approach of the 1990 paper), and its establishment as the
 *     de facto standard software for small-molecule crystal structure determination.
 *
 * Single RECORDED -> SETTLED transition at the 2008 review's publication (issue
 * dated January 2008 -> datePrecision MONTH). Community: EXPERT_LITERATURE.
 */

const claimId = 'cmq2w488k0059sa8ho9fq7myf';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2008), canonization as field-standard method ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1107/S0108767307043930' },
    update: {},
    create: {
      externalId: 'src:doi:10.1107/S0108767307043930',
      name:
        'Sheldrick G M (2008), "A short history of SHELX," Acta ' +
        'Crystallographica Section A 64(1):112-122',
      url: 'https://doi.org/10.1107/S0108767307043930',
      publishedAt: new Date('2008-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2008-01-01');
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
        "The phase-annealing direct-methods approach folded into SHELX moved from " +
        'a recorded proposal to settled, standard methodology. Sheldrick\'s 2008 ' +
        'review "A short history of SHELX" (one of the most-cited papers in ' +
        'science) documents the SHELX system and its direct-methods program SHELXS ' +
        '— which incorporates the 1990 phase-annealing method — as the de facto ' +
        'standard tool for small-molecule crystal structure determination, ' +
        'canonizing the technique in the expert crystallographic literature.',
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
