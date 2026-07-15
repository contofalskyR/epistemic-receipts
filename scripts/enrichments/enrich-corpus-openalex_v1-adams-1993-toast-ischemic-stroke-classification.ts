import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Adams HP Jr, Bendixen BH, Kappelle LJ, Biller J, Love BB, Gordon DL, Marsh EE.
 *   "Classification of subtype of acute ischemic stroke. Definitions for use in a
 *   multicenter clinical trial. TOAST. Trial of Org 10172 in Acute Stroke Treatment."
 *   Stroke, January 1993. DOI 10.1161/01.str.24.1.35.
 *   Claim id: cmply433m0009saihw93fg5vb  (OpenAlex W2138595885)
 *
 * The TOAST paper introduced a five-category etiologic classification of ischemic
 * stroke (large-artery atherosclerosis, cardioembolism, small-vessel occlusion,
 * other determined etiology, undetermined etiology) for use in stroke trials.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1993-01-01) already exists; not duplicated.
 * Identity confirmed via Crossref: title/authors/1993 match the DOI and OpenAlex ID.
 * No retraction or expression of concern (Crossref returns no update-to/updated-by).
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2005-11 (EXPERT_LITERATURE)
 *       Ay H, Furie KL, Singhal A, Smith WS, Sorensen AG, Koroshetz WJ.
 *       "An evidence-based causative classification system for acute ischemic stroke."
 *       Annals of Neurology 2005;58(5):688-697. PMID 16240340. DOI 10.1002/ana.20617.
 *       This paper documented the limitations of TOAST — notably its modest
 *       inter-observer reliability and its large "undetermined" category — and
 *       proposed an evidence-based, algorithmic successor (SSS-TOAST / later CCS).
 *       A specific, dated, peer-reviewed methodological critique of the finding.
 *
 *   (2) CONTESTED -> SETTLED @ 2014-07 (INSTITUTIONAL)
 *       Kernan WN, Ovbiagele B, Black HR, et al. (AHA/ASA)
 *       "Guidelines for the Prevention of Stroke in Patients With Stroke and
 *       Transient Ischemic Attack." Stroke 2014;45(7):2160-2236. PMID 24788967.
 *       DOI 10.1161/STR.0000000000000024. The AHA/ASA guideline structures its
 *       secondary-prevention recommendations around TOAST etiologic subtypes,
 *       institutionalizing the framework as the standard vocabulary of stroke
 *       etiology. Despite the reliability refinements above, the TOAST framework
 *       endured as the reference classification — a field-consensus settling.
 */

const claimId = 'cmply433m0009saihw93fg5vb';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2005-11), reliability critique + successor ---
  const sourceAy = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1002/ana.20617' },
    update: {},
    create: {
      externalId: 'src:doi:10.1002/ana.20617',
      name:
        'Ay H, et al. (2005), "An evidence-based causative classification system ' +
        'for acute ischemic stroke," Annals of Neurology 58(5):688-697',
      url: 'https://pubmed.ncbi.nlm.nih.gov/16240340/',
      publishedAt: new Date('2005-11-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2005-11-01');
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
        sourceId: sourceAy.id,
        reason:
          "TOAST's etiologic classification was contested on methodological grounds by " +
          'Ay et al. (2005), who documented its modest inter-observer reliability and its ' +
          'large "undetermined" category, and proposed an evidence-based algorithmic ' +
          'successor (SSS-TOAST). This peer-reviewed critique in the expert literature ' +
          'marked the finding as under active refinement rather than fully settled.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2014-07), AHA/ASA guideline institutionalization ---
  const sourceKernan = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1161/STR.0000000000000024' },
    update: {},
    create: {
      externalId: 'src:doi:10.1161/STR.0000000000000024',
      name:
        'Kernan WN, et al. (AHA/ASA, 2014), "Guidelines for the Prevention of Stroke ' +
        'in Patients With Stroke and Transient Ischemic Attack," Stroke 45(7):2160-2236',
      url: 'https://pubmed.ncbi.nlm.nih.gov/24788967/',
      publishedAt: new Date('2014-07-01'),
      methodologyType: 'guideline',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2014-07-01');
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
        datePrecision: 'MONTH',
        sourceId: sourceKernan.id,
        reason:
          'Despite reliability refinements and successor systems, the TOAST etiologic ' +
          'subtype framework endured as the reference standard. The 2014 AHA/ASA secondary- ' +
          'prevention guideline organizes its recommendations around TOAST subtypes, ' +
          'institutionalizing the classification as the canonical vocabulary of stroke ' +
          'etiology — a field-consensus settling of the finding.',
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
