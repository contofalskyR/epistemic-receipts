import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Epistemic trajectory enrichment for:
 *   CSDH (Marmot M, et al.). "Closing the gap in a generation: health equity
 *   through action on the social determinants of health."
 *   The Lancet 2008;372(9650):1661–1669.
 *   DOI: 10.1016/s0140-6736(08)61690-6   (OpenAlex W2128248134)
 *   Claim id: cmpm01cws05udsa8649u9zi4x
 *
 * Identity confirmed: the DOI resolves (redirect) to the Lancet summary of the
 * final report of the WHO Commission on Social Determinants of Health (CSDH),
 * matched against the given OpenAlex ID and DOI.
 *
 * Baseline row (fromAxis=null -> RECORDED @ 2008-11-01) already exists; not duplicated.
 * No retraction or expression of concern exists (it is a consensus policy report,
 * not an empirical finding subject to replication).
 *
 * Post-publication arc (one verified transition):
 *
 *   (1) RECORDED -> SETTLED @ 2009-05 (INSTITUTIONAL)
 *       The Sixty-second World Health Assembly adopted resolution WHA62.14,
 *       "Reducing health inequities through action on the social determinants of
 *       health," which endorsed the Commission's report and urged Member States
 *       to tackle health inequities through action on the social determinants of
 *       health. The endorsement of the report's framework by WHO's supreme
 *       decision-making body (all Member States) is an institutional field-consensus
 *       settling of the Commission's core claim.
 *       Verified: WHO publications record, WHO Reference Number WHA62.14 (200).
 *
 * A single, dated, verifiable institutional adjudicating event is preferred over
 * padding the curve with a speculative "contest."
 */

const claimId = 'cmpm01cws05udsa8649u9zi4x';

async function main() {
  // --- Transition 1: RECORDED -> SETTLED (2009-05), WHA62.14 endorsement ---
  const sourceWha = await prisma.source.upsert({
    where: { externalId: 'src:wha62-14-social-determinants-2009' },
    update: {},
    create: {
      externalId: 'src:wha62-14-social-determinants-2009',
      name:
        'Resolution WHA62.14, "Reducing health inequities through action on the ' +
        'social determinants of health." Sixty-second World Health Assembly, ' +
        'World Health Organization, Geneva, May 2009.',
      url: 'https://www.who.int/publications/i/item/reducing-health-inequities-through-action-on-the-social-determinants-of-health',
      publishedAt: new Date('2009-05-01'),
      methodologyType: 'derivative',
      ingestedBy: 'manual',
    },
  });

  {
    const occurredAt = new Date('2009-05-01');
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
        datePrecision: 'MONTH',
        sourceId: sourceWha.id,
        reason:
          "The WHO Commission on Social Determinants of Health's report was ratified " +
          'as institutional consensus by the Sixty-second World Health Assembly, which ' +
          'in May 2009 adopted resolution WHA62.14, "Reducing health inequities through ' +
          'action on the social determinants of health." The resolution endorsed the ' +
          "Commission's findings and urged Member States to act on the social " +
          "determinants of health, marking the institutional settling of the report's " +
          'core claim by WHO\'s supreme decision-making body.',
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
