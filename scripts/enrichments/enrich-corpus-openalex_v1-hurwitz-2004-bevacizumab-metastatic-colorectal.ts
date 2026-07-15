import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Hurwitz H, Fehrenbacher L, Novotny W, Cartwright T, Hainsworth J, Heim W,
 *   Berlin J, Baron A, Griffing S, Holmgren E, Ferrara N, Fyfe G, Rogers B,
 *   Ross R, Kabbinavar F.
 *   "Bevacizumab plus Irinotecan, Fluorouracil, and Leucovorin for Metastatic
 *   Colorectal Cancer." New England Journal of Medicine, 3 June 2004.
 *   DOI 10.1056/nejmoa032691.
 *   Claim id: cmply9n9902plsaihahzhwmdm  (OpenAlex W2157769714)
 *
 * The pivotal AVF2107g trial randomized 813 previously untreated metastatic
 * colorectal cancer patients to IFL + bevacizumab vs IFL + placebo, and reported
 * that adding bevacizumab improved median overall survival (20.3 vs 15.6 months).
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2004-06-02) already exists; not duplicated.
 * Identity confirmed via Crossref: title/authors/2004 NEJM match the DOI and OpenAlex ID.
 * No retraction or expression of concern (Crossref returns null for update-to/updated-by).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2009-07-08 (EXPERT_LITERATURE)
 *       Wagner AD, Arnold D, Grothey AA, Haerting J, Unverzagt S.
 *       "Anti-angiogenic therapies for metastatic colorectal cancer."
 *       Cochrane Database of Systematic Reviews, 8 July 2009, Issue 3, CD005392.
 *       PMID 19588372. DOI 10.1002/14651858.CD005392.pub3.
 *       This Cochrane systematic review and meta-analysis pooled the first-line
 *       randomized trials of bevacizumab plus chemotherapy in metastatic colorectal
 *       cancer and confirmed a significant overall-survival benefit (HR 0.81, 95% CI
 *       0.73-0.90) and progression-free-survival benefit (HR 0.61, 95% CI 0.45-0.83)
 *       in favor of bevacizumab. This adjudicating meta-analysis vindicated the
 *       Hurwitz finding as the settled first-line standard. The pivotal trial was
 *       never contested (FDA-approved for this indication), so the arc goes directly
 *       RECORDED -> SETTLED.
 */

const claimId = 'cmply9n9902plsaihahzhwmdm';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2009-07-08), Cochrane meta-analysis vindication ---
  const sourceCochrane = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1002/14651858.CD005392.pub3' },
    update: {},
    create: {
      externalId: 'src:doi:10.1002/14651858.CD005392.pub3',
      name:
        'Wagner AD, Arnold D, Grothey AA, Haerting J, Unverzagt S (2009), ' +
        '"Anti-angiogenic therapies for metastatic colorectal cancer," ' +
        'Cochrane Database of Systematic Reviews, Issue 3, CD005392',
      url: 'https://pubmed.ncbi.nlm.nih.gov/19588372/',
      publishedAt: new Date('2009-07-08'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2009-07-08');
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
        sourceId: sourceCochrane.id,
        reason:
          'The Cochrane systematic review and meta-analysis by Wagner et al. (2009) ' +
          'pooled the first-line randomized trials of bevacizumab plus chemotherapy in ' +
          'metastatic colorectal cancer and confirmed a significant overall-survival ' +
          'benefit (HR 0.81, 95% CI 0.73-0.90) and progression-free-survival benefit ' +
          '(HR 0.61, 95% CI 0.45-0.83). This adjudicating meta-analysis settled the ' +
          'Hurwitz finding as the first-line standard; the pivotal trial was never ' +
          'contested, so the arc runs directly RECORDED -> SETTLED.',
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
