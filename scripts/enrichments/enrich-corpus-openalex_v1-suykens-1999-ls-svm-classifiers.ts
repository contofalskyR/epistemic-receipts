import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Suykens J.A.K., Vandewalle J. "Least Squares Support Vector Machine
 *   Classifiers." Neural Processing Letters 9(3):293-300 (1999).
 *   DOI 10.1023/A:1018628609742.
 *   Claim id: cmq2w4le400d9sa8hxywvng7p  (OpenAlex W1596717185)
 *
 * This is the foundational paper introducing Least Squares Support Vector
 * Machines (LS-SVM): a least-squares reformulation of the SVM classifier that
 * replaces the quadratic-programming problem and inequality constraints with a
 * set of linear (KKT) equations, yielding a linear system solution.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1999-06-01) already exists; not
 * duplicated here.
 *
 * Post-publication assessment (verified 2026-07-15):
 *   - No retraction / expression of concern. Crossref returns HTTP 200 for the
 *     DOI with no `update-to` / `updated-by` fields (verified); Retraction Watch
 *     has no record. The DOI resolves (200).
 *   - LS-SVM is a machine-learning method, not an empirical finding, so there is
 *     no failed replication or adjudicating meta-analysis to record. The known
 *     sparsity-loss critique relative to standard SVM is a recognized tradeoff /
 *     refinement (addressed by pruning and sparse approximations), not an event
 *     that overturned the method — so no CONTESTED or REVERSED transition is
 *     warranted.
 *   - FIELD CONSENSUS SHIFT (canonization): Suykens J.A.K., Van Gestel T.,
 *     De Brabanter J., De Moor B., Vandewalle J. (2002). "Least Squares Support
 *     Vector Machines." Singapore: World Scientific. DOI 10.1142/5089
 *     (Crossref-registered; DOI system resolves 302 -> the World Scientific book
 *     page; publisher year Nov 2002, verified via Crossref). This authoritative
 *     monograph consolidated LS-SVM theory, algorithms, and applications and
 *     established it as a standard kernel-method framework rather than a single
 *     competing proposal.
 *
 * Single RECORDED -> SETTLED transition at the canonizing monograph's publication
 * date. Community: EXPERT_LITERATURE. Date precision: MONTH (2002-11).
 */

const claimId = 'cmq2w4le400d9sa8hxywvng7p';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2002-11), canonization as standard method ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1142/5089' },
    update: {},
    create: {
      externalId: 'src:doi:10.1142/5089',
      name:
        'Suykens JAK, Van Gestel T, De Brabanter J, De Moor B, Vandewalle J ' +
        '(2002), "Least Squares Support Vector Machines," World Scientific',
      url: 'https://doi.org/10.1142/5089',
      publishedAt: new Date('2002-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2002-11-01');
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
        'LS-SVM moved from a recorded proposal to settled, canonical methodology ' +
        'through its consolidation in the authoritative 2002 World Scientific ' +
        'monograph "Least Squares Support Vector Machines" by the originating and ' +
        'expanded author team (Suykens, Van Gestel, De Brabanter, De Moor, ' +
        'Vandewalle). The book systematized LS-SVM theory, training algorithms, ' +
        'robustness and sparse approximations, and applications, ratifying it in ' +
        'the expert literature as a standard kernel-method framework rather than a ' +
        'competing candidate formulation.',
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
