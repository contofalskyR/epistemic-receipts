import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Akaike H. "Information Theory and an Extension of the Maximum Likelihood
 *   Principle." Reprinted in: Selected Papers of Hirotugu Akaike (Springer Series
 *   in Statistics), 1998. DOI 10.1007/978-1-4612-1694-0_15.
 *   Claim id: cmq2w46bl0043sa8hk8oywato  (OpenAlex W2058815839)
 *
 * This is Akaike's foundational paper introducing the Akaike Information Criterion
 * (AIC), an information-theoretic criterion for statistical model selection.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1998-01-01) already exists; not duplicated.
 *
 * Post-publication assessment:
 *   - No retraction / expression of concern. Crossref returns HTTP 200 with no
 *     `update-to` / `updated-by` fields for the DOI (verified).
 *   - AIC is a statistical method, not an empirical finding, so there is no failed
 *     replication or adjudicating meta-analysis to record.
 *   - FIELD CONSENSUS SHIFT (canonization): Burnham KP, Anderson DR (2002).
 *     "Model Selection and Multimodel Inference: A Practical Information-Theoretic
 *     Approach," 2nd ed. New York: Springer. DOI 10.1007/b97636 (copyright year
 *     2002, verified resolves to link.springer.com). This monograph established
 *     AIC (and the small-sample correction AICc) as the standard, recommended
 *     information-theoretic model-selection framework across ecology, wildlife
 *     biology, and applied statistics, cementing Akaike's criterion as canonical
 *     methodology rather than a competing proposal.
 *
 * Single RECORDED -> SETTLED transition at the canonizing reference text's
 * publication year. Community: EXPERT_LITERATURE. Date precision: YEAR.
 * (The ongoing AIC-vs-BIC discussion concerns complementary selection goals and
 *  does not overturn AIC, so no CONTESTED or REVERSED event is warranted.)
 */

const claimId = 'cmq2w46bl0043sa8hk8oywato';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2002), canonization as standard method ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1007/b97636' },
    update: {},
    create: {
      externalId: 'src:doi:10.1007/b97636',
      name:
        'Burnham KP, Anderson DR (2002), "Model Selection and Multimodel ' +
        'Inference: A Practical Information-Theoretic Approach," 2nd ed., ' +
        'Springer Series in Statistics',
      url: 'https://doi.org/10.1007/b97636',
      publishedAt: new Date('2002-01-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2002-01-01');
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
      datePrecision: 'YEAR',
      sourceId: source.id,
      reason:
        "Akaike's Information Criterion moved from a recorded proposal to settled, " +
        'canonical methodology through its adoption as the standard model-selection ' +
        'framework in applied statistics. Burnham & Anderson\'s 2002 reference text ' +
        '"Model Selection and Multimodel Inference" established AIC (and the ' +
        'small-sample correction AICc) as the recommended information-theoretic ' +
        'approach across ecology and applied science, ratifying it in the expert ' +
        'literature as accepted practice rather than a competing candidate criterion.',
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
