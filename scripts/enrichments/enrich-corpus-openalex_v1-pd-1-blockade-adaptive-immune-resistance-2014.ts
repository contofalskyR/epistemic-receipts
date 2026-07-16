import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Tumeh PC, Harview CL, Yearley JH, et al.
 *   "PD-1 blockade induces responses by inhibiting adaptive immune resistance."
 *   Nature, 27 November 2014;515(7528):568-571.
 *   DOI 10.1038/nature13954.
 *   Claim id: cmply66jk0113saihweabbzgo  (OpenAlex W2039123767)
 *
 * The paper established that anti-PD-1 (pembrolizumab) responses in melanoma
 * depend on a pre-existing, IFN-gamma-driven immune response: PD-L1 is
 * upregulated by tumour-infiltrating CD8+ T cells ("adaptive immune resistance"),
 * and the density of pre-existing CD8+ T cells at the invasive tumour margin
 * predicts clinical response to PD-1 blockade.
 *
 * Identity confirmed via Crossref: title "PD-1 blockade induces responses by
 * inhibiting adaptive immune resistance", Nature 515(7528):568-571, created
 * 2014-11-25 / published-print 2014-11-27, matching the DOI and OpenAlex ID.
 * Crossref returns no update-to/updated-by relation (no retraction or expression
 * of concern); isRetracted = false.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2014-11-25) already exists; not duplicated.
 *
 * Post-publication arc (one verified transition):
 *
 *   RECORDED -> SETTLED @ 2017-06-26 (EXPERT_LITERATURE)
 *       Ayers M, Lunceford J, Nebozhyn M, et al.
 *       "IFN-gamma-related mRNA profile predicts clinical response to PD-1 blockade."
 *       Journal of Clinical Investigation 2017;127(8):2930-2940.
 *       PMID 28650338. DOI 10.1172/JCI91190. Online 2017-06-26.
 *       This large prospective study operationalised Tumeh's adaptive-immune-
 *       resistance mechanism as a T-cell-inflamed / IFN-gamma gene expression
 *       profile and validated it as a predictor of pembrolizumab response across
 *       nine+ tumour types and independent KEYNOTE trial cohorts. Alongside its
 *       ~3,300 citations, it vindicated the 2014 mechanism and predictive claim,
 *       moving it from a single melanoma cohort to a validated pan-tumour biomarker
 *       framework and the expert-literature standard for the T-cell-inflamed
 *       tumour microenvironment. No prior dated contestation of the finding was
 *       identified, so the arc is recorded as a direct RECORDED -> SETTLED.
 */

const claimId = 'cmply66jk0113saihweabbzgo';

async function main() {
  // --- Transition: RECORDED -> SETTLED (2017-06-26), Ayers et al. validation ---
  const sourceAyers = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1172/JCI91190' },
    update: {},
    create: {
      externalId: 'src:doi:10.1172/JCI91190',
      name:
        'Ayers M, et al. (2017), "IFN-gamma-related mRNA profile predicts clinical ' +
        'response to PD-1 blockade," Journal of Clinical Investigation 127(8):2930-2940',
      url: 'https://pubmed.ncbi.nlm.nih.gov/28650338/',
      publishedAt: new Date('2017-06-26'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2017-06-26');
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
        sourceId: sourceAyers.id,
        reason:
          'Ayers et al. (2017, J Clin Invest) operationalised Tumeh\'s adaptive-immune-' +
          'resistance mechanism as a T-cell-inflamed / IFN-gamma gene expression profile ' +
          'and validated it as a predictor of pembrolizumab response across nine-plus ' +
          'tumour types and independent KEYNOTE cohorts. This large, heavily cited ' +
          'prospective validation vindicated the 2014 mechanism and predictive claim, ' +
          'settling the pre-existing T-cell-inflamed microenvironment as the accepted ' +
          'basis of anti-PD-1 response in the expert literature.',
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
