import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Wang G, Ma R, Qiao G, Wada K, Aizawa Y, Satoh T (2015).
 *   "The Effect of Riding as an Alternative Treatment for Children with
 *    Cerebral Palsy: A Systematic Review and Meta-Analysis."
 *   Integrative Medicine International (Karger). DOI 10.1159/000368408.
 *   Claim id: cmply5kkp00qlsaih31klgwsh  (OpenAlex W246286872)
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2015-04-02) already exists; not duplicated.
 *
 * Post-publication event:
 *   No retraction / expression of concern (Crossref shows no update-to; not PubMed-indexed).
 *   No failed replication. The finding — that equine-assisted / riding therapy confers
 *   physiological (gross motor) benefit to children with CP — was independently
 *   corroborated by a larger RCT-only meta-analysis:
 *     Guindos-Sanchez L, Lucena-Anton D, Moral-Munoz JA, Salazar A,
 *     Carmona-Barrientos I (2020). "The Effectiveness of Hippotherapy to Recover
 *     Gross Motor Function in Children with Cerebral Palsy: A Systematic Review and
 *     Meta-Analysis." Children (MDPI) 7(9):106. DOI 10.3390/children7090106.
 *     10 RCTs, 452 participants; favorable pooled effects on GMFM
 *     (GMFM-66 SMD 0.81, 95% CI 0.47–1.15).
 *
 * Because there was never a formal contest (no retraction, no failed replication),
 * this is a direct RECORDED -> SETTLED vindication at the review's publication date.
 * Community: EXPERT_LITERATURE.
 */

const claimId = 'cmply5kkp00qlsaih31klgwsh';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2020-08-19), corroborating meta-analysis ---
  const source = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.3390/children7090106' },
    update: {},
    create: {
      externalId: 'src:doi:10.3390/children7090106',
      name:
        'Guindos-Sanchez et al. (2020), "The Effectiveness of Hippotherapy to ' +
        'Recover Gross Motor Function in Children with Cerebral Palsy: A ' +
        'Systematic Review and Meta-Analysis," Children (MDPI) 7(9):106',
      url: 'https://doi.org/10.3390/children7090106',
      publishedAt: new Date('2020-08-19'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  const occurredAt = new Date('2020-08-19');
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
        'An independent RCT-only meta-analysis (10 trials, 452 children with CP) ' +
        'found favorable pooled effects of hippotherapy/riding therapy on gross ' +
        'motor function (GMFM-66 SMD 0.81, 95% CI 0.47–1.15), corroborating the ' +
        "2015 review's conclusion that riding confers physiological benefit. No " +
        'retraction or failed replication intervened, so the finding is settled ' +
        'as vindicated in the rehabilitation literature.',
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
