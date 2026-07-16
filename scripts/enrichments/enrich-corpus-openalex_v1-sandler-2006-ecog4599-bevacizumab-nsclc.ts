import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Sandler A, Gray R, Perry MC, Brahmer J, Schiller JH, Dowlati A, Lilenbaum R,
 *   Johnson DH. "Paclitaxel–Carboplatin Alone or with Bevacizumab for Non–Small-Cell
 *   Lung Cancer." N Engl J Med 2006;355(24):2542-2550. DOI 10.1056/NEJMoa061884.
 *   ECOG study E4599 (878 patients, stage IIIB/IV NSCLC).
 *   Claim id: cmply98ly02ilsaih0y74008r  (OpenAlex W2145835533)
 *
 * E4599 was the pivotal trial showing that adding bevacizumab to
 * paclitaxel/carboplatin improved overall survival (median 12.3 vs 10.3 months)
 * in advanced non-squamous NSCLC — the basis for FDA approval.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2006-12-13) already exists; not duplicated.
 * Identity confirmed via DOI + OpenAlex: 878 ECOG patients, paclitaxel/carboplatin
 * ± bevacizumab, NEJM 2006. No retraction or expression of concern.
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2010-09 (EXPERT_LITERATURE)
 *       Reck M, von Pawel J, Zatloukal P, et al. "Overall survival with
 *       cisplatin–gemcitabine and bevacizumab or placebo as first-line therapy for
 *       nonsquamous non-small-cell lung cancer: results from a randomised phase III
 *       trial (AVAiL)." Ann Oncol 2010;21(9):1804-1809. PMID 20150572.
 *       DOI 10.1093/annonc/mdq020. The parallel phase III AVAiL trial confirmed the
 *       progression-free-survival benefit of adding bevacizumab to platinum doublet
 *       chemotherapy but did NOT demonstrate a significant overall-survival benefit,
 *       casting doubt on whether the headline E4599 survival advantage was
 *       reproducible across regimens — a specific, dated methodological contest.
 *
 *   (2) CONTESTED -> SETTLED @ 2013-01 (EXPERT_LITERATURE)
 *       Soria JC, Mauguen A, Reck M, Sandler AB, Saijo N, Johnson DH, et al.
 *       "Systematic review and meta-analysis of randomised, phase II/III trials adding
 *       bevacizumab to platinum-based chemotherapy as first-line treatment in patients
 *       with advanced non-small-cell lung cancer." Ann Oncol 2013;24(1):20-30.
 *       PMID 23180113. DOI 10.1093/annonc/mds590. Pooling the randomized bevacizumab +
 *       platinum-chemotherapy trials (E4599, AVAiL and others; 2,194 subjects), this
 *       meta-analysis found a statistically significant improvement in both overall
 *       survival and progression-free survival — adjudicating in favour of the E4599
 *       finding and settling the contest over the survival benefit.
 */

const claimId = 'cmply98ly02ilsaih0y74008r';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2010-09), AVAiL fails to confirm OS benefit ---
  const sourceReck = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1093/annonc/mdq020' },
    update: {},
    create: {
      externalId: 'src:doi:10.1093/annonc/mdq020',
      name:
        'Reck M, et al. (2010), "Overall survival with cisplatin–gemcitabine and ' +
        'bevacizumab or placebo as first-line therapy for nonsquamous non-small-cell ' +
        'lung cancer: results from a randomised phase III trial (AVAiL)," ' +
        'Ann Oncol 21(9):1804-1809',
      url: 'https://pubmed.ncbi.nlm.nih.gov/20150572/',
      publishedAt: new Date('2010-09-01'),
      methodologyType: 'primary',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2010-09-01');
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
        sourceId: sourceReck.id,
        reason:
          'The E4599 overall-survival benefit was contested when the parallel phase III ' +
          'AVAiL trial (Reck et al., 2010) confirmed the progression-free-survival ' +
          'improvement from adding bevacizumab to platinum-doublet chemotherapy but ' +
          'failed to demonstrate a significant overall-survival benefit. This raised a ' +
          'specific, dated question in the expert literature about whether the E4599 ' +
          'survival advantage was reproducible across bevacizumab regimens.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2013-01), pooled meta-analysis confirms OS/PFS benefit ---
  const sourceSoria = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1093/annonc/mds590' },
    update: {},
    create: {
      externalId: 'src:doi:10.1093/annonc/mds590',
      name:
        'Soria JC, et al. (2013), "Systematic review and meta-analysis of randomised, ' +
        'phase II/III trials adding bevacizumab to platinum-based chemotherapy as ' +
        'first-line treatment in patients with advanced non-small-cell lung cancer," ' +
        'Ann Oncol 24(1):20-30',
      url: 'https://pubmed.ncbi.nlm.nih.gov/23180113/',
      publishedAt: new Date('2013-01-01'),
      methodologyType: 'meta_analysis',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2013-01-01');
    const toAxis = 'SETTLED';
    const slug = `${claimId}-${toAxis}-${occurredAt.toISOString().slice(0, 10)}`;
    await prisma.claimStatusHistory.upsert({
      where: { id: slug },
      update: {},
      create: {
        id: slug,
        claimId,
        fromAxis: 'CONTESTED',
        toAxis,
        community: 'EXPERT_LITERATURE',
        occurredAt,
        datePrecision: 'MONTH',
        sourceId: sourceSoria.id,
        reason:
          'Soria et al. (2013) pooled the randomized trials adding bevacizumab to ' +
          'first-line platinum-based chemotherapy (E4599, AVAiL and others; 2,194 ' +
          'subjects) and found statistically significant improvements in both overall ' +
          'survival and progression-free survival. This meta-analysis adjudicated in ' +
          'favour of the E4599 finding, settling the contest over the survival benefit.',
      },
    });
  }

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
