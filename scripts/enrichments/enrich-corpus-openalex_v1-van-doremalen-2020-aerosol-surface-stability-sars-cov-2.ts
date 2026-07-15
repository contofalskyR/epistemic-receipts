import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   van Doremalen N, Bushmaker T, Morris DH, et al.
 *   "Aerosol and Surface Stability of SARS-CoV-2 as Compared with SARS-CoV-1."
 *   N Engl J Med, published online 2020-03-17. DOI 10.1056/NEJMc2004973.
 *   Claim id: cmq2w4hkj00axsa8hsng23hm3  (OpenAlex W3012099172)
 *
 * The research letter reported laboratory measurements of SARS-CoV-2 and
 * SARS-CoV-1 stability in aerosols (viable up to ~3 h) and on surfaces
 * (plastic/steel up to ~72 h) under controlled experimental conditions.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2020-03-17) already exists; not duplicated.
 * Identity confirmed via Crossref/DOI resolution: title/authors/journal/2020 match the
 * DOI and OpenAlex ID. NOT retracted; no expression of concern (NEJM page live, no
 * update-to/updated-by relation; PubMed shows no retraction marker).
 *
 * The measured stability values were not disputed and have been replicated. What was
 * contested, then adjudicated, is the finding's real-world transmission significance —
 * specifically whether the surface-stability data implied a meaningful fomite
 * (contaminated-surface) transmission risk.
 *
 * Post-publication arc (two verified transitions):
 *
 *   (1) RECORDED -> CONTESTED @ 2020-07-03 (EXPERT_LITERATURE)
 *       Goldman E. "Exaggerated risk of transmission of COVID-19 by fomites."
 *       Lancet Infect Dis 2020;20(8):892-893. DOI 10.1016/S1473-3099(20)30561-2.
 *       A specific, dated methodological critique arguing that surface-stability
 *       studies of this kind — including van Doremalen et al. — used high viral
 *       inocula and conditions with little resemblance to real-life scenarios, and
 *       that a clinically significant fomite transmission risk had been overstated
 *       on their basis.
 *
 *   (2) CONTESTED -> SETTLED @ 2021-04-05 (INSTITUTIONAL)
 *       CDC. "Science Brief: SARS-CoV-2 and Surface (Fomite) Transmission for Indoor
 *       Community Environments." Updated 2021-04-05. PMID 34009771 (NCBI Bookshelf
 *       NBK570437). The brief adjudicated the debate: it accepts the laboratory
 *       surface-stability measurements as valid while concluding, from real-world
 *       evidence, that the risk of fomite transmission is low and that lab persistence
 *       does not translate into substantial real-world surface transmission — settling
 *       how the finding is to be understood in practice.
 */

const claimId = 'cmq2w4hkj00axsa8hsng23hm3';

async function main() {
  // --- Transition 1: RECORDED -> CONTESTED (2020-07-03), fomite-risk critique ---
  const sourceGoldman = await prisma.source.upsert({
    where: { externalId: 'src:doi:10.1016/S1473-3099(20)30561-2' },
    update: {},
    create: {
      externalId: 'src:doi:10.1016/S1473-3099(20)30561-2',
      name:
        'Goldman E (2020), "Exaggerated risk of transmission of COVID-19 by fomites," ' +
        'Lancet Infect Dis 20(8):892-893',
      url: 'https://doi.org/10.1016/S1473-3099(20)30561-2',
      publishedAt: new Date('2020-07-03'),
      methodologyType: 'opinion',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2020-07-03');
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
        datePrecision: 'DAY',
        sourceId: sourceGoldman.id,
        reason:
          'Goldman (Lancet Infect Dis, 2020) issued a specific, dated critique arguing ' +
          'that surface-stability studies of this type — including van Doremalen et al. — ' +
          'used high viral inocula and laboratory conditions with little resemblance to ' +
          'real-life scenarios, and that a clinically significant fomite transmission risk ' +
          'had been overstated on their basis. This contested the real-world significance ' +
          'attributed to the finding, without disputing the measured stability values.',
      },
    });
  }

  // --- Transition 2: CONTESTED -> SETTLED (2021-04-05), CDC fomite science brief ---
  const sourceCdc = await prisma.source.upsert({
    where: { externalId: 'src:pmid:34009771' },
    update: {},
    create: {
      externalId: 'src:pmid:34009771',
      name:
        'CDC (2021), "Science Brief: SARS-CoV-2 and Surface (Fomite) Transmission for ' +
        'Indoor Community Environments" (updated 2021-04-05), NCBI Bookshelf NBK570437',
      url: 'https://www.ncbi.nlm.nih.gov/books/NBK570437/',
      publishedAt: new Date('2021-04-05'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2021-04-05');
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
        sourceId: sourceCdc.id,
        reason:
          'The CDC fomite-transmission science brief (updated 2021-04-05) adjudicated the ' +
          'debate at the field level: it accepts the laboratory surface-stability ' +
          'measurements as valid while concluding, from accumulated real-world evidence, ' +
          'that the risk of fomite transmission is low and that lab persistence does not ' +
          'imply substantial real-world surface transmission. This settled how the finding ' +
          'is understood in practice — the measurements stand, their transmission ' +
          'significance is bounded — vindicating the empirical result while resolving the contest.',
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
