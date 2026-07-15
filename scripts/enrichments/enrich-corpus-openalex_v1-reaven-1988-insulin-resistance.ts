import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Reaven GM. "Role of Insulin Resistance in Human Disease" (Banting Lecture 1988).
 *   Diabetes, December 1988;37(12):1595-1607. DOI 10.2337/diab.37.12.1595.
 *   Claim id: cmplyd1sy04bxsaihpgzkcrzt  (OpenAlex W2096773810)
 *
 * Reaven's Banting Lecture introduced the concept that insulin resistance and its
 * compensatory hyperinsulinemia cluster with glucose intolerance, dyslipidemia and
 * hypertension — the framework he named "Syndrome X," which became the modern
 * "metabolic syndrome."
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1988-12-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title "Role of Insulin Resistance in Human Disease",
 * author Reaven GM, journal Diabetes, 1988-12-01 — matches the DOI and OpenAlex ID.
 * No retraction or expression of concern (Crossref returns no update-to/updated-by).
 *
 * Post-publication arc (two verified transitions) tracks the framework this lecture
 * launched through its most-cited, dated adjudicating documents:
 *
 *   (1) RECORDED -> CONTESTED @ 2005-09 (EXPERT_LITERATURE)
 *       Kahn R, Buse J, Ferrannini E, Stern M.
 *       "The Metabolic Syndrome: Time for a Critical Appraisal. Joint statement from
 *       the ADA and EASD." Diabetes Care 2005;28(9):2289-2304. PMID 16123508.
 *       DOI 10.2337/diacare.28.9.2289. A formal, dated critical appraisal — jointly
 *       issued by the American Diabetes Association and the European Association for
 *       the Study of Diabetes — that challenged whether the clustering Reaven
 *       described should be defined and diagnosed as a discrete syndrome, questioning
 *       its ill-defined criteria, uncertain pathogenesis and clinical utility.
 *
 *   (2) CONTESTED -> SETTLED @ 2009-10 (INSTITUTIONAL)
 *       Alberti KGMM, Eckel RH, Grundy SM, Zimmet PZ, Cleeman JI, Donato KA, et al.
 *       "Harmonizing the Metabolic Syndrome: A Joint Interim Statement of the IDF Task
 *       Force on Epidemiology and Prevention; NHLBI; AHA; World Heart Federation;
 *       International Atherosclerosis Society; and International Association for the
 *       Study of Obesity." Circulation 2009;120(16):1640-1645. PMID 19805654.
 *       DOI 10.1161/CIRCULATIONAHA.109.192644. Six major international bodies resolved
 *       the definitional dispute by agreeing a single harmonized set of diagnostic
 *       criteria — the construct born from Reaven's lecture settled into a unified,
 *       institutionally adopted clinical definition used worldwide thereafter.
 */

const claimId = 'cmplyd1sy04bxsaihpgzkcrzt';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2005-09), ADA/EASD critical appraisal ---
  const sourceKahn = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.2337/diacare.28.9.2289' },
    update: {},
    create: {
      externalId: 'src:doi:10.2337/diacare.28.9.2289',
      name:
        'Kahn R, Buse J, Ferrannini E, Stern M (2005), "The Metabolic Syndrome: Time ' +
        'for a Critical Appraisal. Joint statement from the ADA and EASD," ' +
        'Diabetes Care 28(9):2289-2304',
      url: 'https://pubmed.ncbi.nlm.nih.gov/16123508/',
      publishedAt: new Date('2005-09-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2005-09-01');
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
        sourceId: sourceKahn.id,
        reason:
          'The framework launched by Reaven\'s Banting Lecture was formally contested by the ' +
          '2005 ADA/EASD joint statement "The Metabolic Syndrome: Time for a Critical ' +
          'Appraisal," which questioned whether the clustering of insulin resistance, ' +
          'dyslipidemia, hypertension and glucose intolerance should be defined and ' +
          'diagnosed as a discrete syndrome, citing ill-defined criteria and uncertain ' +
          'clinical value. A specific, dated critique in the expert literature.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2009-10), harmonized definition consensus ---
  const sourceAlberti = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1161/CIRCULATIONAHA.109.192644' },
    update: {},
    create: {
      externalId: 'src:doi:10.1161/CIRCULATIONAHA.109.192644',
      name:
        'Alberti KGMM, Eckel RH, Grundy SM, et al. (2009), "Harmonizing the Metabolic ' +
        'Syndrome: A Joint Interim Statement (IDF/NHLBI/AHA/WHF/IAS/IASO)," ' +
        'Circulation 120(16):1640-1645',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19805654/',
      publishedAt: new Date('2009-10-20'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2009-10-20');
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
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceAlberti.id,
        reason:
          'The definitional dispute over the syndrome born from Reaven\'s lecture was ' +
          'resolved in 2009 when six major international bodies (IDF, NHLBI, AHA, World ' +
          'Heart Federation, IAS, IASO) issued a joint interim statement agreeing a single ' +
          'harmonized set of diagnostic criteria. The construct settled into a unified, ' +
          'institutionally adopted clinical definition used worldwide thereafter.',
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
