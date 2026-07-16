import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Say L, Chou D, Gemmill A, Tunçalp Ö, Moller A-B, Daniels J, Gülmezoglu AM,
 *   Temmerman M, Alkema L.
 *   "Global causes of maternal death: a WHO systematic analysis."
 *   The Lancet Global Health, June 2014;2(6):e323-e333.
 *   DOI 10.1016/S2214-109X(14)70227-X.
 *   Claim id: cmplzx2cm03upsa86ksumioax  (OpenAlex W2036954961)
 *
 * The paper produced global/regional estimates of the causes of maternal death
 * for 2003-09 with a novel Bayesian method, updating the earlier WHO systematic
 * review. Its headline finding: haemorrhage was the leading direct cause of
 * maternal death (~27%), with a large indirect-cause burden.
 *
 * Identity confirmed via Crossref: title "Global causes of maternal death: a WHO
 * systematic analysis", Lancet Global Health 2(6):e323-e333, issued 2014-06,
 * matching the DOI and OpenAlex ID. Crossref returns no update-to relation and no
 * retraction/expression-of-concern (isRetracted = false); PubMed PMID 25103301
 * carries no correction notice.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2014-05-05) already exists; not duplicated.
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2025-04 (EXPERT_LITERATURE)
 *       Cresswell JA, Alexander M, Chong K-C, et al.
 *       "Global and regional causes of maternal deaths 2009-20: a WHO systematic analysis."
 *       The Lancet Global Health 2025;13(4):e626-e634.
 *       DOI 10.1016/S2214-109X(24)00560-6. PMC11946934.
 *       This is WHO's successor systematic analysis, re-running the estimation with
 *       an additional decade of data (2009-20) and an updated method. It again found
 *       haemorrhage the single leading cause of maternal death globally (27%),
 *       followed by indirect obstetric causes (23%) and hypertensive disorders (16%) —
 *       reproducing the 2014 finding's core structure and rank ordering. As the
 *       same institution's authoritative update confirming rather than overturning
 *       the cause-of-death hierarchy, it settles the finding in the expert literature.
 *       No prior dated contestation of the finding was identified, so the arc is
 *       recorded as a direct RECORDED -> SETTLED.
 *
 * Publication date precision: Crossref reports issued [2025,4] (issue-level only),
 * so datePrecision = MONTH.
 */

const claimId = 'cmplzx2cm03upsa86ksumioax';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2025-04), WHO 2025 successor analysis ---
  const sourceCresswell = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/S2214-109X(24)00560-6' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/S2214-109X(24)00560-6',
      name:
        'Cresswell JA, et al. (2025), "Global and regional causes of maternal deaths ' +
        '2009-20: a WHO systematic analysis," The Lancet Global Health 13(4):e626-e634',
      url: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC11946934/',
      publishedAt: new Date('2025-04-01'),
      methodologyType: 'systematic-review',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2025-04-01');
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
        sourceId: sourceCresswell.id,
        reason:
          'WHO\'s successor systematic analysis (Cresswell et al., Lancet Global Health ' +
          '2025) re-ran the causes-of-maternal-death estimation with an added decade of ' +
          'data (2009-20) and an updated method, and again found haemorrhage the single ' +
          'leading cause globally (27%), followed by indirect obstetric causes (23%) and ' +
          'hypertensive disorders (16%). Reproducing the 2014 finding\'s core rank ' +
          'ordering, this authoritative same-institution update confirms rather than ' +
          'overturns the cause hierarchy, settling it in the expert literature.',
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
