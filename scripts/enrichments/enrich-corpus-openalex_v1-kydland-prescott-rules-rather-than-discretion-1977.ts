import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   Kydland FE, Prescott EC. "Rules Rather than Discretion: The Inconsistency
 *   of Optimal Plans." Journal of Political Economy 1977;85(3):473–491.
 *   DOI: 10.1086/260580   (OpenAlex W2169417293)
 *   Claim id: cmpm02mkx06fjsa86nj0290np
 *
 * Identity confirmed: the DOI resolves to the JPE article page
 * "Rules Rather than Discretion: The Inconsistency of Optimal Plans" by
 * Finn E. Kydland and Edward C. Prescott, Vol. 85, No. 3 — matched against the
 * given OpenAlex ID and DOI. This is the foundational time-inconsistency
 * ("game against rational agents") paper.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 1977-06-01) already exists; not duplicated.
 * No retraction or expression of concern exists (isRetracted=false); this is a
 * vindicated theoretical result, not a contested empirical finding.
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2004-10-11 (INSTITUTIONAL)
 *       The Royal Swedish Academy of Sciences awarded the 2004 Sveriges Riksbank
 *       Prize in Economic Sciences in Memory of Alfred Nobel jointly to Finn E.
 *       Kydland and Edward C. Prescott "for their contributions to dynamic
 *       macroeconomics: the time consistency of economic policy and the driving
 *       forces behind business cycles." The prize press release (11 Oct 2004)
 *       explicitly credits the time-consistency result of this paper and notes it
 *       "shifted the practical discussion of economic policy... towards the
 *       institutions of policymaking, a shift that has largely influenced the
 *       reforms of central banks." The Nobel award is the definitive institutional
 *       field-consensus settling of this claim.
 *       Verified: nobelprize.org press release (200).
 *
 * A single, dated, verifiable institutional adjudicating event is preferred over
 * padding the curve with a speculative "contest."
 */

const claimId = 'cmpm02mkx06fjsa86nj0290np';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2004-10-11), 2004 Nobel Prize ---
  const sourceNobel = await prisma.source.upsert({
    where: { externalId: 'src:nobel-economics-2004-kydland-prescott' },
    update: {},
    create: {
      externalId: 'src:nobel-economics-2004-kydland-prescott',
      name:
        'Press release: "The Sveriges Riksbank Prize in Economic Sciences in ' +
        'Memory of Alfred Nobel 2004." The Royal Swedish Academy of Sciences, ' +
        '11 October 2004. Awarded jointly to Finn E. Kydland and Edward C. ' +
        'Prescott "for their contributions to dynamic macroeconomics: the time ' +
        'consistency of economic policy and the driving forces behind business cycles."',
      url: 'https://www.nobelprize.org/prizes/economic-sciences/2004/press-release/',
      publishedAt: new Date('2004-10-11'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2004-10-11');
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
        community: 'INSTITUTIONAL',
        occurredAt,
        datePrecision: 'DAY',
        sourceId: sourceNobel.id,
        reason:
          'The time-inconsistency result of this paper was ratified as field ' +
          'consensus by the 2004 Sveriges Riksbank Prize in Economic Sciences in ' +
          'Memory of Alfred Nobel, awarded to Kydland and Prescott "for their ' +
          'contributions to dynamic macroeconomics: the time consistency of economic ' +
          'policy." The Academy\'s press release credits the awarded work with ' +
          'reshaping the design of monetary policy and central-bank reform, marking ' +
          'the institutional settling of the claim.',
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
