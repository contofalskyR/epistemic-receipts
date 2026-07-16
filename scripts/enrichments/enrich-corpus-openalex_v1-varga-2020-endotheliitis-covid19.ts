import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Varga Z, Flammer AJ, Steiger P, Haberecker M, Andermatt R, Zinkernagel AS,
 *   Mehra MR, Schuepbach RA, Ruschitzka F, Moch H.
 *   "Endothelial cell infection and endotheliitis in COVID-19."
 *   The Lancet, 2020;395(10234):1417-1418. Online 2020-04-21.
 *   DOI 10.1016/S0140-6736(20)30937-5.
 *   Claim id: cmplybubh03r3saihwteafg9m  (OpenAlex W3017125154)
 *
 * The Varga correspondence reported direct SARS-CoV-2 infection of endothelial
 * cells (viral inclusion structures on electron microscopy) together with diffuse
 * endothelial inflammation ("endotheliitis") across several organs, and proposed
 * that COVID-19 is in part a systemic endothelial disease.
 *
 * Identity confirmed via Crossref: title/authors/journal/2020 match the DOI and
 * OpenAlex ID W3017125154. Baseline row (fromAxis=null -> RECORDED @ 2020-04-21)
 * already exists and is NOT duplicated here.
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2020-05 (EXPERT_LITERATURE)
 *       Goldsmith CS, Miller SE, Martines RB, Bullock HA, Zaki SR.
 *       "Electron microscopy of SARS-CoV-2: a challenging task."
 *       The Lancet 2020;395(10238):e99. DOI 10.1016/S0140-6736(20)31188-0.
 *       CDC/Duke electron-microscopy experts argued that the intracellular
 *       structures Varga et al. identified as coronavirus particles are more
 *       consistent with normal subcellular organelles (rough endoplasmic
 *       reticulum, clathrin-coated vesicles, multivesicular bodies) — a specific,
 *       dated methodological critique of the paper's central evidence for direct
 *       endothelial infection.
 *
 *   (2) CONTESTED -> REVERSED @ 2021-02-23 (EXPERT_LITERATURE)
 *       McCracken IR, Saginc G, He L, Huseynov A, Daniels A, Fletcher S, et al.
 *       "Lack of Evidence of Angiotensin-Converting Enzyme 2 Expression and
 *       Replicative Infection by SARS-CoV-2 in Human Endothelial Cells."
 *       Circulation 2021;143(8):865-868. DOI 10.1161/CIRCULATIONAHA.120.052824.
 *       This experimental study showed human endothelial cells express little or
 *       no ACE2 (the apparent signal traced to pericyte contamination) and do not
 *       support productive SARS-CoV-2 replication, overturning the direct-infection
 *       mechanism. The subsequent expert consensus holds that endothelial injury in
 *       COVID-19 is real but largely secondary (immune, complement, cytokine, and
 *       neighbouring-cell mediated) rather than driven by direct endothelial
 *       infection — the specific "endothelial cell infection" claim is reversed.
 */

const claimId = 'cmplybubh03r3saihwteafg9m';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2020-05), EM misinterpretation critique ---
  const sourceGoldsmith = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/S0140-6736(20)31188-0' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/S0140-6736(20)31188-0',
      name:
        'Goldsmith CS, Miller SE, Martines RB, et al. (2020), "Electron microscopy ' +
        'of SARS-CoV-2: a challenging task," The Lancet 395(10238):e99',
      url: 'https://doi.org/10.1016/S0140-6736(20)31188-0',
      publishedAt: new Date('2020-05-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2020-05-01');
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
        sourceId: sourceGoldsmith.id,
        reason:
          'CDC and Duke electron-microscopy experts (Goldsmith, Miller, Martines et al.) ' +
          'challenged the paper\'s central evidence, arguing the intracellular structures ' +
          'Varga et al. read as coronavirus particles are more consistent with normal ' +
          'subcellular organelles (rough endoplasmic reticulum, clathrin-coated vesicles, ' +
          'multivesicular bodies). This dated methodological critique in The Lancet placed ' +
          'the direct-endothelial-infection finding under active contest.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> REVERSED (2021-02-23), ACE2/replication refutation ---
  const sourceMcCracken = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1161/CIRCULATIONAHA.120.052824' },
    update: {},
    create: {
      externalId: 'src:doi:10.1161/CIRCULATIONAHA.120.052824',
      name:
        'McCracken IR, Saginc G, He L, et al. (2021), "Lack of Evidence of ' +
        'Angiotensin-Converting Enzyme 2 Expression and Replicative Infection by ' +
        'SARS-CoV-2 in Human Endothelial Cells," Circulation 143(8):865-868',
      url: 'https://doi.org/10.1161/CIRCULATIONAHA.120.052824',
      publishedAt: new Date('2021-02-23'),
      methodologyType: 'primary',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2021-02-23');
    const toAxis = 'REVERSED';
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
        datePrecision: 'DAY',
        sourceId: sourceMcCracken.id,
        reason:
          'McCracken et al. showed human endothelial cells express little or no ACE2 ' +
          '(the apparent signal tracing to pericyte contamination) and do not support ' +
          'productive SARS-CoV-2 replication, refuting the proposed direct-infection ' +
          'mechanism. The ensuing expert consensus holds that COVID-19 endothelial injury ' +
          'is real but largely secondary (immune, complement, cytokine, and neighbouring- ' +
          'cell mediated) rather than driven by direct endothelial infection, reversing the ' +
          'specific "endothelial cell infection" claim while endotheliitis persists as a ' +
          'downstream phenomenon.',
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
