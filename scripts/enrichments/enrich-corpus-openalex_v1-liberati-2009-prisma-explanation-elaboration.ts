import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Liberati A, Altman DG, Tetzlaff J, Mulrow C, Gøtzsche PC, Ioannidis JPA,
 *   Clarke M, Devereaux PJ, Kleijnen J, Moher D.
 *   "The PRISMA statement for reporting systematic reviews and meta-analyses of
 *   studies that evaluate health care interventions: explanation and elaboration."
 *   Journal of Clinical Epidemiology, 2009. DOI 10.1016/j.jclinepi.2009.06.006.
 *   Claim id: cmplzp0dk002dsa86d1vz7p0r  (OpenAlex W2576440140)
 *
 * The PRISMA (Preferred Reporting Items for Systematic reviews and Meta-Analyses)
 * Explanation and Elaboration document defined the reporting standard for
 * systematic reviews of healthcare interventions.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2009-07-24) already exists; not duplicated.
 * Identity confirmed via Crossref: title/authors (Liberati, Altman, Tetzlaff, Mulrow,
 * Gøtzsche, Ioannidis...) / J Clin Epidemiol / 2009 match the DOI and OpenAlex ID.
 * No retraction or expression of concern (Crossref update-to / updated-by are null).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2021-03-29 (EXPERT_LITERATURE)
 *       Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, Mulrow CD, et al.
 *       "The PRISMA 2020 statement: an updated guideline for reporting systematic
 *       reviews." BMJ 2021;372:n71. Published 29 March 2021. PMID 33782057.
 *       DOI 10.1136/bmj.n71.
 *       The PRISMA 2020 statement is the formal, peer-reviewed update to the 2009
 *       PRISMA reporting guideline, produced by an overlapping author group after a
 *       decade of field adoption. Rather than overturning the 2009 approach, it
 *       carried it forward and refined the item set, confirming PRISMA as the settled
 *       reporting standard for systematic reviews. The guideline was never contested,
 *       so the arc runs directly RECORDED -> SETTLED. DOI verified via Crossref;
 *       PubMed URL verified to resolve (HTTP 200).
 */

const claimId = 'cmplzp0dk002dsa86d1vz7p0r';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2021-03-29), PRISMA 2020 updated guideline ---
  const sourcePrisma2020 = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1136/bmj.n71' },
    update: {},
    create: {
      externalId: 'src:doi:10.1136/bmj.n71',
      name:
        'Page MJ, McKenzie JE, Bossuyt PM, Boutron I, Hoffmann TC, Mulrow CD, et al. ' +
        '(2021), "The PRISMA 2020 statement: an updated guideline for reporting ' +
        'systematic reviews," BMJ 2021;372:n71',
      url: 'https://pubmed.ncbi.nlm.nih.gov/33782057/',
      publishedAt: new Date('2021-03-29'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2021-03-29');
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
        sourceId: sourcePrisma2020.id,
        reason:
          'The PRISMA 2020 statement (Page et al., BMJ 2021;372:n71) is the formal ' +
          'peer-reviewed update to the 2009 PRISMA reporting guideline, produced by an ' +
          'overlapping author group after a decade of widespread adoption. It carried ' +
          'the 2009 approach forward and refined the checklist rather than overturning ' +
          'it, confirming PRISMA as the settled reporting standard for systematic ' +
          'reviews of healthcare interventions. The guideline was never contested, so ' +
          'the arc runs directly RECORDED -> SETTLED.',
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
